import path from 'path'
import { fileURLToPath } from 'url'
import { getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { app, attachUserFromToken, isAdmin } from './server.js'

const PRODUCT_COLLECTION = 'products'
const POS_BILL_COLLECTION = 'pos_bills'
const INVENTORY_TRANSACTION_COLLECTION = 'inventory_transactions'

function asPositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function asMoney(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function getFirestoreInstance() {
  const firebaseApp = getApps()[0]
  return firebaseApp ? getFirestore(firebaseApp) : null
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  const merged = new Map()
  items.forEach((item) => {
    const productId = String(item?.productId || '').trim()
    const quantity = asPositiveInteger(item?.quantity)
    if (!productId || !quantity) return
    const existing = merged.get(productId)
    merged.set(productId, {
      productId,
      quantity: (existing?.quantity || 0) + quantity,
      selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A',
    })
  })
  return [...merged.values()]
}

function createBillNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `POS-${datePart}-${randomPart}`
}

app.post('/api/admin/inventory/adjust', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const firestore = getFirestoreInstance()
    if (!firestore) return res.status(503).json({ success: false, message: 'Server not configured' })

    const productId = String(req.body?.productId || '').trim()
    const quantity = Number(req.body?.quantity)
    const reason = String(req.body?.reason || 'Manual inventory adjustment').trim() || 'Manual inventory adjustment'

    if (!productId || !Number.isInteger(quantity) || quantity === 0) {
      return res.status(400).json({ success: false, message: 'productId and a non-zero integer quantity are required' })
    }

    const productRef = firestore.collection(PRODUCT_COLLECTION).doc(productId)
    const transactionRef = firestore.collection(INVENTORY_TRANSACTION_COLLECTION).doc()

    const result = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(productRef)
      if (!snapshot.exists) throw new Error('Product not found')

      const product = snapshot.data() || {}
      const currentStock = Number(product.stock ?? product.openingStock ?? 0)
      const nextStock = currentStock + quantity
      if (!Number.isFinite(currentStock) || nextStock < 0) throw new Error('Stock cannot be negative')

      transaction.update(productRef, { stock: nextStock, updatedAt: FieldValue.serverTimestamp() })
      transaction.set(transactionRef, {
        productId,
        type: quantity > 0 ? 'stock_in' : 'stock_out',
        quantity,
        stockBefore: currentStock,
        stockAfter: nextStock,
        reason,
        createdBy: req.user.uid,
        createdAt: FieldValue.serverTimestamp(),
      })

      return { productId, stockBefore: currentStock, quantity, stockAfter: nextStock }
    })

    return res.status(200).json({ success: true, inventory: result })
  } catch (error) {
    console.error('Inventory adjustment error:', error)
    const message = String(error?.message || '')
    if (message === 'Product not found' || message === 'Stock cannot be negative') return res.status(409).json({ success: false, message })
    return res.status(500).json({ success: false, message: 'Failed to adjust inventory' })
  }
})

