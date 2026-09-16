import path from 'path'
import { fileURLToPath } from 'url'
import { getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import './server-pos.js'
import { app, getRuntimeDependencies } from './server.js'

const PRODUCT_COLLECTION = 'products'
const ORDER_COLLECTION = 'orders'
const PAYMENT_INTENT_COLLECTION = 'paymentIntents'
const INVENTORY_TRANSACTION_COLLECTION = 'inventory_transactions'

const firestore = getApps().length > 0 ? getFirestore(getApps()[0]) : null

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function normalizeCheckoutItems(items) {
  if (!Array.isArray(items)) return []
  const merged = new Map()
  items.forEach((item) => {
    const productId = String(item?.productId || '').trim()
    const quantity = Math.max(1, Number(item?.quantity || 1))
    const selectedSize = String(item?.selectedSize || 'N/A').trim() || 'N/A'
    if (!productId || !Number.isFinite(quantity)) return
    const key = `${productId}::${selectedSize}`
    const existing = merged.get(key)
    merged.set(key, { productId, quantity: Math.min(1, (existing?.quantity || 0) + quantity), selectedSize })
  })
  return [...merged.values()]
}

function normalizeDiscountPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(100, Math.max(0, Math.round(number * 100) / 100))
}

function normalizeSizes(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
  if (typeof value === 'string') return [...new Set(value.split(',').map((item) => String(item || '').trim()).filter(Boolean))]
  if (value && typeof value === 'object') return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([size]) => String(size || '').trim()).filter(Boolean)
  return []
}

function getSizeStock(product) {
  const sizes = normalizeSizes(product?.sizes)
  if (!sizes.length) return {}
  const source = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
  return Object.fromEntries(sizes.map((size) => [size, source[size] !== undefined ? (Number(source[size]) > 0 ? 1 : 0) : 1]))
}

function validateRequestedSize(product, requested) {
  const sizes = normalizeSizes(product?.sizes)
  if (!sizes.length) return
  if (requested.selectedSize === 'N/A' || !sizes.includes(requested.selectedSize)) throw new Error(`Please select a valid size for ${String(product.name || requested.productId)}`)
  const sizeStock = getSizeStock(product)
  const available = Number(sizeStock[requested.selectedSize] || 0)
  if (available <= 0) throw new Error(`Size ${requested.selectedSize} is sold out for ${String(product.name || requested.productId)}`)
  if (requested.quantity > available) throw new Error(`Only 1 unit of size ${requested.selectedSize} is available for ${String(product.name || requested.productId)}`)
}

async function buildDiscountedPaymentIntent(items, discountPercent) {
  if (!firestore) throw new Error('Server not configured')
  const snapshots = await Promise.all(items.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(item.productId).get()))
  const products = snapshots.map((snapshot, index) => {
    const requested = items[index]
    if (!snapshot.exists) throw new Error(`Product not found: ${requested.productId}`)
    const product = snapshot.data() || {}
    const unitPrice = money(product.price ?? product.salePrice)
    const stock = Number(product.stock ?? product.openingStock ?? 0)
    if (unitPrice <= 0) throw new Error(`Invalid sale price for ${String(product.name || requested.productId)}`)
    validateRequestedSize(product, requested)
    if (!Number.isFinite(stock) || stock <= 0) throw new Error(`Product out of stock: ${String(product.name || requested.productId)}`)
    if (requested.quantity > stock) throw new Error(`Only ${stock} unit(s) available for ${String(product.name || requested.productId)}`)
    return {
      productId: requested.productId,
      name: String(product.name || 'Product').trim() || 'Product',
      imageUrl: String(product.imageUrl || product.image || '').trim(),
      selectedSize: requested.selectedSize,
      quantity: requested.quantity,
      unitPrice,
      lineTotal: money(unitPrice * requested.quantity),
    }
  })
  const subtotal = money(products.reduce((sum, item) => sum + item.lineTotal, 0))
  const safeDiscountPercent = normalizeDiscountPercent(discountPercent)
  const discountAmount = money(Math.min(subtotal, subtotal * safeDiscountPercent / 100))
  const totalAmount = money(subtotal - discountAmount)
  if (subtotal <= 0 || totalAmount <= 0) throw new Error('Calculated amount is invalid')
  return { products, subtotal, discountPercent: safeDiscountPercent, discountAmount, totalAmount }
}

