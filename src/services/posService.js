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

function rangeToQuery(range) {
  if (!range?.from || !range?.to) return ''
  const from = new Date(`${range.from}T00:00:00`)
  const to = new Date(`${range.to}T23:59:59.999`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error('Invalid POS bill date range')
  if (from > to) throw new Error('From date cannot be after To date')
  const params = new URLSearchParams({ fromMs: String(from.getTime()), toMs: String(to.getTime()) })
  return `?${params.toString()}`
}

export async function fetchPOSBills(range = null) {
  const data = await request(`/api/admin/pos/bills${rangeToQuery(range)}`)
  return Array.isArray(data.bills) ? data.bills : []
}
