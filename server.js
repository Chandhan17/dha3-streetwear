import express from 'express'
import Razorpay from 'razorpay'
import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cors())

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' })
})

// Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', productName } = req.body

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' })
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        productName,
      },
    }

    const order = await razorpay.orders.create(options)

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    console.error('Order creation error:', error)
    res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
    })
  }
})

// Verify Razorpay Payment
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification details',
      })
    }

    // Verify signature
    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureBody)
      .digest('hex')

    const isSignatureValid = expectedSignature === razorpay_signature

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed - invalid signature',
      })
    }

    // Payment verified successfully
    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      message: error.message,
    })
  }
})

// Store order in database (optional - for future enhancement)
app.post('/api/store-order', async (req, res) => {
  try {
    const { customerId, paymentId, orderId, amount, productDetails, customerDetails } = req.body

    // TODO: Store in Firestore
    // This endpoint can be used to save order details to Firestore
    // after payment verification

    res.json({
      success: true,
      message: 'Order stored successfully',
      orderId,
    })
  } catch (error) {
    console.error('Store order error:', error)
    res.status(500).json({
      error: 'Failed to store order',
      message: error.message,
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Razorpay Key ID: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured'}`)
})