app.post('/api/online/create-payment-order', async (req, res) => {
  try {
    if (!firestore) return res.status(503).json({ success: false, error: 'Server not configured' })
    const { razorpay } = getRuntimeDependencies()
    if (!razorpay) return res.status(503).json({ success: false, error: 'Payment service not configured' })

    const items = normalizeCheckoutItems(req.body?.items)
    if (!items.length) return res.status(400).json({ success: false, error: 'At least one product is required' })

    const currency = String(req.body?.currency || 'INR').trim() || 'INR'
    const userId = String(req.body?.userId || 'guest').trim() || 'guest'
    const customerDetails = req.body?.customerDetails && typeof req.body.customerDetails === 'object' ? req.body.customerDetails : {}
    const { products, subtotal, discountPercent, discountAmount, totalAmount } = await buildDiscountedPaymentIntent(items, req.body?.discountPercent)
    const order = await razorpay.orders.create({ amount: Math.round(totalAmount * 100), currency, receipt: `receipt_${Date.now()}`, notes: { itemCount: String(products.length), discountPercent: String(discountPercent) } })

    await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(order.id).set({ userId, products, subtotal, discountPercent, discountAmount, totalAmount, currency, customerDetails, verified: false, stored: false, createdAt: FieldValue.serverTimestamp() })

    return res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, subtotal, discountPercent, discountAmount, totalAmount, products })
  } catch (error) {
    console.error('Online payment order creation error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Product out of stock') || message.startsWith('Only ') || message.startsWith('Size ') || message.startsWith('Please select')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to create online payment order' })
  }
})

app.post('/api/online/check-stock', async (req, res) => {
  try {
    if (!firestore) return res.status(503).json({ success: false, error: 'Server not configured' })
    const items = normalizeCheckoutItems(req.body?.items)
    if (!items.length) return res.status(400).json({ success: false, error: 'At least one product is required' })

    const snapshots = await Promise.all(items.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(item.productId).get()))
    const checkedItems = []

    snapshots.forEach((snapshot, index) => {
      const requested = items[index]
      if (!snapshot.exists) throw new Error(`Product not found: ${requested.productId}`)
      const product = snapshot.data() || {}
      const stock = Number(product.stock ?? product.openingStock ?? 0)
      validateRequestedSize(product, requested)
      if (!Number.isFinite(stock) || stock <= 0) throw new Error(`Insufficient stock for ${String(product.name || requested.productId)}`)
      if (requested.quantity > stock) throw new Error(`Only ${stock} unit(s) available for ${String(product.name || requested.productId)}`)
      const sizes = normalizeSizes(product.sizes)
      const sizeAvailable = sizes.length ? Number(getSizeStock(product)[requested.selectedSize] || 0) : null
      checkedItems.push({ productId: requested.productId, quantity: requested.quantity, selectedSize: requested.selectedSize, stock, sizeAvailable })
    })

    return res.json({ success: true, items: checkedItems })
  } catch (error) {
    console.error('Online stock check error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock') || message.startsWith('Only ') || message.startsWith('Size ') || message.startsWith('Please select')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to check product stock' })
  }
})

