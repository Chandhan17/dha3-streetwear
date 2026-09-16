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

function isWithinRange(value, from, to) {
  const date = asDate(value)
  if (!date || !from || !to) return false
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59.999`)
  return date >= start && date <= end
}

function getPresetRange(preset) {
  const now = new Date()
  if (preset === 'today') return { from: toInputDate(now), to: toInputDate(now) }
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

function Reports() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [bills, setBills] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [profitRange, setProfitRange] = useState(currentMonthRange())
  const [billRange, setBillRange] = useState(currentMonthRange())
  const [orderRange, setOrderRange] = useState(currentMonthRange())
  const [profitPreset, setProfitPreset] = useState('month')
  const [billPreset, setBillPreset] = useState('month')
  const [orderPreset, setOrderPreset] = useState('month')
  const [message, setMessage] = useState('')

  const loadReports = async () => {
    setIsLoading(true)
    setMessage('')
    try {
      const [orderData, billData] = await Promise.all([getOrders(), fetchPOSBills()])
      setOrders(Array.isArray(orderData) ? orderData : [])
      setBills(Array.isArray(billData) ? billData : [])
    } catch (error) {
      setMessage(error.message || 'Unable to load reports.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadReports() }, [])

  const profitRows = useMemo(() => buildProfitRows(orders, bills).filter((row) => isWithinRange(row.createdAt, profitRange.from, profitRange.to)), [orders, bills, profitRange])
  const billRows = useMemo(() => bills.filter((bill) => isWithinRange(bill.createdAt, billRange.from, billRange.to)), [bills, billRange])
  const orderRows = useMemo(() => orders.filter((order) => isWithinRange(order.createdAt, orderRange.from, orderRange.to)), [orders, orderRange])

  const profitTotals = useMemo(() => {
    const sale = profitRows.reduce((sum, row) => sum + row.saleAmount, 0)
    const cost = profitRows.reduce((sum, row) => sum + row.cost, 0)
    const profit = profitRows.reduce((sum, row) => sum + row.profit, 0)
    return { sale, cost, profit, margin: sale > 0 ? (profit / sale) * 100 : 0 }
  }, [profitRows])

  const billBookRows = useMemo(() => billRows.map((bill) => {
    const qty = getBillQty(bill)
    const cash = bill.paymentMethod === 'cash' ? Number(bill.total || 0) : 0
    const upi = bill.paymentMethod === 'upi' ? Number(bill.total || 0) : 0
    const card = bill.paymentMethod === 'card' ? Number(bill.total || 0) : 0
    return {
      date: asDate(bill.createdAt)?.toLocaleDateString('en-IN') || '-',
      billNo: bill.billNo || bill.id || '-',
      customer: bill.customer?.name || 'Walk-in Customer',
      mobile: bill.customer?.phone || '-',
      qty,
      billAmount: Number(bill.total || 0),
      discount: Number(bill.discount || 0),
      cash,
      upi,
      card,
      totalReceipt: Number(bill.total || 0),
      balance: 0,
    }
  }), [billRows])

  const orderHistoryRows = useMemo(() => orderRows.map((order) => ({
    date: asDate(order.createdAt)?.toLocaleDateString('en-IN') || '-',
    orderId: order.id || order.paymentOrderId || '-',
    customer: order.customerName || 'Customer',
    mobile: order.customerPhone || '-',
    products: (order.products || []).map((item) => `${item.name || 'Product'} × ${item.quantity || 0}`).join('; ') || order.productName || '-',
    quantity: getOrderQty(order),
    amount: Number(order.totalAmount ?? order.productPrice ?? 0),
    paymentMethod: order.paymentMethod || '-',
    paymentStatus: order.paymentStatus || '-',
    orderStatus: order.status || order.orderStatus || '-',
    source: 'Online',
  })), [orderRows])

  const handlePreset = (kind, preset) => {
    const range = getPresetRange(preset)
    if (kind === 'profit') { setProfitPreset(preset); setProfitRange(range) }
    if (kind === 'bill') { setBillPreset(preset); setBillRange(range) }
    if (kind === 'order') { setOrderPreset(preset); setOrderRange(range) }
  }

  const inputClass = 'rounded-xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]'
  const filterBlock = (kind, preset, range, setRange) => (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0f0f0f] p-1">
        <button type="button" onClick={() => handlePreset(kind, 'today')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'today' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>Today</button>
        <button type="button" onClick={() => handlePreset(kind, 'month')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'month' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>This Month</button>
        <button type="button" onClick={() => { const current = currentMonthRange(); if (kind === 'profit') setProfitPreset('custom'); if (kind === 'bill') setBillPreset('custom'); if (kind === 'order') setOrderPreset('custom'); setRange(current) }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'custom' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>Custom</button>
      </div>
      <div><label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-white/40">From</label><input type="date" className={inputClass} value={range.from} onChange={(event) => { setRange((current) => ({ ...current, from: event.target.value })); if (kind === 'profit') setProfitPreset('custom'); if (kind === 'bill') setBillPreset('custom'); if (kind === 'order') setOrderPreset('custom') }} /></div>
      <div><label className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-white/40">To</label><input type="date" className={inputClass} value={range.to} onChange={(event) => { setRange((current) => ({ ...current, to: event.target.value })); if (kind === 'profit') setProfitPreset('custom'); if (kind === 'bill') setBillPreset('custom'); if (kind === 'order') setOrderPreset('custom') }} /></div>
    </div>
  )

  const downloadProfit = () => downloadExcelReport({ filename: `bill-wise-profit-${profitRange.from}-to-${profitRange.to}.xlsx`, sheetName: 'Bill Wise Profit', rows: profitRows.map((row) => ({ ...row, saleAmount: Number(row.saleAmount.toFixed(2)), cost: Number(row.cost.toFixed(2)), profit: Number(row.profit.toFixed(2)), profitPercent: Number(row.profitPercent.toFixed(2)) })), columns: [{ key: 'date', label: 'Date' }, { key: 'billNo', label: 'Bill No.' }, { key: 'party', label: 'Party' }, { key: 'source', label: 'Source' }, { key: 'totalQty', label: 'Total Qty' }, { key: 'saleAmount', label: 'Sale Amt' }, { key: 'cost', label: 'Cost' }, { key: 'profit', label: 'Profit' }, { key: 'profitPercent', label: 'Profit %' }] })
  const downloadBillBook = () => downloadExcelReport({ filename: `pos-bill-book-${billRange.from}-to-${billRange.to}.xlsx`, sheetName: 'POS Bill Book', rows: billBookRows, columns: [{ key: 'date', label: 'Date' }, { key: 'billNo', label: 'Bill No.' }, { key: 'customer', label: 'Customer' }, { key: 'mobile', label: 'Mobile' }, { key: 'qty', label: 'Qty' }, { key: 'billAmount', label: 'Bill Amt' }, { key: 'discount', label: 'Discount' }, { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'card', label: 'Card' }, { key: 'totalReceipt', label: 'Total Receipt' }, { key: 'balance', label: 'Balance' }] })
  const downloadOrderHistory = () => downloadExcelReport({ filename: `order-history-${orderRange.from}-to-${orderRange.to}.xlsx`, sheetName: 'Order History', rows: orderHistoryRows, columns: [{ key: 'date', label: 'Date' }, { key: 'orderId', label: 'Order ID' }, { key: 'customer', label: 'Customer' }, { key: 'mobile', label: 'Mobile' }, { key: 'products', label: 'Products' }, { key: 'quantity', label: 'Quantity' }, { key: 'amount', label: 'Amount' }, { key: 'paymentMethod', label: 'Payment Method' }, { key: 'paymentStatus', label: 'Payment Status' }, { key: 'orderStatus', label: 'Order Status' }, { key: 'source', label: 'Source' }] })

  const handleNavigation = (key) => {
    if (key === 'pos') return navigate('/admin/pos')
    if (key === 'posBills') return navigate('/admin/pos/bills')
    if (key === 'inventory') return navigate('/admin/inventory')
    if (key === 'analytics') return
    navigate('/admin')
  }

  if (isLoading) return <AdminLayout activeKey="analytics" onChangeKey={handleNavigation} title="Reports & Analytics" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}><Loader label="Loading reports" /></AdminLayout>

  return (
    <AdminLayout activeKey="analytics" onChangeKey={handleNavigation} title="Reports & Analytics" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Business reporting</p><h1 className="mt-1 text-2xl font-semibold text-white">Sales & Profit Dashboard</h1><p className="mt-1 text-sm text-white/50">Current month is selected by default. Each report has its own independent date range and Excel download.</p></div>
        {message && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h2 className="text-lg font-semibold text-white">Bill Wise Profit Report</h2><p className="text-xs text-white/45">Online + Store POS · GST is not treated as a profit expense.</p></div>{filterBlock('profit', profitPreset, profitRange, setProfitRange)}<Button disabled={!profitRows.length} onClick={downloadProfit}>Download Report</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Sales</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(profitTotals.sale)}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Cost</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(profitTotals.cost)}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Profit</p><p className="mt-1 text-xl font-semibold text-[#f0ddc4]">{formatCurrency(profitTotals.profit)}</p></div><div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-4"><p className="text-[10px] uppercase text-white/40">Margin</p><p className="mt-1 text-xl font-semibold text-white">{profitTotals.margin.toFixed(2)}%</p></div></div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[950px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-white/45"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Bill No.</th><th className="px-3 py-3">Party</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Sale Amt</th><th className="px-3 py-3">Cost</th><th className="px-3 py-3">Profit</th><th className="px-3 py-3">Profit %</th></tr></thead><tbody>{profitRows.map((row, index) => <tr key={`${row.billNo}-${index}`} className="border-b border-white/5"><td className="px-3 py-3 text-white/60">{row.date}</td><td className="px-3 py-3 text-white">{row.billNo}</td><td className="px-3 py-3 text-white/70">{row.party}</td><td className="px-3 py-3"><Badge tone={row.source === 'Store POS' ? 'info' : 'success'}>{row.source}</Badge></td><td className="px-3 py-3 text-white/70">{row.totalQty}</td><td className="px-3 py-3 text-white">{formatCurrency(row.saleAmount)}</td><td className="px-3 py-3 text-white/60">{formatCurrency(row.cost)}</td><td className="px-3 py-3 font-semibold text-[#f0ddc4]">{formatCurrency(row.profit)}</td><td className="px-3 py-3 text-white/70">{row.profitPercent.toFixed(2)}%</td></tr>)}</tbody>{profitRows.length > 0 && <tfoot><tr className="bg-[#0c0c0c] font-semibold"><td className="px-3 py-3" colSpan="5">TOTAL</td><td className="px-3 py-3">{formatCurrency(profitTotals.sale)}</td><td className="px-3 py-3">{formatCurrency(profitTotals.cost)}</td><td className="px-3 py-3 text-[#f0ddc4]">{formatCurrency(profitTotals.profit)}</td><td className="px-3 py-3">{profitTotals.margin.toFixed(2)}%</td></tr></tfoot>}</table></div>
          {profitRows.length === 0 && <div className="mt-4"><EmptyState title="No profit records" description="Choose another date range or complete a POS/online sale." /></div>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h2 className="text-lg font-semibold text-white">POS Bill Book</h2><p className="text-xs text-white/45">Physical store bills for the selected period.</p></div>{filterBlock('bill', billPreset, billRange, setBillRange)}<Button disabled={!billBookRows.length} onClick={downloadBillBook}>Download Report</Button></div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[1180px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-white/45"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Bill No.</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Bill Amt</th><th className="px-3 py-3">Discount</th><th className="px-3 py-3">Cash</th><th className="px-3 py-3">UPI</th><th className="px-3 py-3">Card</th><th className="px-3 py-3">Total Receipt</th><th className="px-3 py-3">Balance</th></tr></thead><tbody>{billBookRows.map((row, index) => <tr key={`${row.billNo}-${index}`} className="border-b border-white/5"><td className="px-3 py-3 text-white/60">{row.date}</td><td className="px-3 py-3 text-white">{row.billNo}</td><td className="px-3 py-3 text-white/70">{row.customer}</td><td className="px-3 py-3 text-white/50">{row.mobile}</td><td className="px-3 py-3 text-white/70">{row.qty}</td><td className="px-3 py-3 text-white">{formatCurrency(row.billAmount)}</td><td className="px-3 py-3 text-white/60">{formatCurrency(row.discount)}</td><td className="px-3 py-3">{formatCurrency(row.cash)}</td><td className="px-3 py-3">{formatCurrency(row.upi)}</td><td className="px-3 py-3">{formatCurrency(row.card)}</td><td className="px-3 py-3 font-semibold text-[#f0ddc4]">{formatCurrency(row.totalReceipt)}</td><td className="px-3 py-3">{formatCurrency(row.balance)}</td></tr>)}</tbody></table></div>
          {billRows.length === 0 && <div className="mt-4"><EmptyState title="No POS bills" description="Choose another date range or complete a store sale." /></div>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h2 className="text-lg font-semibold text-white">Order History</h2><p className="text-xs text-white/45">Website orders for the selected period.</p></div>{filterBlock('order', orderPreset, orderRange, setOrderRange)}<Button disabled={!orderHistoryRows.length} onClick={downloadOrderHistory}>Download Report</Button></div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[1150px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-white/45"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Order ID</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3">Products</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Payment Status</th><th className="px-3 py-3">Order Status</th><th className="px-3 py-3">Source</th></tr></thead><tbody>{orderHistoryRows.map((row, index) => <tr key={`${row.orderId}-${index}`} className="border-b border-white/5"><td className="px-3 py-3 text-white/60">{row.date}</td><td className="px-3 py-3 text-white">{row.orderId}</td><td className="px-3 py-3 text-white/70">{row.customer}</td><td className="px-3 py-3 text-white/50">{row.mobile}</td><td className="max-w-[280px] px-3 py-3 text-white/60">{row.products}</td><td className="px-3 py-3">{row.quantity}</td><td className="px-3 py-3 font-semibold text-[#f0ddc4]">{formatCurrency(row.amount)}</td><td className="px-3 py-3">{row.paymentMethod}</td><td className="px-3 py-3">{row.paymentStatus}</td><td className="px-3 py-3">{row.orderStatus}</td><td className="px-3 py-3"><Badge tone="success">Online</Badge></td></tr>)}</tbody></table></div>
          {orderRows.length === 0 && <div className="mt-4"><EmptyState title="No online orders" description="Choose another date range or wait for an online order." /></div>}
        </section>
      </div>
    </AdminLayout>
  )
}

export default Reports
