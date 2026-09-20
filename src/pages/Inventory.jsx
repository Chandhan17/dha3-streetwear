import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { fetchProducts } from '../services/productService'
import { adjustInventory, restockInventory } from '../services/inventoryService'
import { barcodeSvg } from '../utils/barcode'

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[character]))

function printBarcodeLabels(product, quantity) {
  const barcode = String(product.barcode || '').trim()
  const labelCount = Number(quantity)
  if (!barcode || !Number.isInteger(labelCount) || labelCount < 1 || labelCount > 1000) return

  const svg = barcodeSvg(barcode, { width: 300, height: 105 })
  const labels = Array.from({ length: labelCount }, () => `
    <div class="label">
      <div class="name">${escapeHtml(product.name || 'Product')}</div>
      ${svg}
      <div class="price">MRP ₹${Number(product.mrp || product.price || 0).toFixed(2)}</div>
    </div>
  `).join('')

  const printWindow = window.open('', '_blank', 'width=600,height=700')
  if (!printWindow) return
  printWindow.document.write(`<!doctype html><html><head><title>Barcode Labels - ${escapeHtml(product.name)}</title><style>
    @page { size: auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Arial, sans-serif; }
    .label { width: 58mm; min-height: 32mm; padding: 2.5mm 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; break-after: page; overflow: hidden; }
    .label:last-child { page-break-after: auto; break-after: auto; }
    .name { width: 100%; font-size: 11px; line-height: 1.2; font-weight: 700; text-align: center; margin-bottom: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    svg { width: 100%; max-width: 52mm; height: auto; display: block; }
    .price { font-size: 10px; line-height: 1.1; font-weight: 700; margin-top: 0.5mm; }
    @media screen { body { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; } .label { border: 1px dashed #aaa; page-break-after: auto; } }
  </style></head><body>${labels}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
  printWindow.document.close()
}

function Inventory() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [quantities, setQuantities] = useState({})
  const [labelQuantities, setLabelQuantities] = useState({})
  const [message, setMessage] = useState('')
  const [restockProduct, setRestockProduct] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState('')
  const [restockSizes, setRestockSizes] = useState([])
  const [restockNotes, setRestockNotes] = useState('')
  const [restocking, setRestocking] = useState(false)

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const nextProducts = await fetchProducts({ forceRefresh: true })
      setProducts(nextProducts)
      setLabelQuantities((current) => Object.fromEntries(nextProducts.map((product) => [product.id, current[product.id] || Math.max(1, Number(product.stock || 1))])))
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
    const amount = Number(quantities[product.id])
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage('Enter a whole-number quantity greater than 0.')
      return
    }
    const delta = direction === 'in' ? amount : -amount
    setSavingId(product.id)
    setMessage('')
    try {
      const result = await adjustInventory({ productId: product.id, quantity: delta, reason: direction === 'in' ? 'Stock received' : 'Manual stock correction' })
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: result.inventory.stockAfter } : item))
      setQuantities((current) => ({ ...current, [product.id]: '' }))
      setLabelQuantities((current) => ({ ...current, [product.id]: Math.max(1, Number(result.inventory.stockAfter || 1)) }))
    } catch (error) {
      setMessage(error.message || 'Unable to update stock.')
    } finally {
      setSavingId('')
    }
  }

  const getProductSizes = (product) => {
    if (Array.isArray(product?.sizes)) return [...new Set(product.sizes.map((size) => String(size || '').trim()).filter(Boolean))]
    if (typeof product?.sizes === 'string') return [...new Set(product.sizes.split(',').map((size) => String(size || '').trim()).filter(Boolean))]
    return []
  }

  const isSizeAvailable = (product, size) => {
    const sizeStock = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
    const sourceKey = Object.keys(sizeStock).find((key) => String(key).toLowerCase() === String(size).toLowerCase())
    return Number(sourceKey === undefined ? 1 : sizeStock[sourceKey]) > 0
  }

  const openRestock = (product) => {
    setRestockProduct(product)
    setRestockQuantity('')
    setRestockSizes([])
    setRestockNotes('')
    setMessage('')
  }

  const closeRestock = () => {
    if (restocking) return
    setRestockProduct(null)
    setRestockQuantity('')
    setRestockSizes([])
    setRestockNotes('')
  }

  const toggleRestockSize = (size) => {
    setRestockSizes((current) => current.includes(size) ? current.filter((item) => item !== size) : [...current, size])
  }

  const submitRestock = async () => {
    if (!restockProduct) return
    const sizes = getProductSizes(restockProduct)
    const hasSizes = sizes.length > 0
    const quantity = Number(restockQuantity)

    if (hasSizes && restockSizes.length === 0) {
      setMessage('Select at least one sold-out size to restock.')
      return
    }
    if (!hasSizes && (!Number.isInteger(quantity) || quantity <= 0)) {
      setMessage('Enter a whole-number quantity greater than 0.')
      return
    }

    setRestocking(true)
    setMessage('')
    try {
      const result = await restockInventory({
        productId: restockProduct.id,
        quantity: hasSizes ? 0 : quantity,
        sizes: hasSizes ? restockSizes : [],
        notes: restockNotes,
      })
      const inventory = result.inventory || {}
      setProducts((current) => current.map((item) => item.id === restockProduct.id
        ? { ...item, stock: inventory.stockAfter, ...(inventory.sizeStock ? { sizeStock: inventory.sizeStock } : {}) }
        : item))
      setLabelQuantities((current) => ({ ...current, [restockProduct.id]: Math.max(1, Number(inventory.stockAfter || 1)) }))
      setRestockProduct(null)
      setRestockQuantity('')
      setRestockSizes([])
      setRestockNotes('')
      setMessage(
        inventory.mode === 'sizes'
          ? `Restocked: ${(inventory.selectedSizes || []).join(', ')}. Stock is now ${inventory.stockAfter}.`
          : `Added ${inventory.quantity} unit(s). Stock is now ${inventory.stockAfter}.`,
      )
    } catch (error) {
      setMessage(error.message || 'Unable to restock inventory.')
    } finally {
      setRestocking(false)
    }
  }

  const handlePrint = (product) =>
    const quantity = Number(labelQuantities[product.id] || product.stock || 1)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setMessage('Label quantity must be a whole number between 1 and 1000.')
      return
    }
    if (!product.barcode) {
      setMessage('This product does not have a barcode yet. Edit/save the product first.')
      return
    }
    printBarcodeLabels(product, quantity)
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
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Central stock</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Inventory Management</h1>
            <p className="mt-1 text-sm text-white/50">Adjust stock here; POS and online sales use the same stock.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/admin/products/import')}>Import Products</Button>
            <Button variant="secondary" onClick={() => navigate('/admin/pos')}>Open POS</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#c19a6b]/20 bg-[#c19a6b]/5 p-4 text-sm text-white/65 shadow-soft">
          <span className="font-semibold text-[#c19a6b]">Restock:</span> use Restock on a product to add newly received stock. For size-based products, select the sold-out sizes received; each selected size becomes available again.
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-4 text-sm text-white/55 shadow-soft">
          <span className="font-semibold text-white">Thermal labels:</span> set the number of stickers to print for each product, then click Print Label. The current layout is optimized for a small 58 × 32 mm-style label and can be adjusted when the client's actual sticker size is confirmed.
        </div>

        <div className="flex gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU or barcode..." className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111111] px-4 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" />
          <Button variant="secondary" onClick={loadProducts}>Refresh</Button>
        </div>

        {message && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}
        {isLoading && <Loader label="Loading inventory" />}
        {!isLoading && filteredProducts.length === 0 && <EmptyState title="No products found" description="Add products first, then initialize their stock here." />}

        {!isLoading && filteredProducts.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111] shadow-soft">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-white/45">
                  <th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU / Barcode</th><th className="px-4 py-3">Current Stock</th><th className="px-4 py-3">Adjustment</th><th className="px-4 py-3">Label Qty</th><th className="px-4 py-3">Print</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const stock = Number(product.stock ?? 0)
                  const isSaving = savingId === product.id
                  return (
                    <tr key={product.id} className="border-b border-white/5">
                      <td className="px-4 py-4"><p className="text-sm font-medium text-white">{product.name}</p><p className="text-xs text-white/40">{product.category || 'Uncategorized'}</p></td>
                      <td className="px-4 py-4 text-xs text-white/50">{product.sku || '-'}<br />{product.barcode || '-'}</td>
                      <td className="px-4 py-4"><Badge tone={stock > 0 ? 'success' : 'danger'}>{stock} unit(s)</Badge></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-2"><input type="number" min="1" step="1" value={quantities[product.id] || ''} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Qty" className="w-24 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]" /><Button disabled={isSaving} onClick={() => updateStock(product, 'in')}>+ Stock</Button><Button variant="danger" disabled={isSaving || stock <= 0} onClick={() => updateStock(product, 'out')}>- Stock</Button><Button variant="secondary" disabled={isSaving} onClick={() => openRestock(product)}>Restock</Button></div></td>
                      <td className="px-4 py-4"><input type="number" min="1" max="1000" step="1" value={labelQuantities[product.id] || ''} onChange={(event) => setLabelQuantities((current) => ({ ...current, [product.id]: event.target.value }))} className="w-24 rounded-xl border border-white/15 bg-[#0b0b0b] px-3 py-2 text-sm text-white outline-none focus:border-[#c19a6b]" /></td>
                      <td className="px-4 py-4"><Button variant="secondary" disabled={!product.barcode} onClick={() => handlePrint(product)}>Print Label</Button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {restockProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRestock() }}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#151515] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Inventory</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Restock Product</h2>
                <p className="mt-1 text-sm text-white/45">{restockProduct.name}</p>
              </div>
              <button type="button" onClick={closeRestock} className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Close">✕</button>
            </div>

            {getProductSizes(restockProduct).length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-white">Select sizes received</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {getProductSizes(restockProduct).map((size) => {
                    const available = isSizeAvailable(restockProduct, size)
                    const selected = restockSizes.includes(size)
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={available || restocking}
                        onClick={() => toggleRestockSize(size)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${available ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-white/30' : selected ? 'border-[#c19a6b] bg-[#c19a6b]/10 text-white' : 'border-white/10 bg-[#0d0d0d] text-white/70 hover:border-white/25'}`}
                      >
                        <span className="block text-sm font-semibold">{size}</span>
                        <span className="mt-1 block text-[11px]">{available ? 'In stock' : selected ? 'Will restock' : 'Sold out'}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-white/40">Size inventory is currently tracked as one available piece per size. Restocking a size makes that size available again.</p>
              </div>
            ) : (
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-white">Quantity to add</label>
                <input value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} type="number" min="1" step="1" placeholder="e.g. 10" disabled={restocking} className="w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" />
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-white">Notes <span className="text-white/35">(optional)</span></label>
              <textarea value={restockNotes} onChange={(event) => setRestockNotes(event.target.value)} rows="3" disabled={restocking} placeholder="e.g. New stock received from supplier" className="w-full resize-none rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-3 text-sm text-white outline-none focus:border-[#c19a6b]" />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={restocking} onClick={closeRestock}>Cancel</Button>
              <Button disabled={restocking} onClick={submitRestock}>{restocking ? 'Restocking...' : 'Add Stock'}</Button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}

export default Inventory