app.post('/api/online/complete-order', async (req, res) => {
  try {
    if (!firestore) return res.status(503).json({ success: false, error: 'Server not configured' })

    const paymentOrderId = String(req.body?.orderId || '').trim()
    const requestedStatus = String(req.body?.orderStatus || 'processing').trim() || 'processing'
    if (!paymentOrderId) return res.status(400).json({ success: false, error: 'orderId is required' })

    const intentRef = firestore.collection(PAYMENT_INTENT_COLLECTION).doc(paymentOrderId)
    const intentSnapshot = await intentRef.get()
    if (!intentSnapshot.exists) return res.status(404).json({ success: false, error: 'Payment intent not found' })

    const intent = intentSnapshot.data() || {}
    if (!intent.verified || !intent.paymentId) return res.status(400).json({ success: false, error: 'Payment must be verified before completing the order' })
    if (intent.inventoryProcessed && intent.orderDocumentId) return res.json({ success: true, message: 'Order already completed', orderDocumentId: intent.orderDocumentId })

    const sourceItems = Array.isArray(intent.products) ? intent.products : []
    if (!sourceItems.length) return res.status(400).json({ success: false, error: 'No products found in payment intent' })

    const orderRef = firestore.collection(ORDER_COLLECTION).doc()
    const inventoryRefs = sourceItems.map(() => firestore.collection(INVENTORY_TRANSACTION_COLLECTION).doc())

    const result = await firestore.runTransaction(async (transaction) => {
      const productRefs = sourceItems.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(String(item.productId)))
      const snapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)))
      const products = []
      let totalCost = 0

      snapshots.forEach((snapshot, index) => {
        const requested = sourceItems[index]
        if (!snapshot.exists) throw new Error(`Product not found: ${requested.productId}`)
        const product = snapshot.data() || {}
        const quantity = Math.min(1, Math.max(1, Number(requested.quantity || 1)))
        const currentStock = Number(product.stock ?? product.openingStock ?? 0)
        const purchasePrice = money(product.purchasePrice ?? product.prchPrice ?? product.costPrice)
        const sizes = normalizeSizes(product.sizes)
        const sizeStock = sizes.length ? getSizeStock(product) : {}
        if (sizes.length) {
          if (requested.selectedSize === 'N/A' || !sizes.includes(String(requested.selectedSize || '').trim())) throw new Error(`Please select a valid size for ${String(product.name || requested.productId)}`)
          if (Number(sizeStock[requested.selectedSize] || 0) <= 0) throw new Error(`Size ${requested.selectedSize} is sold out for ${String(product.name || requested.productId)}`)
        }
        if (!Number.isFinite(currentStock) || currentStock < quantity) throw new Error(`Insufficient stock for ${String(product.name || requested.productId)}`)
        const unitPrice = money(product.price ?? requested.unitPrice)
        const nextStock = currentStock - quantity
        const nextSizeStock = sizes.length ? { ...sizeStock, [requested.selectedSize]: 0 } : null
        products.push({ productId: String(requested.productId), name: String(product.name || requested.name || 'Product').trim() || 'Product', imageUrl: String(product.imageUrl || product.image || requested.imageUrl || '').trim(), selectedSize: String(requested.selectedSize || 'N/A').trim() || 'N/A', quantity, unitPrice, purchasePrice, lineTotal: money(unitPrice * quantity) })
        totalCost += purchasePrice * quantity
        transaction.update(productRefs[index], sizes.length ? { stock: nextStock, sizeStock: nextSizeStock, updatedAt: FieldValue.serverTimestamp() } : { stock: nextStock, updatedAt: FieldValue.serverTimestamp() })
        transaction.set(inventoryRefs[index], { productId: String(requested.productId), type: 'sale', quantity: -quantity, stockBefore: currentStock, stockAfter: nextStock, selectedSize: String(requested.selectedSize || 'N/A').trim() || 'N/A', referenceId: orderRef.id, billNo: paymentOrderId, reason: 'Online Razorpay sale', paymentOrderId, createdAt: FieldValue.serverTimestamp() })
      })

      const totalAmount = money(intent.totalAmount)
      const discountAmount = money(intent.discountAmount)
      const discountPercent = normalizeDiscountPercent(intent.discountPercent)
      const subtotal = money(intent.subtotal || (totalAmount + discountAmount))
      const profit = money(totalAmount - totalCost)
      transaction.set(orderRef, { userId: String(intent.userId || 'guest').trim() || 'guest', products, subtotal, discountPercent, discountAmount, totalAmount, currency: String(intent.currency || 'INR').trim() || 'INR', paymentId: String(intent.paymentId), paymentOrderId, paymentStatus: 'paid', paymentMethod: 'razorpay', orderStatus: requestedStatus, customerDetails: intent.customerDetails || {}, cost: money(totalCost), profit, margin: totalAmount > 0 ? money((profit / totalAmount) * 100) : 0, inventoryProcessed: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      transaction.set(intentRef, { stored: true, inventoryProcessed: true, orderDocumentId: orderRef.id, completedAt: FieldValue.serverTimestamp() }, { merge: true })
      return { orderDocumentId: orderRef.id, totalAmount, cost: money(totalCost), profit, subtotal, discountPercent, discountAmount }
    })

    return res.status(201).json({ success: true, ...result })
  } catch (error) {
    console.error('Online order completion error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock') || message.startsWith('Size ') || message.startsWith('Please select')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to complete online order' })
  }
})

const currentModulePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (executedFilePath && executedFilePath === currentModulePath) {
  const port = Number(process.env.PORT || 5000)
  app.listen(port, () => console.info(`Online + POS backend running on http://localhost:${port}`))
}