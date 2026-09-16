import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { getOrders } from '../services/orderService'
import { fetchPOSBills } from '../services/posService'
import { downloadExcelReport } from '../services/reportExportService'

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`
}

function asDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value?.toDate === 'function') return value.toDate()
  const seconds = Number(value?.seconds ?? value?._seconds)
  const nanoseconds = Number(value?.nanoseconds ?? value?._nanoseconds ?? 0)
  if (Number.isFinite(seconds)) return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentMonthRange() {
  const now = new Date()
  return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) }
}

function isValidRange(range) {
  return Boolean(range?.from && range?.to && range.from <= range.to)
}

function getPresetRange(preset) {
  const now = new Date()
  if (preset === 'today') {
    const today = toInputDate(now)
    return { from: today, to: today }
  }
  return currentMonthRange()
}

function getBillQty(bill) {
  return (Array.isArray(bill?.items) ? bill.items : []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
}

function getOrderQty(order) {
  return (Array.isArray(order?.products) ? order.products : []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
}

function buildProfitRows(orders, bills) {
  const onlineRows = orders.map((order) => {
    const saleAmount = Number(order?.totalAmount ?? order?.productPrice ?? 0)
    const cost = Number(order?.cost ?? 0)
    const profit = Number(order?.profit ?? (saleAmount - cost))
    return {
      date: asDate(order.createdAt)?.toLocaleDateString('en-IN') || '-',
      billNo: order.id || order.paymentOrderId || '-',
      party: order.customerName || order.customerPhone || 'Online Customer',
      source: 'Online',
      totalQty: getOrderQty(order),
      saleAmount,
      cost,
      profit,
      profitPercent: saleAmount > 0 ? (profit / saleAmount) * 100 : 0,
      createdAt: order.createdAt,
    }
  })

  const posRows = bills.map((bill) => {
    const saleAmount = Number(bill?.subtotal || 0) - Number(bill?.discount || 0)
    const cost = Number(bill?.cost || 0)
    const profit = Number(bill?.profit ?? (saleAmount - cost))
    return {
      date: asDate(bill.createdAt)?.toLocaleDateString('en-IN') || '-',
      billNo: bill.billNo || bill.id || '-',
      party: bill.customer?.name || 'Cash',
      source: 'Store POS',
      totalQty: getBillQty(bill),
      saleAmount,
      cost,
      profit,
      profitPercent: saleAmount > 0 ? (profit / saleAmount) * 100 : 0,
      createdAt: bill.createdAt,
    }
  })

  return [...onlineRows, ...posRows].sort((a, b) => (asDate(b.createdAt)?.getTime() || 0) - (asDate(a.createdAt)?.getTime() || 0))
}

function ReportDateFilter({ preset, range, onPreset, onRangeChange }) {
  const inputClass = 'cursor-pointer rounded-xl border border-white/15 bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark] focus:border-[#c19a6b]'
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0f0f0f] p-1">
        <button type="button" onClick={() => onPreset('today')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'today' ? 'bg-[#c19a6b] text-black' : 'text-white/65 hover:bg-white/5'}`}>Today</button>
        <button type="button" onClick={() => onPreset('month')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'month' ? 'bg-[#c19a6b] text-black' : 'text-white/65 hover:bg-white/5'}`}>This Month</button>
        <button type="button" onClick={() => onPreset('custom')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'custom' ? 'bg-[#c19a6b] text-black' : 'text-white/65 hover:bg-white/5'}`}>Custom</button>
      </div>
      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">From</span><input type="date" value={range.from} className={inputClass} onChange={(event) => onRangeChange({ ...range, from: event.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">To</span><input type="date" value={range.to} className={inputClass} onChange={(event) => onRangeChange({ ...range, to: event.target.value })} /></label>
    </div>
  )
}

