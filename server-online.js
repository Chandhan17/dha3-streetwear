import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { getApps } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import './server-pos.js'
import { app, getRuntimeDependencies } from './server.js'

const PRODUCT_COLLECTION = 'products'
const ORDER_COLLECTION = 'orders'
const PAYMENT_INTENT_COLLECTION = 'paymentIntents'
const INVENTORY_TRANSACTION_COLLECTION = 'inventory_transactions'
const ONLINE_RESERVATION_COLLECTION = 'online_reservations'
const ONLINE_RESERVATION_TTL_MS = 15 * 60 * 1000

const firestore = getApps().length > 0 ? getFirestore(getApps()[0]) : null

function reservationDocumentId(productId, selectedSize) {
  return encodeURIComponent(String(productId) + '::' + String(selectedSize))
}

function reservationExpiresAt() {
  return Timestamp.fromMillis(Date.now() + ONLINE_RESERVATION_TTL_MS)
}

function getTimestampMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

async function reserveOnlineSizeStock(items, reservationToken) {
  if (!firestore) throw new Error('Server not configured')
  const token = String(reservationToken || '').trim()
  if (!token) throw new Error('Checkout reservation token is required')
  const sizedItems = items.filter((item) => String(item.selectedSize || 'N/A').trim() !== 'N/A')
  if (!sizedItems.length) return { reservationKeys: [], expiresAt: null }
  const productRefs = sizedItems.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(item.productId))
  const reservationRefs = sizedItems.map((item) => firestore.collection(ONLINE_RESERVATION_COLLECTION).doc(reservationDocumentId(item.productId, item.selectedSize)))
  const expiresAt = reservationExpiresAt()
  return firestore.runTransaction(async (transaction) => {
    const productSnapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)))
    const reservationSnapshots = await Promise.all(reservationRefs.map((ref) => transaction.get(ref)))
    const reservationKeys = []
    productSnapshots.forEach((snapshot, index) => {
      const requested = sizedItems[index]
      if (!snapshot.exists) throw new Error('Product not found: ' + requested.productId)
      const product = snapshot.data() || {}
      const sizes = getSizeLabels(product)
      const matchedSize = findMatchedSize(sizes, requested.selectedSize)
      if (!matchedSize) throw new Error('Please select a valid size for ' + String(product.name || requested.productId))
      const sizeStock = getSizeStock(product)
      const stockKey = Object.keys(sizeStock).find((key) => sameSize(key, matchedSize))
      const available = Number(stockKey === undefined ? 0 : sizeStock[stockKey])
      if (available <= 0) throw new Error('Size ' + matchedSize + ' is sold out for ' + String(product.name || requested.productId))
      if (requested.quantity > 1) throw new Error('Only 1 unit of size ' + matchedSize + ' is available for ' + String(product.name || requested.productId))
      const reservationSnapshot = reservationSnapshots[index]
      const reservationData = reservationSnapshot.exists ? reservationSnapshot.data() || {} : {}
      const activeUntil = getTimestampMillis(reservationData.expiresAt)
      if (reservationSnapshot.exists && activeUntil > Date.now() && String(reservationData.reservationToken || '') !== token) {
        throw new Error('Size ' + matchedSize + ' of ' + String(product.name || requested.productId) + ' is currently being purchased by another customer. Please try again shortly.')
      }
      transaction.set(reservationRefs[index], { productId: requested.productId, selectedSize: matchedSize, reservationToken: token, reservedAt: FieldValue.serverTimestamp(), expiresAt, verified: false, paymentOrderId: '' })
      reservationKeys.push(requested.productId + '::' + matchedSize)
    })
    return { reservationKeys, expiresAt: expiresAt.toDate().toISOString() }
  })
}

