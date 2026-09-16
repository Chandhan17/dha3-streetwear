import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { fetchProducts } from '../services/productService'
import { adjustInventory } from '../services/inventoryService'

function Inventory() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [quantities, setQuantities] = useState({})
  const [message, setMessage] = useState('')

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      setProducts(await fetchProducts({ forceRefresh: true }))
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Unable to load inventory.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter((product) => `${product.name || ''} ${product.sku || ''} ${product.barcode || ''}`.toLowerCase().includes(query))
  }, [products, search])

  const updateStock = async (product, direction) => {
    const raw = quantities[product.id]
    const amount = Number(raw)
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage('Enter a whole-number quantity greater than 0.')
      return
    }

    const delta = direction === 'in' ? amount : -amount
    setSavingId(product.id)
    setMessage('')
    try {
      const result = await adjustInventory({ productId: product.id, quantity: delta, reason: direction === 'in' ? 'Opening stock / stock received' : 'Manual stock correction' })
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: result.inventory.stockAfter } : item))
      setQuantities((current) => ({ ...current, [product.id]: '' }))
    } catch (error) {
      setMessage(error.message || 'Unable to update stock.')
    } finally {
      setSavingId('')
    }
  }

  const handleNavigation = (key) => {
    if (key === 'inventory') return
    if (key === 'pos') { navigate('/admin/pos'); return }
    navigate('/admin')
  }

  return (
    <AdminLayout activeKey="inventory" onChangeKey={handleNavigation} title="Inventory" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Central stock</p><h1 className="mt-1 text-2xl font-semibold text-white">Inventory Management</h1><p className="mt-1 text-sm text-white/50">Adjust stock here; POS sales automatically deduct from the same stock.</p></div>
          <Button variant="secondary" onClick={() => navigate('/admin/pos')}>Open POS</Button>
        </div>
        <div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU or barcode..." className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111111] px-4 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" /><Button variant="secondary" onClick={loadProducts}>Refresh</Button></div>
        {message && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}
        {isLoading && <Loader label="Loading inventory" />}
        {!isLoading && filteredProducts.length === 0 && <EmptyState title="No products found" description="Add products first, then initialize their stock here." />}
        {!isLoading && filteredProducts.length > 0 && <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] shadow-soft"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/45"><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU / Barcode</th><th className="px-4 py-3">Current Stock</th><th className="px-4 py-3">Adjustment</th></tr></thead><tbody>{filteredProducts.map((product) => { const stock = Number(product.stock ?? 0); const isSaving = savingId === product.id; return <tr key={product.id} className="border-b border-white/5"><td className="px-4 py-4"><p className="text-sm font-medium text-white">{product.name}</p><p className="text-xs text-white/40">{product.category || 'Uncategorized'}</p></td><td className="px-4 py-4 text-xs text-white/50">{product.sku || '-'}<br />{product.barcode || '-'}</td><td className="px-4 py-4"><Badge tone={stock > 0 ? 'success' : 'danger'}>{stock} unit(s)</Badge></td><td className="px-4 py-4"><div className="flex items-center gap-2"><input type="number" min="1" step="1" value={quantities[product.id] || ''} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Qty" className="w-24 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]" /><Button disabled={isSaving} onClick={() => updateStock(product, 'in')}>+ Stock</Button><Button variant="danger" disabled={isSaving || stock <= 0} onClick={() => updateStock(product, 'out')}>- Stock</Button></div></td></tr> })}</tbody></table></div>}
      </div>
    </AdminLayout>
  )
}

export default Inventory
