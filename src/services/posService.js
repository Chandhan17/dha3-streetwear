import { auth } from '../firebase'

const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function getAuthHeaders() {
  const user = auth.currentUser
  if (!user) throw new Error('Please sign in as an admin.')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(await getAuthHeaders()) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'POS request failed')
  return data
}

export async function completePOSSale(payload) {
  return request('/api/admin/pos/sale', { method: 'POST', body: JSON.stringify(payload) })
}

export async function fetchPOSBills() {
  const data = await request('/api/admin/pos/bills')
  return Array.isArray(data.bills) ? data.bills : []
}
