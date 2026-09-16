import { auth } from '../firebase'

const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function getAuthToken() {
  const user = auth.currentUser
  return user ? user.getIdToken() : ''
}

async function request(path, options = {}) {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Inventory request failed.')
  }

  return payload
}

export async function adjustInventory({ productId, quantity, reason = 'manual_adjustment', referenceId = '' }) {
  if (!productId) {
    throw new Error('Product id is required.')
  }

  const normalizedQuantity = Number(quantity)

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity === 0) {
    throw new Error('Inventory quantity must be a non-zero number.')
  }

  return request('/api/admin/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity: normalizedQuantity, reason, referenceId }),
  })
}

export async function getInventoryTransactions({ productId = '', limit = 100 } = {}) {
  const query = new URLSearchParams()

  if (productId) query.set('productId', productId)
  query.set('limit', String(Math.min(Math.max(Number(limit) || 100, 1), 500)))

  return request(`/api/admin/inventory/transactions?${query.toString()}`)
}