function Reports() {
  const navigate = useNavigate()
  const defaultRange = currentMonthRange()
  const [orders, setOrders] = useState([])
  const [profitBills, setProfitBills] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [profitLoading, setProfitLoading] = useState(true)
  const [profitRange, setProfitRange] = useState(defaultRange)
  const [profitPreset, setProfitPreset] = useState('month')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setOrdersLoading(true)
    getOrders()
      .then((data) => { if (!cancelled) setOrders(Array.isArray(data) ? data : []) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Unable to load online orders.') })
      .finally(() => { if (!cancelled) setOrdersLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isValidRange(profitRange)) return
    let cancelled = false
    setProfitLoading(true)
    fetchPOSBills(profitRange)
      .then((data) => { if (!cancelled) setProfitBills(Array.isArray(data) ? data : []) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Unable to load store POS bills.') })
      .finally(() => { if (!cancelled) setProfitLoading(false) })
    return () => { cancelled = true }
  }, [profitRange])

  const profitRows = useMemo(() => {
    if (!isValidRange(profitRange)) return []
    const from = new Date(`${profitRange.from}T00:00:00`)
    const to = new Date(`${profitRange.to}T23:59:59.999`)
    return buildProfitRows(orders, profitBills).filter((row) => {
      const created = asDate(row.createdAt)
      const inRange = created && created >= from && created <= to
      const matchesSource = sourceFilter === 'all' || row.source === sourceFilter
      return inRange && matchesSource
    })
  }, [orders, profitBills, profitRange, sourceFilter])

  const profitTotals = useMemo(() => {
    const sale = profitRows.reduce((sum, row) => sum + row.saleAmount, 0)
    const cost = profitRows.reduce((sum, row) => sum + row.cost, 0)
    const profit = profitRows.reduce((sum, row) => sum + row.profit, 0)
    return { sale, cost, profit, margin: sale > 0 ? (profit / sale) * 100 : 0 }
  }, [profitRows])

  const setPreset = (preset) => {
    const range = preset === 'custom' ? profitRange : getPresetRange(preset)
    setProfitPreset(preset)
    setProfitRange(range)
  }

  const setCustomRange = (range) => {
    if (range.from && range.to && range.from > range.to) {
      setProfitPreset('custom')
      setError('From date cannot be after To date.')
      return
    }
    setError('')
    setProfitPreset('custom')
    setProfitRange(range)
  }

  const downloadProfit = () => downloadExcelReport({
    filename: `bill-wise-profit-${profitRange.from}-to-${profitRange.to}${sourceFilter === 'all' ? '' : `-${sourceFilter.toLowerCase().replace(/\s+/g, '-')}`}.xlsx`,
    sheetName: 'Bill Wise Profit',
    rows: profitRows.map((row) => ({ ...row, saleAmount: Number(row.saleAmount.toFixed(2)), cost: Number(row.cost.toFixed(2)), profit: Number(row.profit.toFixed(2)), profitPercent: Number(row.profitPercent.toFixed(2)) })),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'billNo', label: 'Bill No.' },
      { key: 'party', label: 'Party' },
      { key: 'source', label: 'Source' },
      { key: 'totalQty', label: 'Total Qty' },
      { key: 'saleAmount', label: 'Sale Amt' },
      { key: 'cost', label: 'Cost' },
      { key: 'profit', label: 'Profit' },
      { key: 'profitPercent', label: 'Profit %' },
    ],
  })

  const handleNavigation = (key) => {
    if (key === 'pos') return navigate('/admin/pos')
    if (key === 'posBills') return navigate('/admin/pos/bills')
    if (key === 'inventory') return navigate('/admin/inventory')
    if (key === 'orders') return navigate('/admin/orders')
    if (key === 'analytics') return
    navigate('/admin')
  }

  return (
    <AdminLayout activeKey="analytics" onChangeKey={handleNavigation} title="Reports & Analytics" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Business reporting</p><h1 className="mt-1 text-2xl font-semibold text-white">Sales & Profit Reports</h1></div>
        {error && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{error}</div>}

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Bill Wise Profit Report</h2>
              <p className="text-xs text-white/45">Online + Store POS · GST is not treated as a profit expense.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="text-xs text-white/45">{profitRows.length} record(s)</div>
              <ReportDateFilter preset={profitPreset} range={profitRange} onPreset={setPreset} onRangeChange={setCustomRange} />
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Source</span>
                <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-xl border border-white/15 bg-[#0f0f0f] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c19a6b]">
                  <option value="all">All Sources</option>
                  <option value="Online">Online</option>
                  <option value="Store POS">Store POS</option>
                </select>
              </label>
              <Button disabled={profitLoading || !profitRows.length} onClick={downloadProfit}>Download Report</Button>
            </div>
          </div>

          {profitLoading || ordersLoading ? <div className="mt-5"><Loader label="Loading profit report" /></div> : profitRows.length === 0 ? <div className="mt-5"><EmptyState title="No profit records" description="Try another date range or source." /></div> : <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Sales</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(profitTotals.sale)}</p></div>
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Cost</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(profitTotals.cost)}</p></div>
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Profit</p><p className="mt-1 text-xl font-semibold text-[#f0ddc4]">{formatCurrency(profitTotals.profit)}</p></div>
              <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Profit %</p><p className="mt-1 text-xl font-semibold text-[#f0ddc4]">{profitTotals.margin.toFixed(2)}%</p></div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-white/45"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bill No.</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Total Qty</th><th className="px-4 py-3">Sale Amt</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Profit</th><th className="px-4 py-3">Profit %</th></tr></thead><tbody>{profitRows.map((row) => <tr key={`${row.source}-${row.billNo}`} className="border-b border-white/5"><td className="px-4 py-3 text-white/60">{row.date}</td><td className="px-4 py-3 text-white">{row.billNo}</td><td className="px-4 py-3 text-white/70">{row.party}</td><td className="px-4 py-3"><Badge tone={row.source === 'Store POS' ? 'info' : 'success'}>{row.source}</Badge></td><td className="px-4 py-3 text-white/70">{row.totalQty}</td><td className="px-4 py-3 text-white">{formatCurrency(row.saleAmount)}</td><td className="px-4 py-3 text-white/70">{formatCurrency(row.cost)}</td><td className="px-4 py-3 text-[#f0ddc4]">{formatCurrency(row.profit)}</td><td className="px-4 py-3 text-[#f0ddc4]">{row.profitPercent.toFixed(2)}%</td></tr>)}</tbody></table></div>
          </>}
        </section>
      </div>
    </AdminLayout>
  )
}

export default Reports