async function releaseOnlineReservations(reservationKeys, reservationToken) {
  if (!firestore) return
  const token = String(reservationToken || '').trim()
  if (!token || !Array.isArray(reservationKeys) || reservationKeys.length === 0) return
  const refs = reservationKeys.map((key) => {
    const parts = String(key).split('::')
    const productId = parts.shift() || ''
    return firestore.collection(ONLINE_RESERVATION_COLLECTION).doc(reservationDocumentId(productId, parts.join('::')))
  })
  await firestore.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return
      const data = snapshot.data() || {}
      if (String(data.reservationToken || '') === token && !data.verified) transaction.delete(refs[index])
    })
  })
}

async function markOnlineReservationsVerified(reservationKeys, reservationToken, paymentOrderId) {
  if (!firestore || !Array.isArray(reservationKeys) || reservationKeys.length === 0) return
  const token = String(reservationToken || '').trim()
  if (!token) throw new Error('Checkout reservation token is required')
  const refs = reservationKeys.map((key) => {
    const parts = String(key).split('::')
    const productId = parts.shift() || ''
    return firestore.collection(ONLINE_RESERVATION_COLLECTION).doc(reservationDocumentId(productId, parts.join('::')))
  })
  const extendedExpiry = reservationExpiresAt()
  await firestore.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) throw new Error('Checkout reservation expired. Please try again.')
      const data = snapshot.data() || {}
      if (String(data.reservationToken || '') !== token) throw new Error('Checkout reservation is no longer available.')
      if (getTimestampMillis(data.expiresAt) <= Date.now()) throw new Error('Checkout reservation expired. Please try again.')
      transaction.set(refs[index], { verified: true, paymentOrderId, expiresAt: extendedExpiry, verifiedAt: FieldValue.serverTimestamp() }, { merge: true })
    })
  })
}
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

function normalizeSizeValue(item) {
  if (typeof item === 'string' || typeof item === 'number') return String(item).trim()
  if (item && typeof item === 'object') {
    const candidate = item.size ?? item.value ?? item.label ?? item.name
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate).trim()
  }
  return ''
}

function normalizeSizes(value) {
  if (Array.isArray(value)) return [...new Set(value.map(normalizeSizeValue).filter(Boolean))]
  if (typeof value === 'string') return [...new Set(value.split(',').map((item) => String(item || '').trim()).filter(Boolean))]
  if (value && typeof value === 'object') return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([size]) => String(size || '').trim()).filter(Boolean)
  return []
}

function normalizeSelectedSize(value) {
  return String(value ?? '').trim()
}

function sameSize(left, right) {
  const a = normalizeSelectedSize(left)
  const b = normalizeSelectedSize(right)
  if (!a || !b) return false
  if (a.toLowerCase() === b.toLowerCase()) return true
  const numericA = Number(a)
  const numericB = Number(b)
  return Number.isFinite(numericA) && Number.isFinite(numericB) && numericA === numericB
}

function getRawSizeStock(product) {
  return product?.sizeStock && typeof product.sizeStock === 'object' && !Array.isArray(product.sizeStock) ? product.sizeStock : {}
}

function getSizeLabels(product) {
  const sizes = normalizeSizes(product?.sizes)
  const stockKeys = Object.keys(getRawSizeStock(product)).map((size) => String(size).trim()).filter(Boolean)
  return [...new Set([...sizes, ...stockKeys])]
}

function getSizeStock(product) {
  const sizes = getSizeLabels(product)
  if (!sizes.length) return {}
  const source = getRawSizeStock(product)
  return Object.fromEntries(sizes.map((size) => {
    const sourceKey = Object.keys(source).find((key) => sameSize(key, size))
    const rawValue = sourceKey === undefined ? 1 : source[sourceKey]
    return [size, Number(rawValue) > 0 ? 1 : 0]
  }))
}

function findMatchedSize(sizes, selectedSize) {
  return sizes.find((size) => sameSize(size, selectedSize)) || null
}

