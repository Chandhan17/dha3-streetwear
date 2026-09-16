import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { fetchProducts, createProduct } from '../services/productService'
import { parseCSV, normalizeImportRows, validateDuplicateIdentifiers } from '../services/productImportService'

function ProductImport() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState(null)

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows])
  const invalidRows = rows.length - validRows.length

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name); setError(''); setResult(null)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      const normalized = normalizeImportRows(parsed.rows)
      const existing = await fetchProducts({ forceRefresh: true })
      setRows(validateDuplicateIdentifiers(normalized, existing))
    } catch (err) { setRows([]); setError(err.message || 'Unable to read this CSV file.') }
    event.target.value = ''
  }

  const importProducts = async () => {
    if (!validRows.length) return
    setIsImporting(true); setError(''); setResult(null)
    let imported = 0; const failures = []
    try {
      for (const row of validRows) {
        try {
          await createProduct({ ...row.data, imageFiles: [] })
          imported += 1
        } catch (err) { failures.push(`Row ${row.rowNumber}: ${err.message || 'Import failed'}`) }
      }
      setResult({ imported, failed: failures })
      if (imported) setRows((current) => current.filter((row) => !validRows.includes(row)))
    } finally { setIsImporting(false) }
  }

  const downloadTemplate = () => {
    const header = 'Name,SKU,Barcode,Category,Sale Price,Purchase Price,MRP,GST %,HSN Code,Opening Stock,Opening Stock Value,Description,Sizes\n'
    const example = 'Classic Black Shirt,SHIRT-001,8901234567890,Shirts,1999,1200,2499,5,6109,20,24000,Classic fit shirt,"S,M,L,XL"\n'
    const blob = new Blob([header + example], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'product-import-template.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout activeKey="products" onChangeKey={(key) => { if (key === 'pos') navigate('/admin/pos'); else if (key === 'inventory') navigate('/admin/inventory'); else navigate('/admin') }} title="Import Products" query="" onQueryChange={() => {}} onLogout={async () => navigate('/login', { replace: true })}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c19a6b]">Catalog migration</p><h1 className="mt-1 text-2xl font-semibold text-white">Import Products</h1><p className="mt-1 text-sm text-white/50">Upload a CSV, review validation results, then import valid products.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={downloadTemplate}>Download Template</Button><Button variant="secondary" onClick={() => navigate('/admin')}>Back</Button></div></div>
        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft"><input type="file" accept=".csv,text/csv" onChange={handleFile} className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#c19a6b] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black" />{fileName && <p className="mt-2 text-xs text-white/50">Selected: {fileName}</p>}{error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}</section>
        {rows.length > 0 && <section className="space-y-3 rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Badge tone="success">Valid {validRows.length}</Badge><Badge tone={invalidRows ? 'danger' : 'success'}>Invalid {invalidRows}</Badge></div><Button disabled={!validRows.length || isImporting} onClick={importProducts}>{isImporting ? 'Importing...' : `Import ${validRows.length} Products`}</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-white/10 text-white/45"><th className="px-3 py-2">Row</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Barcode</th><th className="px-3 py-2">Sale</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Validation</th></tr></thead><tbody>{rows.slice(0, 200).map((row) => <tr key={row.rowNumber} className="border-b border-white/5"><td className="px-3 py-3 text-white/50">{row.rowNumber}</td><td className="px-3 py-3 text-white">{row.data.name || '-'}</td><td className="px-3 py-3 text-white/60">{row.data.sku || 'Auto'}</td><td className="px-3 py-3 text-white/60">{row.data.barcode || 'Auto'}</td><td className="px-3 py-3 text-[#f0ddc4]">₹{row.data.price}</td><td className="px-3 py-3 text-white/60">{row.data.openingStock}</td><td className="px-3 py-3">{row.errors.length ? <span className="text-red-200">{row.errors.join(', ')}</span> : <span className="text-emerald-200">Ready</span>}</td></tr>)}</tbody></table></div>{rows.length > 200 && <p className="text-xs text-white/40">Showing first 200 rows in preview. All valid rows are included in import.</p>}</section>}
        {result && <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft"><p className="text-sm text-white">Imported: <strong>{result.imported}</strong> · Failed: <strong>{result.failed.length}</strong></p>{result.failed.length > 0 && <div className="mt-3 space-y-1 text-xs text-red-200">{result.failed.slice(0, 20).map((item) => <p key={item}>{item}</p>)}</div>}</section>}
      </div>
    </AdminLayout>
  )
}
export default ProductImport
