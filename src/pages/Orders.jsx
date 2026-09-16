import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import Table from '../components/Table'
import { getOrders, updateOrderStatus } from '../services/orderService'
import { fetchPOSBills } from '../services/posService'

function normalizeOnline(order) {
  const products = Array.isArray(order.products) ? order.products : []
  return { ...order, source: 'online', sourceLabel: 'Online', totalAmount: Number(order.totalAmount ?? order.productPrice ?? 0), itemCount: products.reduce((sum, item) => sum + Number(item?.quantity || 0), 0) }
}

function normalizePOS(bill) {
  const items = Array.isArray(bill.items) ? bill.items : []
  return { id: `pos-${bill.id}`, source: 'store', sourceLabel: 'Store POS', billNo: bill.billNo, customerName: bill.customer?.name || '', customerPhone: bill.customer?.phone || '', products: items, productName: items[0]?.name || (items.length > 1 ? `${items.length} items` : 'Store Sale'), totalAmount: Number(bill.total || 0), cost: Number(bill.cost || 0), profit: Number(bill.profit || 0), margin: Number(bill.margin || 0), paymentStatus: 'paid', paymentMethod: bill.paymentMethod || '', status: 'completed', createdAt: bill.createdAt ? new Date(bill.createdAt) : null, itemCount: items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0) }
}

function dateMs(value) { if (!value) return 0; if (value instanceof Date) return value.getTime(); if (typeof value?.toDate === 'function') return value.toDate().getTime(); const seconds = Number(value?.seconds ?? value?._seconds); if (Number.isFinite(seconds)) return seconds * 1000; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime() }
function money(value) { return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}` }

function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [online, pos] = await Promise.all([getOrders(), fetchPOSBills()])
      setOrders([...online.map(normalizeOnline), ...pos.map(normalizePOS)].sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt)))
    } catch (err) { setError(err.message || 'Unable to load order history.') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((order) => {
      const statusMatch = statusFilter === 'all' || String(order.status || '').toLowerCase() === statusFilter
      const sourceMatch = sourceFilter === 'all' || order.source === sourceFilter
      const target = `${order.id} ${order.billNo || ''} ${order.customerName || ''} ${order.customerPhone || ''} ${order.productName || ''}`.toLowerCase()
      return statusMatch && sourceMatch && (!q || target.includes(q))
    })
  }, [orders, statusFilter, sourceFilter, search])

  const handleNavigation = (key) => {
    if (key === 'pos') navigate('/admin/pos')
    else if (key === 'posBills') navigate('/admin/pos/bills')
    else if (key === 'inventory') navigate('/admin/inventory')
    else if (key === 'dashboard') navigate('/admin/dashboard')
    else navigate('/admin')
  }

  const changeStatus = async (order, status) => {
    if (order.source !== 'online') return
    try { await updateOrderStatus(order.id, status); setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item)) }
    catch (err) { setError(err.message || 'Unable to update order status.') }
  }

  return <AdminLayout activeKey="orders" onChangeKey={handleNavigation} title="Order History" query={search} onQueryChange={setSearch} onLogout={async () => navigate('/login', { replace: true })}>
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Unified sales history</p><h1 className="mt-1 text-2xl font-semibold text-white">Orders</h1><p className="mt-1 text-sm text-white/50">Website orders and physical-store POS bills in one history.</p></div><Button variant="secondary" onClick={load}>Refresh</Button></div>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft md:grid-cols-3"><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs text-white/80"><option value="all">All Sources</option><option value="online">Online</option><option value="store">Store POS</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs text-white/80"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><div className="rounded-2xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-xs text-white/50">Showing {filtered.length} of {orders.length} sales</div></div>
      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {loading ? <Loader label="Loading order history" /> : filtered.length === 0 ? <EmptyState title="No sales found" description="Try changing the source, status, or search filter." /> : <Table columns={[{ key: 'source', label: 'Source' }, { key: 'id', label: 'Bill / Order' }, { key: 'customer', label: 'Customer' }, { key: 'items', label: 'Items' }, { key: 'amount', label: 'Amount' }, { key: 'profit', label: 'Profit' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }]}>{filtered.map((order) => <tr key={order.id} className="border-b border-white/8"><td className="px-4 py-3"><Badge tone={order.source === 'store' ? 'info' : 'success'}>{order.sourceLabel}</Badge></td><td className="px-4 py-3 text-xs text-white/60">{order.billNo || order.id?.slice(0, 10)}</td><td className="px-4 py-3"><p className="text-sm font-medium text-white">{order.customerName || 'Walk-in customer'}</p><p className="text-xs text-white/40">{order.customerPhone || '-'}</p></td><td className="px-4 py-3 text-sm text-white/70">{order.itemCount || 0}</td><td className="px-4 py-3 text-sm font-semibold text-[#f0ddc4]">{money(order.totalAmount)}</td><td className="px-4 py-3 text-sm text-emerald-200">{Number.isFinite(Number(order.profit)) ? money(order.profit) : '—'}</td><td className="px-4 py-3 text-xs text-white/55">{order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</td><td className="px-4 py-3">{order.source === 'store' ? <Badge tone="success">Completed</Badge> : <select value={order.status || 'pending'} onChange={(e) => changeStatus(order, e.target.value)} className="rounded-xl border border-white/15 bg-[#0f0f0f] px-2 py-1 text-[11px] text-white/75"><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}</td></tr>)}</Table>}
    </div>
  </AdminLayout>
}

export default Orders
