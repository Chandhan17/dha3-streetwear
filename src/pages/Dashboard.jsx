import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import StatCard from '../components/StatCard'
import { getOrders } from '../services/orderService'
import { fetchPOSBills } from '../services/posService'
import { fetchProducts } from '../services/productService'

function timestampMs(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  const seconds = Number(value?.seconds ?? value?._seconds)
  const nanoseconds = Number(value?.nanoseconds ?? value?._nanoseconds ?? 0)
  if (Number.isFinite(seconds)) return seconds * 1000 + Math.floor(nanoseconds / 1000000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function currency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(money(value))}`
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePOSBill(bill) {
  const items = Array.isArray(bill?.items) ? bill.items : []
  return {
    id: `pos-${bill.id}`, source: 'store', sourceLabel: 'Store POS', customerName: String(bill?.customer?.name || '').trim(),
    customerPhone: String(bill?.customer?.phone || '').trim(), productName: String(items[0]?.name || (items.length > 1 ? `${items.length} items` : 'Store Sale')).trim(),
    products: items, totalAmount: money(bill?.total), cost: money(bill?.cost), profit: money(bill?.profit), margin: money(bill?.margin), paymentStatus: 'paid',
    paymentMethod: String(bill?.paymentMethod || '').trim(), status: 'completed', billNo: String(bill?.billNo || bill.id || '').trim(), createdAt: bill?.createdAt ? new Date(bill.createdAt) : null,
    itemCount: items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
  }
}

function normalizeOnlineOrder(order) {
  const products = Array.isArray(order?.products) ? order.products : []
  return { ...order, id: order.id, source: 'online', sourceLabel: 'Online', products, totalAmount: money(order?.totalAmount ?? order?.productPrice), cost: Number.isFinite(Number(order?.cost)) ? money(order.cost) : null, profit: Number.isFinite(Number(order?.profit)) ? money(order.profit) : null, itemCount: products.reduce((sum, item) => sum + Number(item?.quantity || 0), 0) }
}

function periodRange(period, customStartDate, customEndDate) {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start); end.setDate(end.getDate() + 1)
    return { start: start.getTime(), end: end.getTime() }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { start: start.getTime(), end: end.getTime() }
  }
  if (period === 'custom') {
    if (!customStartDate || !customEndDate) return null
    const start = new Date(`${customStartDate}T00:00:00`)
    const end = new Date(`${customEndDate}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null
    end.setDate(end.getDate() + 1)
    return { start: start.getTime(), end: end.getTime() }
  }
  return { start: 0, end: Number.POSITIVE_INFINITY }
}

function Dashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    setIsLoading(true); setError('')
    try {
      const [onlineOrders, posBills, catalog] = await Promise.all([getOrders(), fetchPOSBills(), fetchProducts({ forceRefresh: true })])
      setOrders([...onlineOrders.map(normalizeOnlineOrder), ...posBills.map(normalizePOSBill)].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)))
      setProducts(catalog)
    } catch (loadError) { setError(loadError.message || 'Unable to load dashboard data.') }
    finally { setIsLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const filteredOrders = useMemo(() => {
    const range = periodRange(period, customStartDate, customEndDate)
    if (!range) return []
    return orders.filter((order) => { const created = timestampMs(order.createdAt); return created >= range.start && created < range.end && order.paymentStatus === 'paid' })
  }, [orders, period, customStartDate, customEndDate])

  const customRangeValid = Boolean(periodRange('custom', customStartDate, customEndDate))
  const selectedRangeLabel = useMemo(() => {
    if (period === 'today') return 'Today'
    if (period === 'month') return 'This month'
    if (period === 'all') return 'All time'
    if (!customRangeValid) return 'Custom range'
    return `${new Date(`${customStartDate}T00:00:00`).toLocaleDateString('en-IN')} – ${new Date(`${customEndDate}T00:00:00`).toLocaleDateString('en-IN')}`
  }, [period, customStartDate, customEndDate, customRangeValid])

  const metrics = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]))
    let sales = 0; let cost = 0; let profit = 0; let profitKnown = true; let items = 0; let onlineSales = 0; let storeSales = 0
    filteredOrders.forEach((order) => {
      sales += money(order.totalAmount); items += Number(order.itemCount || 0)
      if (order.source === 'online') onlineSales += money(order.totalAmount); else storeSales += money(order.totalAmount)
      if (Number.isFinite(order.cost) && Number.isFinite(order.profit)) { cost += money(order.cost); profit += money(order.profit); return }
      let orderCost = 0; let canCalculate = true
      const itemsForCost = Array.isArray(order.products) ? order.products : []
      itemsForCost.forEach((item) => { const catalogProduct = productMap.get(String(item?.productId || '')); const unitCost = Number(item?.purchasePrice ?? catalogProduct?.purchasePrice); const quantity = Number(item?.quantity || 0); if (!Number.isFinite(unitCost)) canCalculate = false; orderCost += (Number.isFinite(unitCost) ? unitCost : 0) * quantity })
      if (!canCalculate) profitKnown = false; else { cost += money(orderCost); profit += money(order.totalAmount - orderCost) }
    })
    return { sales: money(sales), cost: money(cost), profit: profitKnown || filteredOrders.length === 0 ? money(profit) : null, margin: sales > 0 && (profitKnown || filteredOrders.length === 0) ? money((profit / sales) * 100) : null, bills: filteredOrders.length, items, onlineSales: money(onlineSales), storeSales: money(storeSales), profitKnown }
  }, [filteredOrders, products])

  const recentOrders = filteredOrders.slice(0, 8)

  const handlePeriodChange = (value) => {
    setPeriod(value)
    if (value !== 'custom') return
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    setCustomStartDate((current) => current || toDateInputValue(monthStart))
    setCustomEndDate((current) => current || toDateInputValue(today))
  }

  const handleCustomDateChange = (setter, value) => {
    setter(value)
    setPeriod('custom')
  }

  const handleNavigation = (key) => {
    if (key === 'pos') navigate('/admin/pos')
    else if (key === 'posBills') navigate('/admin/pos/bills')
    else if (key === 'inventory') navigate('/admin/inventory')
    else if (key === 'orders') navigate('/admin/orders')
    else if (key === 'analytics') navigate('/admin/reports')
    else navigate('/admin')
  }

  return (
    <AdminLayout activeKey="dashboard" onChangeKey={handleNavigation} title="Business Dashboard" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Sales & profit</p><h1 className="mt-1 text-2xl font-semibold text-white">Business Dashboard</h1><p className="mt-1 text-sm text-white/50">Online and store POS sales use the same central inventory.</p></div>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-[#111111] p-2">
            {[['today', 'Today'], ['month', 'This Month'], ['all', 'All Time']].map(([value, label]) => <button key={value} type="button" onClick={() => handlePeriodChange(value)} className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${period === value ? 'bg-[#c19a6b] text-black' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}
            <button type="button" onClick={() => handlePeriodChange('custom')} className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${period === 'custom' ? 'bg-[#c19a6b] text-black' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>Custom</button>
            {period === 'custom' && (
              <div className="flex flex-wrap items-end gap-2 border-l border-white/10 pl-2">
                <label className="flex flex-col gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">From<input type="date" value={customStartDate} onChange={(event) => handleCustomDateChange(setCustomStartDate, event.target.value)} className="h-9 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 text-xs font-normal normal-case tracking-normal text-white outline-none focus:border-[#c19a6b]" /></label>
                <label className="flex flex-col gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">To<input type="date" value={customEndDate} onChange={(event) => handleCustomDateChange(setCustomEndDate, event.target.value)} className="h-9 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 text-xs font-normal normal-case tracking-normal text-white outline-none focus:border-[#c19a6b]" /></label>
                {!customRangeValid && <span className="pb-2 text-[10px] text-amber-300">Select a valid date range.</span>}
              </div>
            )}
            <Button variant="secondary" onClick={loadData}>Refresh</Button><Button variant="secondary" onClick={() => navigate('/admin/reports')}>Reports</Button>
          </div>
        </div>
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {isLoading ? <Loader label="Loading dashboard" /> : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Sales" value={currency(metrics.sales)} hint={selectedRangeLabel} /><StatCard label="Cost" value={currency(metrics.cost)} hint="Product cost" /><StatCard label="Profit" value={metrics.profit === null ? '—' : currency(metrics.profit)} hint={metrics.profitKnown ? 'Sales minus product cost' : 'Some older orders need cost data'} /><StatCard label="Margin" value={metrics.margin === null ? '—' : `${metrics.margin.toFixed(2)}%`} hint="Profit ÷ sales" /></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Bills" value={metrics.bills} hint="Paid sales" /><StatCard label="Items Sold" value={metrics.items} hint="Units" /><StatCard label="Online Sales" value={currency(metrics.onlineSales)} hint="Website" /><StatCard label="Store Sales" value={currency(metrics.storeSales)} hint="POS" /></div>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Profit Report</h2><p className="text-xs text-white/45">{selectedRangeLabel} · combined online + POS</p></div><Badge tone={metrics.profit === null ? 'warning' : 'success'}>{metrics.profit === null ? 'Needs cost data' : 'Calculated'}</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-xs text-white/45">Sales</p><p className="mt-1 text-xl font-semibold text-white">{currency(metrics.sales)}</p></div><div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-xs text-white/45">Cost</p><p className="mt-1 text-xl font-semibold text-white">{currency(metrics.cost)}</p></div><div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-xs text-white/45">Profit</p><p className="mt-1 text-xl font-semibold text-[#f0ddc4]">{metrics.profit === null ? '—' : currency(metrics.profit)}</p></div></div></section>
            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft"><h2 className="font-semibold text-white">Latest Sales</h2><div className="mt-4 space-y-3">{recentOrders.length === 0 ? <p className="text-sm text-white/40">No paid sales in this period.</p> : recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0c0c0c] p-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-white">{order.productName || 'Sale'}</p><Badge tone={order.source === 'store' ? 'info' : 'success'}>{order.sourceLabel}</Badge></div><p className="text-xs text-white/40">{order.customerName || 'Walk-in customer'} · {order.itemCount} item(s)</p></div><span className="shrink-0 text-sm font-semibold text-[#f0ddc4]">{currency(order.totalAmount)}</span></div>)}</div></section>
          </div>
        </>}
        {!isLoading && !filteredOrders.length && !error && <EmptyState title="No paid sales yet" description="POS and online completed sales will appear here automatically." />}
      </div>
    </AdminLayout>
  )
}

export default Dashboard
