import assert from 'node:assert/strict'
import test from 'node:test'

process.env.SKIP_FIREBASE_INIT = 'true'

const { normalizeOrderItems } = await import('../server.js')

test('normalizeOrderItems supports a single product payload', async () => {
  const normalized = normalizeOrderItems({
    productId: 'product_1',
    quantity: 2,
    selectedSize: 'M',
  })

  assert.deepEqual(normalized, [
    {
      productId: 'product_1',
      quantity: 2,
      selectedSize: 'M',
    },
  ])
})

test('normalizeOrderItems supports cart item arrays', async () => {
  const normalized = normalizeOrderItems({
    items: [
      { productId: 'product_1', quantity: 1, selectedSize: 'S' },
      { productId: 'product_2', quantity: 3, selectedSize: 'L' },
    ],
  })

  assert.deepEqual(normalized, [
    {
      productId: 'product_1',
      quantity: 1,
      selectedSize: 'S',
    },
    {
      productId: 'product_2',
      quantity: 3,
      selectedSize: 'L',
    },
  ])
})
