import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import helmet from 'helmet'
import Razorpay from 'razorpay'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT || 5000)
const PRODUCT_COLLECTION = 'products'
const ORDER_COLLECTION = 'orders'
const PAYMENT_INTENT_COLLECTION = 'paymentIntents'

const requiredRazorpayVariables = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
requiredRazorpayVariables.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[config] Missing environment variable: ${key}`)
  }
})

function getAllowedOrigins() {
  const configuredOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (configuredOrigins.length > 0) {
    return configuredOrigins
  }

  return ['http://localhost:5173', 'https://yourdomain.com']
}

function initializeFirebaseAdmin() {
  if (String(process.env.SKIP_FIREBASE_INIT || '').toLowerCase() === 'true') {
    return null
  }

  if (getApps().length > 0) {
    return getApps()[0]
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
    )
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

const firebaseApp = initializeFirebaseAdmin()
const firestore = firebaseApp ? getFirestore(firebaseApp) : null
const adminAuth = firebaseApp ? getAuth(firebaseApp) : null

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const allowedOrigins = getAllowedOrigins()

app.set('trust proxy', 1)
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ limit: '5mb', extended: true }))

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again shortly.',
  },
})

const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests. Please try again shortly.',
  },
})

app.use(globalRateLimit)

function normalizeOrderItems(payload) {
  if (Array.isArray(payload?.items) && payload.items.length > 0) {
    return payload.items
      .map((item) => ({
        productId: String(item?.productId || '').trim(),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A',
      }))
      .filter((item) => Boolean(item.productId))
  }

  const productId = String(payload?.productId || '').trim()
  const quantity = Math.max(1, Number(payload?.quantity || 1))
  const selectedSize = String(payload?.selectedSize || 'N/A').trim() || 'N/A'

  if (!productId) {
    return []
  }

  return [{ productId, quantity, selectedSize }]
}

async function buildServerPricedOrder(orderItems) {
  if (!firestore) {
    throw new Error('Database not configured')
  }

  const docs = await Promise.all(
    orderItems.map((item) =>
      firestore.collection(PRODUCT_COLLECTION).doc(item.productId).get(),
    ),
  )

  const products = orderItems.map((item, index) => {
    const productDoc = docs[index]

    if (!productDoc.exists) {
      throw new Error(`Product not found: ${item.productId}`)
    }

    const productData = productDoc.data() || {}
    const unitPrice = Number(productData.price || 0)

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Invalid product price: ${item.productId}`)
    }

    return {
      productId: item.productId,
      name: String(productData.name || 'Product').trim() || 'Product',
      imageUrl: String(productData.imageUrl || productData.image || '').trim(),
      selectedSize: item.selectedSize,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    }
  })

  const totalAmount = products.reduce((sum, product) => sum + product.lineTotal, 0)

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Calculated amount is invalid')
  }

  return { products, totalAmount }
}

function isSignatureValid(orderId, paymentId, incomingSignature) {
  const signatureBody = `${orderId}|${paymentId}`
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(signatureBody)
    .digest('hex')

  if (!incomingSignature || incomingSignature.length !== generatedSignature.length) {
    return false
  }

  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(incomingSignature),
  )
}

async function attachUserFromToken(req, res, next) {
  try {
    if (!adminAuth || !firestore) {
      return res.status(503).json({ success: false, message: 'Server not configured' })
    }

    const authorization = String(req.headers.authorization || '')

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const idToken = authorization.slice(7).trim()

    if (!idToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get()
    const userRole = String(userDoc.data()?.role || '').trim().toLowerCase()

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: userRole || 'user',
    }

    return next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }
}

function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' })
  }

  return next()
}

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' })
})

app.post('/api/create-order', paymentRateLimit, async (req, res) => {
  try {
    if (!firestore) {
      return res.status(503).json({ success: false, error: 'Server not configured' })
    }

    const currency = String(req.body?.currency || 'INR').trim() || 'INR'
    const userId = String(req.body?.userId || 'guest').trim() || 'guest'
    const customerDetails = req.body?.customerDetails && typeof req.body.customerDetails === 'object'
      ? req.body.customerDetails
      : {}

    const orderItems = normalizeOrderItems(req.body)

    if (orderItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Product details are required' })
    }

    const { products, totalAmount } = await buildServerPricedOrder(orderItems)
    const amountInPaise = Math.round(totalAmount * 100)

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        itemCount: String(products.length),
      },
    })

    await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(order.id).set({
      userId,
      products,
      totalAmount,
      currency,
      customerDetails,
      verified: false,
      stored: false,
      createdAt: FieldValue.serverTimestamp(),
    })

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      totalAmount,
      products,
    })
  } catch (error) {
    console.error('Order creation error:', error)
    res.status(500).json({ success: false, error: 'Failed to create order' })
  }
})

