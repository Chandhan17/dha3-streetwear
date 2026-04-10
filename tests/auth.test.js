import assert from 'node:assert/strict'
import test from 'node:test'

process.env.SKIP_FIREBASE_INIT = 'true'

const { isAdmin } = await import('../server.js')

function createMockResponse() {
  const state = {
    statusCode: 200,
    body: null,
  }

  return {
    state,
    status(code) {
      state.statusCode = code
      return this
    },
    json(payload) {
      state.body = payload
      return this
    },
  }
}

test('isAdmin allows admin users', async () => {
  const req = { user: { role: 'admin' } }
  const res = createMockResponse()
  let called = false

  isAdmin(req, res, () => {
    called = true
  })

  assert.equal(called, true)
  assert.equal(res.state.statusCode, 200)
  assert.equal(res.state.body, null)
})

test('isAdmin rejects non-admin users', async () => {
  const req = { user: { role: 'user' } }
  const res = createMockResponse()
  let called = false

  isAdmin(req, res, () => {
    called = true
  })

  assert.equal(called, false)
  assert.equal(res.state.statusCode, 403)
  assert.deepEqual(res.state.body, { success: false, message: 'Access denied' })
})