app.post('/api/admin/pos/sale', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const firestore = getFirestoreInstance()
    if (!firestore) return res.status(503).json({ success: false, message: 'Server not configured' })

    const items = normalizeItems(req.body?.items)
    const paymentMethod = String(req.body?.paymentMethod || '').trim().toLowerCase()
    const customer = req.body?.customer && typeof req.body.customer === 'object' ? req.body.customer : {}
    const requestedDiscountPercent = asMoney(req.body?.discountPercent)
    const discountPercent = Math.min(100, Math.max(0, requestedDiscountPercent))

    if (items.length === 0) return res.status(400).json({ success: false, message: 'At least one valid item is required' })
    if (!['cash', 'upi', 'card'].includes(paymentMethod)) return res.status(400).json({ success: false, message: 'Payment method must be cash, upi, or card' })

    const productRefs = items.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(item.productId))
    const billRef = firestore.collection(POS_BILL_COLLECTION).doc()
    const billNo = createBillNumber()
    const inventoryRefs = items.map(() => firestore.collection(INVENTORY_TRANSACTION_COLLECTION).doc())

    const result = await firestore.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)))
      const saleItems = []
      let subtotal = 0
      let costTotal = 0
      let gstTotal = 0

      snapshots.forEach((snapshot, index) => {
        const item = items[index]
        if (!snapshot.exists) throw new Error(`Product not found: ${item.productId}`)
        const product = snapshot.data() || {}
        const currentStock = Number(product.stock ?? product.openingStock ?? 0)
        const unitPrice = asMoney(product.price ?? product.salePrice)
        const purchasePrice = asMoney(product.purchasePrice ?? product.prchPrice ?? product.costPrice)
        const gstPercent = Math.max(0, asMoney(product.gstPercent ?? product.gst ?? 0))
        if (!Number.isFinite(currentStock) || currentStock < item.quantity) throw new Error(`Insufficient stock for ${String(product.name || item.productId)}`)
        if (unitPrice <= 0) throw new Error(`Invalid sale price for ${String(product.name || item.productId)}`)

        const lineSubtotal = asMoney(unitPrice * item.quantity)
        subtotal = asMoney(subtotal + lineSubtotal)
        costTotal = asMoney(costTotal + purchasePrice * item.quantity)
        saleItems.push({ productId: item.productId, name: String(product.name || 'Product').trim() || 'Product', sku: String(product.sku || '').trim(), barcode: String(product.barcode || '').trim(), selectedSize: item.selectedSize, quantity: item.quantity, unitPrice, purchasePrice, gstPercent, lineSubtotal })
      })

      const safeDiscount = asMoney(subtotal * discountPercent / 100)
      const discountRatio = subtotal > 0 ? (subtotal - safeDiscount) / subtotal : 0
      saleItems.forEach((item) => {
        item.discountedLineTotal = asMoney(item.lineSubtotal * discountRatio)
        item.gstAmount = asMoney(item.discountedLineTotal * item.gstPercent / 100)
        gstTotal = asMoney(gstTotal + item.gstAmount)
      })

      const totalAmount = asMoney(subtotal - safeDiscount + gstTotal)
      const profit = asMoney(subtotal - safeDiscount - costTotal)

      saleItems.forEach((item, index) => {
        const productRef = productRefs[index]
        const inventoryRef = inventoryRefs[index]
        const currentStock = Number(snapshots[index].data()?.stock ?? snapshots[index].data()?.openingStock ?? 0)
        const newStock = currentStock - item.quantity
        transaction.update(productRef, { stock: newStock, updatedAt: FieldValue.serverTimestamp() })
        transaction.set(inventoryRef, { productId: item.productId, type: 'sale', quantity: -item.quantity, stockBefore: currentStock, stockAfter: newStock, referenceId: billRef.id, billNo, reason: 'POS sale', createdBy: req.user.uid, createdAt: FieldValue.serverTimestamp() })
      })

      transaction.set(billRef, {
        billNo,
        billType: 'POS',
        customer: { name: String(customer.name || '').trim(), phone: String(customer.phone || '').trim() },
        items: saleItems,
        subtotal,
        discountPercent,
        discount: safeDiscount,
        gst: gstTotal,
        total: totalAmount,
        cost: costTotal,
        profit,
        margin: totalAmount > 0 ? asMoney((profit / totalAmount) * 100) : 0,
        paymentMethod,
        paymentStatus: 'paid',
        cashierUid: req.user.uid,
        cashierEmail: req.user.email || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      return { billId: billRef.id, billNo, items: saleItems, subtotal, discountPercent, discount: safeDiscount, gst: gstTotal, total: totalAmount, cost: costTotal, profit, margin: totalAmount > 0 ? asMoney((profit / totalAmount) * 100) : 0, paymentMethod }
    })

    return res.status(201).json({ success: true, bill: result })
  } catch (error) {
    console.error('POS sale error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock') || message.startsWith('Invalid sale price')) return res.status(409).json({ success: false, message })
    return res.status(500).json({ success: false, message: 'Failed to complete POS sale' })
  }
})

app.get('/api/admin/pos/bills', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const firestore = getFirestoreInstance()
    if (!firestore) return res.status(503).json({ success: false, message: 'Server not configured' })

    const fromMs = Number(req.query?.fromMs)
    const toMs = Number(req.query?.toMs)
    const hasFrom = Number.isFinite(fromMs)
    const hasTo = Number.isFinite(toMs)

    if ((hasFrom && !hasTo) || (!hasFrom && hasTo)) {
      return res.status(400).json({ success: false, message: 'Both fromMs and toMs are required for date filtering' })
    }

    if (hasFrom && hasTo && fromMs > toMs) {
      return res.status(400).json({ success: false, message: 'fromMs cannot be greater than toMs' })
    }

    let query = firestore.collection(POS_BILL_COLLECTION)
    if (hasFrom && hasTo) {
      query = query
        .where('createdAt', '>=', new Date(fromMs))
        .where('createdAt', '<=', new Date(toMs))
        .orderBy('createdAt', 'desc')
    } else {
      query = query.orderBy('createdAt', 'desc').limit(200)
    }

    const snapshot = await query.get()
    const bills = snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      const createdAt = data.createdAt?.toDate?.()?.toISOString?.() || null
      return { id: doc.id, ...data, createdAt }
    })
    return res.json({ success: true, bills, filtered: hasFrom && hasTo, count: bills.length })
  } catch (error) {
    console.error('POS bills fetch error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch POS bills' })
  }
})

const currentModulePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (executedFilePath && executedFilePath === currentModulePath) {
  const port = Number(process.env.PORT || 5000)
  app.listen(port, () => console.info(`POS backend running on http://localhost:${port}`))
}