app.post('/api/verify-payment', paymentRateLimit, async (req, res) => {
  try {
    if (!firestore) {
      return res.status(503).json({ success: false, error: 'Server not configured' })
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification details',
      })
    }

    const validSignature = isSignatureValid(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    )

    if (!validSignature) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
      })
    }

    await firestore.collection(PAYMENT_INTENT_COLLECTION).doc(razorpay_order_id).set(
      {
        verified: true,
        paymentId: razorpay_payment_id,
        verifiedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    res.status(500).json({ success: false, error: 'Payment verification failed' })
  }
})

app.post('/api/store-order', paymentRateLimit, async (req, res) => {
  try {
    if (!firestore) {
      return res.status(503).json({ success: false, error: 'Server not configured' })
    }

    const orderId = String(req.body?.orderId || '').trim()
    const orderStatus = String(req.body?.orderStatus || 'processing').trim() || 'processing'

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' })
    }

    const intentRef = firestore.collection(PAYMENT_INTENT_COLLECTION).doc(orderId)
    const intentSnapshot = await intentRef.get()

    if (!intentSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Payment intent not found' })
    }

    const intent = intentSnapshot.data() || {}

    if (!intent.verified || !intent.paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment must be verified before storing order',
      })
    }

    if (intent.stored) {
      return res.status(200).json({
        success: true,
        message: 'Order already stored',
        orderId,
        paymentId: intent.paymentId,
        orderDocumentId: intent.orderDocumentId || null,
      })
    }

    const orderPayload = {
      userId: String(intent.userId || 'guest').trim() || 'guest',
      products: Array.isArray(intent.products) ? intent.products : [],
      totalAmount: Number(intent.totalAmount || 0),
      currency: String(intent.currency || 'INR').trim() || 'INR',
      paymentId: String(intent.paymentId || '').trim(),
      paymentOrderId: orderId,
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      orderStatus,
      customerDetails: intent.customerDetails || {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const orderRef = await firestore.collection(ORDER_COLLECTION).add(orderPayload)

    await intentRef.set(
      {
        stored: true,
        orderDocumentId: orderRef.id,
        storedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    res.json({
      success: true,
      message: 'Order stored successfully',
      orderId,
      paymentId: orderPayload.paymentId,
      orderDocumentId: orderRef.id,
    })
  } catch (error) {
    console.error('Store order error:', error)
    res.status(500).json({ success: false, error: 'Failed to store order' })
  }
})

app.get('/api/admin/orders', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const snapshot = await firestore
      .collection(ORDER_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const orders = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    }))

    res.json({ success: true, orders })
  } catch (error) {
    console.error('Admin orders fetch error:', error)
    res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

app.patch('/api/admin/orders/:orderId/status', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const orderId = String(req.params?.orderId || '').trim()
    const orderStatus = String(req.body?.orderStatus || '').trim()

    if (!orderId || !orderStatus) {
      return res.status(400).json({ success: false, message: 'orderId and orderStatus are required' })
    }

    await firestore.collection(ORDER_COLLECTION).doc(orderId).set(
      {
        orderStatus,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    res.json({ success: true, message: 'Order status updated' })
  } catch (error) {
    console.error('Admin order status update error:', error)
    res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

app.post('/api/admin/products', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const product = req.body && typeof req.body === 'object' ? req.body : null

    if (!product || !String(product.name || '').trim()) {
      return res.status(400).json({ success: false, message: 'Valid product payload is required' })
    }

    const payload = {
      ...product,
      price: Number(product.price || 0),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await firestore.collection(PRODUCT_COLLECTION).add(payload)

    res.status(201).json({ success: true, productId: docRef.id })
  } catch (error) {
    console.error('Admin product create error:', error)
    res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

app.put('/api/admin/products/:productId', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const productId = String(req.params?.productId || '').trim()

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' })
    }

    const payload = {
      ...req.body,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'price')) {
      payload.price = Number(payload.price || 0)
    }

    await firestore.collection(PRODUCT_COLLECTION).doc(productId).set(payload, { merge: true })

    res.json({ success: true, message: 'Product updated' })
  } catch (error) {
    console.error('Admin product update error:', error)
    res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

app.delete('/api/admin/products/:productId', attachUserFromToken, isAdmin, async (req, res) => {
  try {
    const productId = String(req.params?.productId || '').trim()

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' })
    }

    await firestore.collection(PRODUCT_COLLECTION).doc(productId).delete()
    res.json({ success: true, message: 'Product deleted' })
  } catch (error) {
    console.error('Admin product delete error:', error)
    res.status(500).json({ success: false, message: 'Something went wrong' })
  }
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Something went wrong' })
  void next
})

export { app, isAdmin, isSignatureValid, normalizeOrderItems }

const currentModulePath = fileURLToPath(import.meta.url)
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (executedFilePath && executedFilePath === currentModulePath) {
  app.listen(PORT, () => {
    console.info(`Server running on http://localhost:${PORT}`)
    console.info(`Razorpay Key ID: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured'}`)
  })
}
