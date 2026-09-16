import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { fetchPOSBills } from '../services/posService'
import { downloadExcelReport } from '../services/reportExportService'

function formatCurrency(value) { return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}` }
function formatDate(value) { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }
function toInputDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function monthRange() { const now = new Date(); return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) } }
function isInRange(value, range) { const date = new Date(value); if (Number.isNaN(date.getTime())) return false; const start = new Date(`${range.from}T00:00:00`); const end = new Date(`${range.to}T23:59:59.999`); return date >= start && date <= end }

function POSBills() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [search, setSearch] = useState('')
  const [range, setRange] = useState(monthRange())
  const [preset, setPreset] = useState('month')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)

  const loadBills = async () => { setIsLoading(true); try { setBills(await fetchPOSBills()) } catch { setBills([]) } finally { setIsLoading(false) } }
  useEffect(() => { loadBills() }, [])

  const filteredBills = useMemo(() => { const query = search.trim().toLowerCase(); return bills.filter((bill) => isInRange(bill.createdAt, range) && (!query || `${bill.billNo || ''} ${bill.customer?.name || ''} ${bill.customer?.phone || ''} ${bill.paymentMethod || ''}`.toLowerCase().includes(query))) }, [bills, search, range])
  const exportRows = useMemo(() => filteredBills.map((bill) => { const qty = (bill.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0); const total = Number(bill.total || 0); return { date: bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-IN') : '-', billNo: bill.billNo || bill.id || '-', customer: bill.customer?.name || 'Walk-in Customer', mobile: bill.customer?.phone || '-', qty, billAmount: total, discount: Number(bill.discount || 0), cash: bill.paymentMethod === 'cash' ? total : 0, upi: bill.paymentMethod === 'upi' ? total : 0, card: bill.paymentMethod === 'card' ? total : 0, totalReceipt: total, balance: 0 } }), [filteredBills])

  const setPresetRange = (value) => { const now = new Date(); let next; if (value === 'today') next = { from: toInputDate(now), to: toInputDate(now) }; else next = monthRange(); setPreset(value); setRange(next) }
  const handleNavigation = (key) => { if (key === 'pos') navigate('/admin/pos'); else if (key === 'inventory') navigate('/admin/inventory'); else if (key === 'orders') navigate('/admin/orders'); else if (key === 'dashboard') navigate('/admin/dashboard'); else if (key === 'analytics') navigate('/admin/reports'); }
  const inputClass = 'rounded-xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]'
  const download = () => downloadExcelReport({ filename: `pos-bill-book-${range.from}-to-${range.to}.xlsx`, sheetName: 'POS Bill Book', rows: exportRows, columns: [{ key: 'date', label: 'Date' }, { key: 'billNo', label: 'Bill No.' }, { key: 'customer', label: 'Customer' }, { key: 'mobile', label: 'Mobile' }, { key: 'qty', label: 'Qty' }, { key: 'billAmount', label: 'Bill Amt' }, { key: 'discount', label: 'Discount' }, { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'card', label: 'Card' }, { key: 'totalReceipt', label: 'Total Receipt' }, { key: 'balance', label: 'Balance' }] })

  return <AdminLayout activeKey="posBills" onChangeKey={handleNavigation} title="POS Bill Book" query={search} onQueryChange={setSearch} onLogout={async () => navigate('/login', { replace: true })}>
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Store records</p><h1 className="mt-1 text-2xl font-semibold text-white">POS Bill Book</h1><p className="mt-1 text-sm text-white/50">Completed store bills for the selected date range.</p></div><Button onClick={() => navigate('/admin/pos')}>New Sale</Button></div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft"><div className="flex gap-1 rounded-xl border border-white/10 bg-[#0f0f0f] p-1"><button type="button" onClick={() => setPresetRange('today')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'today' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>Today</button><button type="button" onClick={() => setPresetRange('month')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${preset === 'month' ? 'bg-[#c19a6b] text-black' : 'text-white/65'}`}>This Month</button></div><div><label className="mb-1 block text-[10px] uppercase text-white/40">From</label><input type="date" className={inputClass} value={range.from} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value })) }} /></div><div><label className="mb-1 block text-[10px] uppercase text-white/40">To</label><input type="date" className={inputClass} value={range.to} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value })) }} /></div><Button variant="secondary" onClick={loadBills}>Refresh</Button><Button disabled={!exportRows.length} onClick={download}>Download Report</Button></div>
      {isLoading && <Loader label="Loading bills" />}
      {!isLoading && filteredBills.length === 0 && <EmptyState title="No POS bills" description="Choose another date range or complete a store sale." />}
      {!isLoading && filteredBills.length > 0 && <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] shadow-soft"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/45"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bill No.</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Bill Amt</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{filteredBills.map((bill) => { const qty = (bill.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0); return <tr key={bill.id} className="border-b border-white/5"><td className="px-4 py-4 text-sm text-white/60">{formatDate(bill.createdAt)}</td><td className="px-4 py-4 text-sm font-semibold text-white">{bill.billNo}</td><td className="px-4 py-4"><p className="text-sm text-white">{bill.customer?.name || 'Walk-in Customer'}</p><p className="text-xs text-white/40">{bill.customer?.phone || '-'}</p></td><td className="px-4 py-4 text-sm text-white/70">{qty}</td><td className="px-4 py-4 text-sm font-semibold text-[#f0ddc4]">{formatCurrency(bill.total)}</td><td className="px-4 py-4 text-xs uppercase text-white/60">{bill.paymentMethod}</td><td className="px-4 py-4"><Button variant="secondary" className="px-3 py-2" onClick={() => setSelectedBill(bill)}>View / Print</Button></td></tr> })}</tbody></table></div>}
      {selectedBill && <div className="rounded-2xl border border-white/10 bg-white p-5 text-black shadow-soft"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">DHA THREE</h2><p className="text-xs">{selectedBill.billNo} · {formatDate(selectedBill.createdAt)}</p></div><Button variant="secondary" onClick={() => window.print()}>Print</Button></div><div className="my-4 border-t border-dashed border-black" />{selectedBill.items?.map((item) => <div key={item.productId} className="flex justify-between py-1 text-sm"><span>{item.name} × {item.quantity}</span><span>{formatCurrency(item.discountedLineTotal ?? item.lineSubtotal)}</span></div>)}<div className="my-4 border-t border-dashed border-black" /><div className="ml-auto max-w-xs space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedBill.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>{formatCurrency(selectedBill.discount)}</span></div><div className="flex justify-between"><span>GST</span><span>{formatCurrency(selectedBill.gst)}</span></div><div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selectedBill.total)}</span></div><div className="flex justify-between"><span>Payment</span><span>{String(selectedBill.paymentMethod).toUpperCase()}</span></div></div><div className="mt-5"><Button variant="ghost" onClick={() => setSelectedBill(null)}>Close</Button></div></div>}
    </div>
  </AdminLayout>
}

export default POSBills