function validateRequestedSize(product, requested) {
  const sizes = getSizeLabels(product)
  if (!sizes.length) return

  const selectedSize = normalizeSelectedSize(requested?.selectedSize)
  const matchedSize = findMatchedSize(sizes, selectedSize)
  if (!selectedSize || selectedSize === 'N/A' || !matchedSize) {
    throw new Error(`Please select a valid size for ${String(product.name || requested.productId)}`)
  }

  const sizeStock = getSizeStock(product)
  const stockKey = Object.keys(sizeStock).find((key) => sameSize(key, matchedSize))
  const available = Number(stockKey === undefined ? 0 : sizeStock[stockKey])
  if (available <= 0) throw new Error(`Size ${selectedSize} is sold out for ${String(product.name || requested.productId)}`)
  if (requested.quantity > available) throw new Error(`Only 1 unit of size ${selectedSize} is available for ${String(product.name || requested.productId)}`)
}

async function buildDiscountedPaymentIntent(items, discountPercent) {
  if (!firestore) throw new Error('Server not configured')
  const snapshots = await Promise.all(items.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(item.productId).get()))
  const products = snapshots.map((snapshot, index) => {
    const requested = items[index]
    if (!snapshot.exists) throw new Error(`Product not found: ${requested.productId}`)
    const product = snapshot.data() || {}
    const baseUnitPrice = money(product.price ?? product.salePrice)
    const productDiscountPercent = normalizeDiscountPercent(product.discountPercent ?? product.discount ?? 0)
    const unitPrice = money(baseUnitPrice * (1 - productDiscountPercent / 100))
    const stock = Number(product.stock ?? product.openingStock ?? 0)
    if (unitPrice <= 0) throw new Error(`Invalid sale price for ${String(product.name || requested.productId)}`)
    validateRequestedSize(product, requested)
    if (!Number.isFinite(stock) || stock <= 0) throw new Error(`Product out of stock: ${String(product.name || requested.productId)}`)
    if (requested.quantity > stock) throw new Error(`Only ${stock} unit(s) available for ${String(product.name || requested.productId)}`)
    const matchedSize = findMatchedSize(getSizeLabels(product), requested.selectedSize)
    return {
      productId: requested.productId,
      name: String(product.name || 'Product').trim() || 'Product',
      imageUrl: String(product.imageUrl || product.image || '').trim(),
      selectedSize: normalizeSelectedSize(matchedSize || requested.selectedSize) || 'N/A',
      quantity: requested.quantity,
      baseUnitPrice,
      productDiscountPercent,
      unitPrice,
      lineTotal: money(unitPrice * requested.quantity),
    }
  })
  const baseSubtotal = money(products.reduce((sum, item) => sum + item.baseUnitPrice * item.quantity, 0))
  const subtotal = money(products.reduce((sum, item) => sum + item.lineTotal, 0))
  const productDiscountAmount = money(baseSubtotal - subtotal)
  const safeDiscountPercent = normalizeDiscountPercent(discountPercent)
  const orderDiscountAmount = money(Math.min(subtotal, subtotal * safeDiscountPercent / 100))
  const discountAmount = money(productDiscountAmount + orderDiscountAmount)
  const totalAmount = money(subtotal - orderDiscountAmount)
  if (subtotal <= 0 || totalAmount <= 0) throw new Error('Calculated amount is invalid')
  return { products, baseSubtotal, subtotal, discountPercent: safeDiscountPercent, productDiscountAmount, orderDiscountAmount, discountAmount, totalAmount }
}

