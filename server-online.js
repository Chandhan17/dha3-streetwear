import path from 'path'
import { fileURLToPath } from 'url'
import { getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import './server-pos.js'
import { app } from './server.js'

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
    if (!productId || !Number.isFinite(quantity)) return
    merged.set(productId, (merged.get(productId) || 0) + quantity)
  })
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }))
}

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
      if (!Number.isFinite(stock) || stock <= 0) throw new Error(`Insufficient stock for ${String(product.name || requested.productId)}`)
      if (requested.quantity > stock) throw new Error(`Only ${stock} unit(s) available for ${String(product.name || requested.productId)}`)
      checkedItems.push({ productId: requested.productId, quantity: requested.quantity, stock })
    })

    return res.json({ success: true, items: checkedItems })
  } catch (error) {
    console.error('Online stock check error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock') || message.startsWith('Only ')) {
      return res.status(409).json({ success: false, error: message })
    }
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
        const quantity = Math.max(1, Number(requested.quantity || 1))
        const currentStock = Number(product.stock ?? product.openingStock ?? 0)
        const purchasePrice = money(product.purchasePrice ?? product.prchPrice ?? product.costPrice)
        if (!Number.isFinite(currentStock) || currentStock < quantity) throw new Error(`Insufficient stock for ${String(product.name || requested.productId)}`)
        const newStock = currentStock - quantity
        const unitPrice = money(product.price ?? requested.unitPrice)
        products.push({ productId: String(requested.productId), name: String(product.name || requested.name || 'Product').trim() || 'Product', imageUrl: String(product.imageUrl || product.image || requested.imageUrl || '').trim(), selectedSize: String(requested.selectedSize || 'N/A').trim() || 'N/A', quantity, unitPrice, purchasePrice, lineTotal: money(unitPrice * quantity) })
        totalCost += purchasePrice * quantity
        transaction.update(productRefs[index], { stock: newStock, updatedAt: FieldValue.serverTimestamp() })
        transaction.set(inventoryRefs[index], { productId: String(requested.productId), type: 'sale', quantity: -quantity, stockBefore: currentStock, stockAfter: newStock, referenceId: orderRef.id, billNo: paymentOrderId, reason: 'Online Razorpay sale', paymentOrderId, createdAt: FieldValue.serverTimestamp() })
      })

      const totalAmount = money(intent.totalAmount)
      const profit = money(totalAmount - totalCost)
      transaction.set(orderRef, { userId: String(intent.userId || 'guest').trim() || 'guest', products, totalAmount, currency: String(intent.currency || 'INR').trim() || 'INR', paymentId: String(intent.paymentId), paymentOrderId, paymentStatus: 'paid', paymentMethod: 'razorpay', orderStatus: requestedStatus, customerDetails: intent.customerDetails || {}, cost: money(totalCost), profit, margin: totalAmount > 0 ? money((profit / totalAmount) * 100) : 0, inventoryProcessed: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      transaction.set(intentRef, { stored: true, inventoryProcessed: true, orderDocumentId: orderRef.id, completedAt: FieldValue.serverTimestamp() }, { merge: true })
      return { orderDocumentId: orderRef.id, totalAmount, cost: money(totalCost), profit }
    })

    return res.status(201).json({ success: true, ...result })
  } catch (error) {
    console.error('Online order completion error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to complete online order' })
  }
})

const currentModulePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (executedFilePath && executedFilePath === currentModulePath) {
  const port = Number(process.env.PORT || 5000)
  app.listen(port, () => console.info(`Online + POS backend running on http://localhost:${port}`))
}
