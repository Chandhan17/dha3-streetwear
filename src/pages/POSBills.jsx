import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { fetchPOSBills } from '../services/posService'

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function POSBills() {
  const navigate = useNavigate()
  const [bills, setBills] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)

  const loadBills = async () => {
    setIsLoading(true)
    try { setBills(await fetchPOSBills()) } catch { setBills([]) } finally { setIsLoading(false) }
  }

  useEffect(() => { loadBills() }, [])

  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return bills
    return bills.filter((bill) => `${bill.billNo || ''} ${bill.customer?.name || ''} ${bill.customer?.phone || ''} ${bill.paymentMethod || ''}`.toLowerCase().includes(query))
  }, [bills, search])

  const handleNavigation = (key) => {
    if (key === 'pos') { navigate('/admin/pos'); return }
    if (key === 'inventory') { navigate('/admin/inventory'); return }
    if (key === 'posBills') return
    navigate('/admin')
  }

  return (
    <AdminLayout activeKey="posBills" onChangeKey={handleNavigation} title="POS Bill Book" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Store records</p><h1 className="mt-1 text-2xl font-semibold text-white">POS Bill Book</h1><p className="mt-1 text-sm text-white/50">Completed store bills and payment records.</p></div><Button onClick={() => navigate('/admin/pos')}>New Sale</Button></div>
        <div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bill, customer or payment..." className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111111] px-4 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" /><Button variant="secondary" onClick={loadBills}>Refresh</Button></div>
        {isLoading && <Loader label="Loading bills" />}
        {!isLoading && filteredBills.length === 0 && <EmptyState title="No POS bills" description="Completed store sales will appear here." />}
        {!isLoading && filteredBills.length > 0 && <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] shadow-soft"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/45"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bill No.</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Bill Amt</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{filteredBills.map((bill) => { const qty = (bill.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0); return <tr key={bill.id} className="border-b border-white/5"><td className="px-4 py-4 text-sm text-white/60">{formatDate(bill.createdAt)}</td><td className="px-4 py-4 text-sm font-semibold text-white">{bill.billNo}</td><td className="px-4 py-4"><p className="text-sm text-white">{bill.customer?.name || 'Walk-in Customer'}</p><p className="text-xs text-white/40">{bill.customer?.phone || '-'}</p></td><td className="px-4 py-4 text-sm text-white/70">{qty}</td><td className="px-4 py-4 text-sm font-semibold text-[#f0ddc4]">{formatCurrency(bill.total)}</td><td className="px-4 py-4 text-xs uppercase text-white/60">{bill.paymentMethod}</td><td className="px-4 py-4"><Button variant="secondary" className="px-3 py-2" onClick={() => setSelectedBill(bill)}>View / Print</Button></td></tr> })}</tbody></table></div>}
        {selectedBill && <div className="rounded-2xl border border-white/10 bg-white p-5 text-black shadow-soft"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">DHA THREE</h2><p className="text-xs">{selectedBill.billNo} · {formatDate(selectedBill.createdAt)}</p></div><Button variant="secondary" onClick={() => window.print()}>Print</Button></div><div className="my-4 border-t border-dashed border-black" />{selectedBill.items?.map((item) => <div key={item.productId} className="flex justify-between py-1 text-sm"><span>{item.name} × {item.quantity}</span><span>{formatCurrency(item.discountedLineTotal ?? item.lineSubtotal)}</span></div>)}<div className="my-4 border-t border-dashed border-black" /><div className="ml-auto max-w-xs space-y-1 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedBill.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>{formatCurrency(selectedBill.discount)}</span></div><div className="flex justify-between"><span>GST</span><span>{formatCurrency(selectedBill.gst)}</span></div><div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selectedBill.total)}</span></div><div className="flex justify-between"><span>Payment</span><span>{String(selectedBill.paymentMethod).toUpperCase()}</span></div></div><div className="mt-5"><Button variant="ghost" onClick={() => setSelectedBill(null)}>Close</Button></div></div>}
      </div>
    </AdminLayout>
  )
}

export default POSBills
