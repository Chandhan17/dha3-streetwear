import assert from 'node:assert/strict'
import crypto from 'crypto'
import test from 'node:test'

process.env.SKIP_FIREBASE_INIT = 'true'

const { isSignatureValid } = await import('../server.js')

const secret = 'test_secret_key'
process.env.RAZORPAY_KEY_SECRET = secret

test('isSignatureValid accepts valid Razorpay signature', async () => {
  const orderId = 'order_123'
  const paymentId = 'pay_123'
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  assert.equal(isSignatureValid(orderId, paymentId, signature), true)
})

test('isSignatureValid rejects invalid Razorpay signature', async () => {
  assert.equal(isSignatureValid('order_123', 'pay_123', 'invalid_signature'), false)
})