app.post('/api/online/create-payment-order', async (req, res) => {
  let reservationToken = String(req.body?.reservationToken || '').trim()
  let reservationKeys = []
  try {
    if (!firestore) return res.status(503).json({ success: false, error: 'Server not configured' })
    const { razorpay } = getRuntimeDependencies()
    if (!razorpay) return res.status(503).json({ success: false, error: 'Payment service not configured' })
    reservationToken = reservationToken || randomUUID()
    const items = normalizeCheckoutItems(req.body?.items)
    if (!items.length) return res.status(400).json({ success: false, error: 'At least one product is required' })
    const currency = String(req.body?.currency || 'INR').trim() || 'INR'
    const userId = String(req.body?.userId || 'guest').trim() || 'guest'
    const customerDetails = req.body?.customerDetails && typeof req.body.customerDetails === 'object' ? req.body.customerDetails : {}
    const reservation = await reserveOnlineSizeStock(items, reservationToken)
    reservationKeys = reservation.reservationKeys
    const { products, baseSubtotal, subtotal, discountPercent, productDiscountAmount, orderDiscountAmount, discountAmount, totalAmount } = await buildDiscountedPaymentIntent(items, req.body?.discountPercent)
    const order = await razorpay.orders.create({ amount: Math.round(totalAmount * 100), currency, receipt: 'receipt_' + Date.now(), notes: { itemCount: String(products.length), discountPercent: String(discountPercent) } })
    await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(order.id).set({ userId, products, baseSubtotal, subtotal, discountPercent, productDiscountAmount, orderDiscountAmount, discountAmount, totalAmount, currency, customerDetails, verified: false, stored: false, reservationToken, reservationKeys, reservationExpiresAt: reservation.expiresAt || null, createdAt: FieldValue.serverTimestamp() })
    return res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, baseSubtotal, subtotal, discountPercent, productDiscountAmount, orderDiscountAmount, discountAmount, totalAmount, products, reservationKeys, reservationExpiresAt: reservation.expiresAt || null })
  } catch (error) {
    if (reservationKeys.length > 0) {
      try { await releaseOnlineReservations(reservationKeys, reservationToken) } catch (releaseError) { console.error('Reservation release after payment-order failure failed:', releaseError) }
    }
    console.error('Online payment order creation error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Product out of stock') || message.startsWith('Only ') || message.startsWith('Size ') || message.startsWith('Please select') || message.startsWith('Checkout reservation')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to create online payment order' })
  }
})
app.post('/api/online/release-reservations', async (req, res) => {
  try {
    const reservationToken = String(req.body?.reservationToken || '').trim()
    const reservationKeys = Array.isArray(req.body?.reservationKeys) ? req.body.reservationKeys : []
    if (!reservationToken) return res.status(400).json({ success: false, error: 'Checkout reservation token is required' })
    await releaseOnlineReservations(reservationKeys, reservationToken)
    return res.json({ success: true })
  } catch (error) {
    console.error('Online reservation release error:', error)
    return res.status(500).json({ success: false, error: 'Failed to release checkout reservation' })
  }
})
app.post('/api/online/confirm-reservation', async (req, res) => {
  try {
    if (!firestore) return res.status(503).json({ success: false, error: 'Server not configured' })
    const orderId = String(req.body?.orderId || '').trim()
    if (!orderId) return res.status(400).json({ success: false, error: 'orderId is required' })
    const intentSnapshot = await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(orderId).get()
    if (!intentSnapshot.exists) return res.status(404).json({ success: false, error: 'Payment intent not found' })
    const intent = intentSnapshot.data() || {}
    if (!intent.verified) return res.status(400).json({ success: false, error: 'Payment must be verified before confirming reservation' })
    const refreshed = await reserveOnlineSizeStock(Array.isArray(intent.products) ? intent.products : [], String(intent.reservationToken || ''))
    await markOnlineReservationsVerified(refreshed.reservationKeys, String(intent.reservationToken || ''), orderId)
    await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(orderId).set({ reservationKeys: refreshed.reservationKeys, reservationExpiresAt: refreshed.expiresAt || null }, { merge: true })
    return res.json({ success: true, reservationKeys: refreshed.reservationKeys, reservationExpiresAt: refreshed.expiresAt || null })
  } catch (error) {
    console.error('Online reservation confirmation error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Size ') || message.startsWith('Checkout reservation') || message.startsWith('Please select')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to confirm checkout reservation' })
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
      const sizes = getSizeLabels(product)
      const selectedSize = normalizeSelectedSize(requested.selectedSize) || 'N/A'
      const matchedSize = findMatchedSize(sizes, selectedSize) || selectedSize
      const sizeStock = getSizeStock(product)
      const stockKey = Object.keys(sizeStock).find((key) => sameSize(key, matchedSize))
      const sizeAvailable = sizes.length ? Number(stockKey === undefined ? 0 : sizeStock[stockKey]) : null
      checkedItems.push({ productId: requested.productId, quantity: requested.quantity, selectedSize: matchedSize, stock, sizeAvailable })
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
    const reservationKeys = Array.isArray(intent.reservationKeys) ? intent.reservationKeys.map((key) => String(key || '').trim()).filter(Boolean) : []
    const reservationToken = String(intent.reservationToken || '').trim()
    const reservationRefs = reservationKeys.map((key) => {
      const parts = key.split('::')
      const productId = parts.shift() || ''
      return firestore.collection(ONLINE_RESERVATION_COLLECTION).doc(reservationDocumentId(productId, parts.join('::')))
    })

    const result = await firestore.runTransaction(async (transaction) => {
      const productRefs = sourceItems.map((item) => firestore.collection(PRODUCT_COLLECTION).doc(String(item.productId)))
      const snapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)))
      const reservationSnapshots = await Promise.all(reservationRefs.map((ref) => transaction.get(ref)))
      const reservationSnapshotByKey = new Map(reservationKeys.map((key, index) => [key, reservationSnapshots[index]]))
      const products = []
      let totalCost = 0
      const pendingProductUpdates = new Map()

      snapshots.forEach((snapshot, index) => {
        const requested = sourceItems[index]
        if (!snapshot.exists) throw new Error(`Product not found: ${requested.productId}`)
        const product = snapshot.data() || {}
        const quantity = Math.min(1, Math.max(1, Number(requested.quantity || 1)))
        const currentStock = Number(product.stock ?? product.openingStock ?? 0)
        const purchasePrice = money(product.purchasePrice ?? product.prchPrice ?? product.costPrice)
        const sizes = getSizeLabels(product)
        const sizeStock = getSizeStock(product)
        const selectedSize = normalizeSelectedSize(requested.selectedSize) || 'N/A'
        let canonicalSize = selectedSize

        if (sizes.length) {
          const matchedSize = findMatchedSize(sizes, selectedSize)
          if (!matchedSize) throw new Error(`Please select a valid size for ${String(product.name || requested.productId)}`)
          const stockKey = Object.keys(sizeStock).find((key) => sameSize(key, matchedSize))
          if (Number(stockKey === undefined ? 0 : sizeStock[stockKey]) <= 0) throw new Error(`Size ${selectedSize} is sold out for ${String(product.name || requested.productId)}`)
          canonicalSize = matchedSize
        }

        if (sizes.length) {
          const reservationKey = String(requested.productId) + '::' + canonicalSize
          const reservationSnapshot = reservationSnapshotByKey.get(reservationKey)
          const reservationData = reservationSnapshot?.exists ? reservationSnapshot.data() || {} : {}
          if (!reservationSnapshot?.exists || String(reservationData.reservationToken || '') !== reservationToken || !reservationData.verified || getTimestampMillis(reservationData.expiresAt) <= Date.now()) {
            throw new Error('Reservation expired for size ' + canonicalSize + ' of ' + String(product.name || requested.productId) + '. Please try again.')
          }
        }

        if (!Number.isFinite(currentStock) || currentStock < quantity) throw new Error(`Insufficient stock for ${String(product.name || requested.productId)}`)

        const unitPrice = money(product.price ?? requested.unitPrice)
        const existingUpdate = pendingProductUpdates.get(String(requested.productId)) || { nextStock: currentStock, sizeStock: sizes.length ? { ...sizeStock } : null }
        const nextStock = existingUpdate.nextStock - quantity

        if (sizes.length) {
          const matchedSize = findMatchedSize(sizes, selectedSize) || selectedSize
          const existingKey = Object.keys(existingUpdate.sizeStock || {}).find((key) => sameSize(key, matchedSize))
          const targetKey = existingKey || matchedSize
          if (Number(existingUpdate.sizeStock?.[targetKey]) <= 0) throw new Error(`Size ${selectedSize} is sold out for ${String(product.name || requested.productId)}`)
          existingUpdate.sizeStock[targetKey] = 0
        }

        existingUpdate.nextStock = nextStock
        pendingProductUpdates.set(String(requested.productId), existingUpdate)

        products.push({ productId: String(requested.productId), name: String(product.name || requested.name || 'Product').trim() || 'Product', imageUrl: String(product.imageUrl || product.image || requested.imageUrl || '').trim(), selectedSize: canonicalSize, quantity, unitPrice, purchasePrice, lineTotal: money(unitPrice * quantity) })
        totalCost += purchasePrice * quantity

        transaction.set(inventoryRefs[index], { productId: String(requested.productId), type: 'sale', quantity: -quantity, stockBefore: currentStock, stockAfter: nextStock, selectedSize: canonicalSize, referenceId: orderRef.id, billNo: paymentOrderId, reason: 'Online Razorpay sale', paymentOrderId, createdAt: FieldValue.serverTimestamp() })
      })

      pendingProductUpdates.forEach((update, productId) => {
        const productRef = firestore.collection(PRODUCT_COLLECTION).doc(productId)
        transaction.update(productRef, update.sizeStock ? { stock: update.nextStock, sizeStock: update.sizeStock, updatedAt: FieldValue.serverTimestamp() } : { stock: update.nextStock, updatedAt: FieldValue.serverTimestamp() })
      })

      const totalAmount = money(intent.totalAmount)
      const discountAmount = money(intent.discountAmount)
      const discountPercent = normalizeDiscountPercent(intent.discountPercent)
      const subtotal = money(intent.subtotal || (totalAmount + discountAmount))
      const profit = money(totalAmount - totalCost)
      transaction.set(orderRef, { userId: String(intent.userId || 'guest').trim() || 'guest', products, baseSubtotal: money(intent.baseSubtotal ?? subtotal), subtotal, discountPercent, productDiscountAmount: money(intent.productDiscountAmount), orderDiscountAmount: money(intent.orderDiscountAmount), discountAmount, totalAmount, currency: String(intent.currency || 'INR').trim() || 'INR', paymentId: String(intent.paymentId), paymentOrderId, paymentStatus: 'paid', paymentMethod: 'razorpay', orderStatus: requestedStatus, customerDetails: intent.customerDetails || {}, cost: money(totalCost), profit, margin: totalAmount > 0 ? money((profit / totalAmount) * 100) : 0, inventoryProcessed: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      transaction.set(intentRef, { stored: true, inventoryProcessed: true, orderDocumentId: orderRef.id, completedAt: FieldValue.serverTimestamp() }, { merge: true })
      reservationRefs.forEach((reservationRef) => transaction.delete(reservationRef))
      return { orderDocumentId: orderRef.id, totalAmount, cost: money(totalCost), profit, subtotal, discountPercent, discountAmount }
    })

    return res.status(201).json({ success: true, ...result })
  } catch (error) {
    console.error('Online order completion error:', error)
    const message = String(error?.message || '')
    if (message.startsWith('Product not found') || message.startsWith('Insufficient stock') || message.startsWith('Size ') || message.startsWith('Please select') || message.startsWith('Reservation expired')) return res.status(409).json({ success: false, error: message })
    return res.status(500).json({ success: false, error: 'Failed to complete online order' })
  }
})

const currentModulePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (executedFilePath && executedFilePath === currentModulePath) {
  const port = Number(process.env.PORT || 5000)
  app.listen(port, () => console.info(`Online + POS backend running on http://localhost:${port}`))
}
