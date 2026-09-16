import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { fetchProducts } from '../services/productService'
import { completePOSSale } from '../services/posService'

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0))}`
}

function POS() {
  const navigate = useNavigate()
  const barcodeRef = useRef(null)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [barcode, setBarcode] = useState('')
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [completedBill, setCompletedBill] = useState(null)

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      setProducts(await fetchProducts({ forceRefresh: true }))
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Unable to load products.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])
  useEffect(() => { barcodeRef.current?.focus() }, [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter((product) => String(product.name || '').toLowerCase().includes(query) || String(product.sku || '').toLowerCase().includes(query) || String(product.barcode || '').toLowerCase().includes(query))
  }, [products, search])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const safeDiscountPercent = Math.min(100, Math.max(0, Number(discountPercent) || 0))
  const discount = Math.round(subtotal * safeDiscountPercent) / 100
  const totalBeforeGST = Math.max(0, subtotal - discount)
  const estimatedGST = cart.reduce((sum, item) => {
    const lineAfterDiscount = item.price * item.quantity * (1 - safeDiscountPercent / 100)
    return sum + (lineAfterDiscount * (Number(item.gstPercent) || 0) / 100)
  }, 0)
  const total = Math.max(0, totalBeforeGST + estimatedGST)

  const addToCart = (product) => {
    const stock = Number(product.stock ?? 0)
    const existing = cart.find((item) => item.id === product.id)
    const nextQuantity = (existing?.quantity || 0) + 1
    if (Number.isFinite(stock) && stock >= 0 && nextQuantity > stock) {
      setMessage(stock === 0 ? 'This product is out of stock.' : `Only ${stock} unit(s) available.`)
      return
    }
    setMessage('')
    setCart((current) => {
      const found = current.find((item) => item.id === product.id)
      if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { id: product.id, name: product.name, price: Number(product.price || 0), quantity: 1, barcode: product.barcode || '', sku: product.sku || '', stock, gstPercent: Number(product.gstPercent ?? product.gst ?? 0) }]
    })
  }

  const handleBarcodeSubmit = (event) => {
    event.preventDefault()
    const code = barcode.trim().toLowerCase()
    if (!code) return
    const product = products.find((item) => String(item.barcode || '').toLowerCase() === code || String(item.sku || '').toLowerCase() === code)
    if (!product) {
      setMessage(`No product found for barcode/SKU: ${barcode}`)
      setBarcode('')
      return
    }
    addToCart(product)
    setBarcode('')
  }

  const updateQuantity = (id, delta) => {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item]
      const nextQuantity = item.quantity + delta
      if (nextQuantity <= 0) return []
      if (Number.isFinite(item.stock) && item.stock >= 0 && nextQuantity > item.stock) {
        setMessage(`Only ${item.stock} unit(s) available.`)
        return [item]
      }
      return [{ ...item, quantity: nextQuantity }]
    }))
  }

  const handleDiscountChange = (event) => {
    const value = event.target.value
    if (value === '') {
      setDiscountPercent('')
      return
    }
    const number = Number(value)
    if (!Number.isFinite(number)) return
    setDiscountPercent(String(Math.min(100, Math.max(0, number))))
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0 || isProcessing) return
    setIsProcessing(true)
    setMessage('')
    try {
      const response = await completePOSSale({ items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })), paymentMethod, discountPercent: safeDiscountPercent })
      setCompletedBill(response.bill)
      setCart([])
      setDiscountPercent('0')
      await loadProducts()
    } catch (error) {
      setMessage(error.message || 'Unable to complete the sale.')
      await loadProducts()
    } finally {
      setIsProcessing(false)
      barcodeRef.current?.focus()
    }
  }

  const handleNavigation = (key) => {
    if (key === 'pos') return
    if (key === 'inventory') { navigate('/admin/inventory'); return }
    if (key === 'posBills') { navigate('/admin/pos/bills'); return }
    if (key === 'orders') { navigate('/admin/orders'); return }
    if (key === 'analytics') { navigate('/admin/reports'); return }
    if (key === 'dashboard') { navigate('/admin/dashboard'); return }
    if (key === 'products') { navigate('/admin/products'); return }
  }

  return (
    <AdminLayout activeKey="pos" onChangeKey={handleNavigation} title="Point of Sale" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <style>{`@media print { body * { visibility: hidden !important; } #pos-receipt, #pos-receipt * { visibility: visible !important; } #pos-receipt { position: absolute; left: 0; top: 0; width: 80mm; color: #000 !important; background: #fff !important; } }`}</style>
      <div className="space-y-5 print:hidden">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Store billing</p><h1 className="mt-1 text-2xl font-semibold text-white">New Sale</h1><p className="mt-1 text-sm text-white/50">Scan a barcode or search the shared product catalog.</p></div><Button variant="secondary" onClick={() => navigate('/admin')}>Back to Admin</Button></div>
        <form onSubmit={handleBarcodeSubmit} className="rounded-2xl border border-[#c19a6b]/30 bg-[#111111] p-4 shadow-soft"><label htmlFor="pos-barcode" className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-white/60">Barcode / SKU scanner</label><div className="flex gap-2"><input ref={barcodeRef} id="pos-barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan barcode and press Enter" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0b0b0b] px-4 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" autoComplete="off" /><Button type="submit">Add</Button></div></form>
        {message && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Products</h2><p className="text-xs text-white/45">Online and store inventory use this same catalog.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="rounded-xl border border-white/15 bg-[#0b0b0b] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]" /></div>{isLoading && <Loader label="Loading products" />}{!isLoading && filteredProducts.length === 0 && <EmptyState title="No products" description="Add products from the admin product section." />}{!isLoading && filteredProducts.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => { const stock = Number(product.stock ?? 0); const outOfStock = Number.isFinite(stock) && stock === 0; return <button type="button" key={product.id} disabled={outOfStock} onClick={() => addToCart(product)} className="rounded-xl border border-white/10 bg-[#0c0c0c] p-3 text-left transition hover:border-[#c19a6b]/50 disabled:cursor-not-allowed disabled:opacity-45"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-medium text-white">{product.name}</p><Badge tone={outOfStock ? 'danger' : 'success'}>{outOfStock ? 'Out' : `Stock ${stock}`}</Badge></div><p className="mt-2 text-sm font-semibold text-[#f0ddc4]">{formatCurrency(product.price)}</p><p className="mt-1 text-[11px] text-white/40">{product.barcode || product.sku || 'No barcode yet'}</p></button> })}</div>}</section>
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft"><div className="flex items-center justify-between border-b border-white/10 pb-3"><div><h2 className="font-semibold text-white">Current Bill</h2><p className="text-xs text-white/45">Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}</p></div><Button variant="ghost" disabled={cart.length === 0} onClick={() => { setCart([]); setDiscountPercent('0') }}>Clear</Button></div><div className="max-h-[420px] space-y-3 overflow-auto py-4">{cart.length === 0 && <p className="py-12 text-center text-sm text-white/40">Scan or select a product to start.</p>}{cart.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-[#0b0b0b] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white">{item.name}</p><p className="text-xs text-white/45">{formatCurrency(item.price)} each</p></div><p className="text-sm font-semibold text-white">{formatCurrency(item.price * item.quantity)}</p></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button type="button" onClick={() => updateQuantity(item.id, -1)} className="h-7 w-7 rounded-lg border border-white/15 text-white">−</button><span className="w-6 text-center text-sm text-white">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, 1)} className="h-7 w-7 rounded-lg border border-white/15 text-white">+</button></div><button type="button" onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))} className="text-xs text-red-300">Remove</button></div></div>)}</div><div className="space-y-3 border-t border-white/10 pt-4"><div><label htmlFor="pos-discount" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Discount %</label><div className="flex items-center gap-2"><input id="pos-discount" type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={handleDiscountChange} placeholder="0" className="w-32 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 py-2.5 text-sm text-white outline-none focus:border-[#c19a6b]" /><span className="text-sm text-white/50">%</span><span className="ml-auto text-sm text-white/60">Discount: {formatCurrency(discount)}</span></div></div><div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div><div className="flex justify-between text-sm text-white/60"><span>GST</span><span>{formatCurrency(estimatedGST)}</span></div><div className="flex justify-between pt-1 text-lg font-semibold text-white"><span>Total</span><span>{formatCurrency(total)}</span></div></div><div className="mt-4 grid grid-cols-3 gap-2">{['cash', 'upi', 'card'].map((method) => <button type="button" key={method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] ${paymentMethod === method ? 'border-[#c19a6b] bg-[#c19a6b]/15 text-[#f0ddc4]' : 'border-white/10 text-white/55'}`}>{method}</button>)}</div><Button className="mt-3 w-full" disabled={cart.length === 0 || isProcessing} onClick={handleCompleteSale}>{isProcessing ? 'Processing Sale...' : 'Complete Sale'}</Button></section>
        </div>
      </div>
      {completedBill && <div id="pos-receipt" className="mx-auto w-[80mm] bg-white p-4 text-black"><div className="text-center"><h2 className="text-lg font-bold">DHA THREE</h2><p className="text-xs">POS BILL</p><p className="text-xs">{completedBill.billNo}</p></div><div className="my-2 border-t border-dashed border-black" />{completedBill.items?.map((item) => <div key={item.productId} className="mb-1 text-xs"><div className="flex justify-between gap-2"><span>{item.name} x {item.quantity}</span><span>{formatCurrency(item.discountedLineTotal ?? item.lineSubtotal)}</span></div></div>)}<div className="my-2 border-t border-dashed border-black" /><div className="space-y-1 text-xs"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(completedBill.subtotal)}</span></div><div className="flex justify-between"><span>Discount ({Number(completedBill.discountPercent || 0)}%)</span><span>{formatCurrency(completedBill.discount)}</span></div><div className="flex justify-between"><span>GST</span><span>{formatCurrency(completedBill.gst)}</span></div><div className="flex justify-between text-sm font-bold"><span>Total</span><span>{formatCurrency(completedBill.total)}</span></div><div className="flex justify-between"><span>Payment</span><span>{String(completedBill.paymentMethod || '').toUpperCase()}</span></div></div><p className="mt-4 text-center text-[10px]">Thank you for shopping with us.</p><div className="mt-4 flex justify-center gap-2 print:hidden"><Button onClick={() => window.print()}>Print Receipt</Button><Button variant="secondary" onClick={() => { setCompletedBill(null); barcodeRef.current?.focus() }}>New Sale</Button></div></div>}
    </AdminLayout>
  )
}

export default POS
