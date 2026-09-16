import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import Modal from '../components/Modal'
import Table from '../components/Table'
import { getOrders, updateOrderStatus } from '../services/orderService'
import { fetchPOSBills } from '../services/posService'
import { downloadExcelReport } from '../services/reportExportService'

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
function inputDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function monthRange() { const now = new Date(); return { from: inputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: inputDate(now) } }
function inRange(value, range) { const date = new Date(value); if (Number.isNaN(date.getTime())) return false; return date >= new Date(`${range.from}T00:00:00`) && date <= new Date(`${range.to}T23:59:59.999`) }
function detailValue(value, fallback = 'N/A') { const normalized = String(value ?? '').trim(); return normalized || fallback }

function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState(monthRange())
  const [preset, setPreset] = useState('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)

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
      const dateMatch = inRange(order.createdAt, range)
      const target = `${order.id} ${order.billNo || ''} ${order.customerName || ''} ${order.customerPhone || ''} ${order.productName || ''}`.toLowerCase()
      return statusMatch && sourceMatch && dateMatch && (!q || target.includes(q))
    })
  }, [orders, statusFilter, sourceFilter, search, range])

  const exportRows = useMemo(() => filtered.map((order) => ({ date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-', orderId: order.billNo || order.id || '-', customer: order.customerName || 'Walk-in customer', mobile: order.customerPhone || '-', products: (order.products || []).map((item) => `${item.name || 'Product'} × ${item.quantity || 0}`).join('; ') || order.productName || '-', quantity: order.itemCount || 0, amount: Number(order.totalAmount || 0), paymentMethod: order.paymentMethod || '-', paymentStatus: order.paymentStatus || '-', orderStatus: order.status || '-', source: order.sourceLabel || '-' })), [filtered])

  const setPresetRange = (value) => { const now = new Date(); setPreset(value); setRange(value === 'today' ? { from: inputDate(now), to: inputDate(now) } : monthRange()) }
  const download = () => downloadExcelReport({ filename: `order-history-${range.from}-to-${range.to}.xlsx`, sheetName: 'Order History', rows: exportRows, columns: [{ key: 'date', label: 'Date' }, { key: 'orderId', label: 'Order ID' }, { key: 'customer', label: 'Customer' }, { key: 'mobile', label: 'Mobile' }, { key: 'products', label: 'Products' }, { key: 'quantity', label: 'Quantity' }, { key: 'amount', label: 'Amount' }, { key: 'paymentMethod', label: 'Payment Method' }, { key: 'paymentStatus', label: 'Payment Status' }, { key: 'orderStatus', label: 'Order Status' }, { key: 'source', label: 'Source' }] })
  const handleNavigation = (key) => { if (key === 'pos') navigate('/admin/pos'); else if (key === 'posBills') navigate('/admin/pos/bills'); else if (key === 'inventory') navigate('/admin/inventory'); else if (key === 'dashboard') navigate('/admin/dashboard'); else if (key === 'analytics') navigate('/admin/reports') }
  const changeStatus = async (order, status) => { if (order.source !== 'online') return; try { await updateOrderStatus(order.id, status); setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item)) } catch (err) { setError(err.message || 'Unable to update order status.') } }
  const inputClass = 'rounded-xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]'

  return <>
    <AdminLayout activeKey="orders" onChangeKey={handleNavigation} title="Order History" query={search} onQueryChange={setSearch} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Unified sales history</p><h1 className="mt-1 text-2xl font-semibold text-white">Orders</h1><p className="mt-1 text-sm text-white/50">Website orders and physical-store POS bills in one history.</p></div><Button variant="secondary" onClick={load}>Refresh</Button></div>
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft"><div className="flex gap-1 rounded-xl border border-white/10 bg-[#0f0f0f] p-1"><button type="button" onClick={() => setPresetRange('today')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'today' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>Today</button><button type="button" onClick={() => setPresetRange('month')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'month' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>This Month</button></div><div><label className="mb-1 block text-[10px] uppercase text-white/40">From</label><input type="date" className={inputClass} value={range.from} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value })) }} /></div><div><label className="mb-1 block text-[10px] uppercase text-white/40">To</label><input type="date" className={inputClass} value={range.to} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value })) }} /></div><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputClass}><option value="all">All Sources</option><option value="online">Online</option><option value="store">Store POS</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><Button disabled={!exportRows.length} onClick={download}>Download Report</Button></div>
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {loading ? <Loader label="Loading order history" /> : filtered.length === 0 ? <EmptyState title="No sales found" description="Try changing the date, source, status, or search filter." /> : <Table columns={[{ key: 'source', label: 'Source' }, { key: 'id', label: 'Bill / Order' }, { key: 'customer', label: 'Customer' }, { key: 'items', label: 'Items' }, { key: 'amount', label: 'Amount' }, { key: 'profit', label: 'Profit' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'action', label: 'Details' }]}>{filtered.map((order) => <tr key={order.id} className="border-b border-white/8"><td className="px-4 py-3"><Badge tone={order.source === 'store' ? 'info' : 'success'}>{order.sourceLabel}</Badge></td><td className="px-4 py-3 text-xs text-white/60">{order.billNo || order.id?.slice(0, 10)}</td><td className="px-4 py-3"><p className="text-sm font-medium text-white">{order.customerName || 'Walk-in customer'}</p><p className="text-xs text-white/40">{order.customerPhone || '-'}</p></td><td className="px-4 py-3 text-sm text-white/70">{order.itemCount || 0}</td><td className="px-4 py-3 text-sm font-semibold text-[#f0ddc4]">{money(order.totalAmount)}</td><td className="px-4 py-3 text-sm text-emerald-200">{Number.isFinite(Number(order.profit)) ? money(order.profit) : '—'}</td><td className="px-4 py-3 text-xs text-white/55">{order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</td><td className="px-4 py-3">{order.source === 'store' ? <Badge tone="success">Completed</Badge> : <select value={order.status || 'pending'} onChange={(e) => changeStatus(order, e.target.value)} className="rounded-xl border border-white/15 bg-[#0f0f0f] px-2 py-1 text-[11px] text-white/75"><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}</td><td className="px-4 py-3"><Button variant="secondary" onClick={() => setSelectedOrder(order)}>View Bill</Button></td></tr>)}</Table>}
      </div>
    </AdminLayout>

    <Modal open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title={selectedOrder?.source === 'store' ? `POS Bill ${selectedOrder?.billNo || ''}` : `Online Bill ${selectedOrder?.id || ''}`} maxWidth="max-w-4xl">
      {selectedOrder && <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Order / Bill ID</p><p className="mt-1 break-all text-sm font-semibold text-white">{selectedOrder.billNo || selectedOrder.id}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Payment</p><p className="mt-1 text-sm font-semibold text-emerald-200">{selectedOrder.paymentStatus || 'Paid'}{selectedOrder.paymentMethod ? ` · ${selectedOrder.paymentMethod}` : ''}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Date</p><p className="mt-1 text-sm text-white">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Total</p><p className="mt-1 text-xl font-semibold text-[#f0ddc4]">{money(selectedOrder.totalAmount)}</p></div></div>
        <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Products Purchased</h3><div className="mt-4 space-y-3">{selectedOrder.products?.length ? selectedOrder.products.map((item, index) => <div key={`${item.productId || item.name}-${item.selectedSize || 'N/A'}-${index}`} className="flex flex-col gap-3 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center"><img src={item.imageUrl || item.image || '/dha-logo.png'} alt={item.name || 'Product'} className="h-20 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="font-semibold text-white">{item.name || 'Product'}</p><p className="mt-1 text-xs text-white/55">{item.selectedSize && item.selectedSize !== 'N/A' ? `Size ${item.selectedSize} · ` : ''}Qty {item.quantity || 0}</p></div><p className="text-sm font-semibold text-white">{money(Number(item.lineTotal ?? item.unitPrice ?? 0) * (item.lineTotal !== undefined ? 1 : Number(item.quantity || 1)))}</p></div>) : <p className="text-sm text-white/50">No product details available for this bill.</p>}</div></div>
        <div className="grid gap-6 md:grid-cols-2"><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Customer Details</h3><div className="mt-3 space-y-1 text-sm text-white/70"><p>Name: {detailValue(selectedOrder.customerDetails?.name || selectedOrder.customerName)}</p><p>Phone: {detailValue(selectedOrder.customerDetails?.phone || selectedOrder.customerPhone)}</p><p>Door No: {detailValue(selectedOrder.customerDetails?.doorNo, '-')}</p><p>Street: {detailValue(selectedOrder.customerDetails?.street, '-')}</p><p>City: {detailValue(selectedOrder.customerDetails?.city, '-')}</p><p>Pincode: {detailValue(selectedOrder.customerDetails?.pincode, '-')}</p><p>State: {detailValue(selectedOrder.customerDetails?.state, '-')}</p><p>Address: {detailValue(selectedOrder.customerDetails?.address, '-')}</p><p>Notes: {detailValue(selectedOrder.customerDetails?.notes, '-')}</p></div></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Payment Details</h3><div className="mt-3 space-y-1 text-sm text-white/70"><p>Status: {detailValue(selectedOrder.paymentStatus, 'paid')}</p><p>Method: {detailValue(selectedOrder.paymentMethod, '-')}</p><p>Payment ID: {detailValue(selectedOrder.paymentId, '-')}</p><p>Razorpay Order ID: {detailValue(selectedOrder.paymentOrderId || selectedOrder.id, '-')}</p><p>Subtotal: {money(selectedOrder.subtotal ?? selectedOrder.totalAmount)}</p><p>Discount: {money(selectedOrder.discountAmount || 0)}</p><p>Total Paid: {money(selectedOrder.totalAmount)}</p></div></div></div>
      </div>}
    </Modal>
  </>
}

export default Orders
