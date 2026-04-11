import assert from 'node:assert/strict'
import crypto from 'crypto'
import test from 'node:test'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.SKIP_FIREBASE_INIT = 'true'
process.env.RAZORPAY_KEY_SECRET = 'integration_test_secret'

const { app, setRuntimeDependenciesForTests } = await import('../server.js')

function createFakeFirestore(seed = {}) {
  const collections = new Map(Object.entries(seed).map(([key, value]) => [key, new Map(Object.entries(value))]))

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, new Map())
    }

    return collections.get(name)
  }

  function createSnapshot(id, value) {
    return {
      id,
      exists: value !== undefined,
      data() {
        return value === undefined ? undefined : structuredClone(value)
      },
    }
  }

  function createCollectionApi(name) {
    const collectionMap = ensureCollection(name)

    return {
      doc(id) {
        return {
          async get() {
            return createSnapshot(id, collectionMap.get(id))
          },
          async set(payload, options = {}) {
            const previous = collectionMap.get(id) || {}
            const next = options.merge ? { ...previous, ...payload } : { ...payload }
            collectionMap.set(id, next)
          },
          async delete() {
            collectionMap.delete(id)
          },
        }
      },
      async add(payload) {
        const newId = `${name}_${collectionMap.size + 1}`
        collectionMap.set(newId, { ...payload })
        return { id: newId }
      },
      orderBy() {
        return this
      },
      limit(maxItems) {
        this.__limit = maxItems
        return this
      },
      async get() {
        const docs = [...collectionMap.entries()]
          .slice(0, this.__limit || Number.MAX_SAFE_INTEGER)
          .map(([id, value]) => ({
            id,
            data() {
              return structuredClone(value)
            },
          }))

        return { docs }
      },
    }
  }

  return {
    collection(name) {
      return createCollectionApi(name)
    },
  }
}

const fakeFirestore = createFakeFirestore({
  products: {
    p1: { name: 'Street Tee', price: 1000, imageUrl: 'https://cdn.example/p1.jpg' },
  },
  users: {
    'admin-1': { role: 'admin' },
    'user-1': { role: 'user' },
  },
})

const fakeRazorpay = {
  orders: {
    async create({ amount, currency }) {
      return {
        id: 'order_test_1',
        amount,
        currency,
      }
    },
  },
}

const fakeAdminAuth = {
  async verifyIdToken(token) {
    if (token === 'admin-token') {
      return { uid: 'admin-1', email: 'admin@example.com' }
    }

    if (token === 'user-token') {
      return { uid: 'user-1', email: 'user@example.com' }
    }

    throw new Error('Invalid token')
  },
}

setRuntimeDependenciesForTests({
  firestore: fakeFirestore,
  razorpay: fakeRazorpay,
  adminAuth: fakeAdminAuth,
})

test('payment flow: create order, reject invalid signature, verify valid signature, then store', async () => {
  const createOrderResponse = await request(app)
    .post('/api/create-order')
    .send({
      productId: 'p1',
      quantity: 2,
      userId: 'user-1',
      customerDetails: { name: 'Test User', phone: '9999999999' },
    })

  assert.equal(createOrderResponse.status, 200)
  assert.equal(createOrderResponse.body.success, true)
  assert.equal(createOrderResponse.body.amount, 200000)
  assert.equal(createOrderResponse.body.orderId, 'order_test_1')

  const preStoreResponse = await request(app)
    .post('/api/store-order')
    .send({ orderId: 'order_test_1' })

  assert.equal(preStoreResponse.status, 400)
  assert.equal(preStoreResponse.body.success, false)

  const invalidVerifyResponse = await request(app)
    .post('/api/verify-payment')
    .send({
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: 'pay_invalid',
      razorpay_signature: 'bad_signature',
    })

  assert.equal(invalidVerifyResponse.status, 400)
  assert.equal(invalidVerifyResponse.body.success, false)

  const paymentId = 'pay_valid_1'
  const validSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`order_test_1|${paymentId}`)
    .digest('hex')

  const validVerifyResponse = await request(app)
    .post('/api/verify-payment')
    .send({
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
    })

  assert.equal(validVerifyResponse.status, 200)
  assert.equal(validVerifyResponse.body.success, true)

  const storeResponse = await request(app)
    .post('/api/store-order')
    .send({ orderId: 'order_test_1', orderStatus: 'processing' })

  assert.equal(storeResponse.status, 200)
  assert.equal(storeResponse.body.success, true)
})

test('admin routes reject unauthenticated and non-admin callers', async () => {
  const noAuthResponse = await request(app).get('/admin/orders')
  assert.equal(noAuthResponse.status, 401)

  const userResponse = await request(app)
    .get('/admin/orders')
    .set('Authorization', 'Bearer user-token')

  assert.equal(userResponse.status, 403)
})

test('admin routes allow admin caller', async () => {
  const adminListResponse = await request(app)
    .get('/admin/orders')
    .set('Authorization', 'Bearer admin-token')

  assert.equal(adminListResponse.status, 200)
  assert.equal(adminListResponse.body.success, true)

  const adminUpdateResponse = await request(app)
    .put('/admin/order/orders_1')
    .set('Authorization', 'Bearer admin-token')
    .send({ orderStatus: 'completed' })

  assert.equal(adminUpdateResponse.status, 200)
  assert.equal(adminUpdateResponse.body.success, true)
}
)