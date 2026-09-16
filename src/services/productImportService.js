const FIELD_ALIASES = {
  name: ['name', 'product name', 'item name', 'itemname'],
  sku: ['sku', 'item code', 'itemcode'],
  barcode: ['barcode', 'bar code'],
  category: ['category', 'group', 'purchase head', 'sales head'],
  price: ['price', 'sale price', 'selling price', 'saleprice'],
  purchasePrice: ['purchase price', 'purchaseprice', 'prch price', 'cost', 'cost price'],
  mrp: ['mrp', 'maximum retail price'],
  gstPercent: ['gst', 'gst %', 'gstpercent', 'tax', 'tax slab'],
  hsnCode: ['hsn', 'hsn code', 'hsncode'],
  openingStock: ['opening stock', 'openingstock', 'stock', 'op stock', 'opstock'],
  openingStockValue: ['opening stock value', 'openingstockvalue', 'op val', 'opval'],
  description: ['description'],
  sizes: ['sizes', 'size'],
}

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const normalizeNumber = (value) => { const cleaned = String(value ?? '').replace(/[,₹$]/g, '').trim(); if (!cleaned) return 0; const number = Number(cleaned); return Number.isFinite(number) ? number : NaN }

function parseCSVLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { cells.push(current.trim()); current = '' } else current += char
  }
  cells.push(current.trim())
  return cells
}

export function parseCSV(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('CSV must contain a header row and at least one product row.')
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map((line) => { const values = parseCSVLine(line); return Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), values[index] ?? ''])) })
  return { headers, rows }
}

function findValue(row, field) {
  const aliases = FIELD_ALIASES[field] || [field]
  const key = Object.keys(row).find((header) => aliases.includes(header))
  return key ? row[key] : ''
}

export function normalizeImportRows(rows) {
  return rows.map((row, index) => {
    const name = String(findValue(row, 'name') || '').trim()
    const salePrice = normalizeNumber(findValue(row, 'price'))
    const purchasePrice = normalizeNumber(findValue(row, 'purchasePrice'))
    const mrpValue = normalizeNumber(findValue(row, 'mrp'))
    const gstPercent = normalizeNumber(findValue(row, 'gstPercent'))
    const openingStock = normalizeNumber(findValue(row, 'openingStock'))
    const openingStockValue = normalizeNumber(findValue(row, 'openingStockValue'))
    const errors = []
    if (!name) errors.push('Product name is required')
    if (!Number.isFinite(salePrice) || salePrice < 0) errors.push('Invalid sale price')
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) errors.push('Invalid purchase price')
    if (Number.isFinite(mrpValue) && mrpValue < 0) errors.push('Invalid MRP')
    if (Number.isFinite(gstPercent) && (gstPercent < 0 || gstPercent > 100)) errors.push('GST must be 0–100%')
    if (!Number.isFinite(openingStock) || openingStock < 0) errors.push('Invalid opening stock')
    return {
      rowNumber: index + 2,
      data: {
        name,
        sku: String(findValue(row, 'sku') || '').trim(),
        barcode: String(findValue(row, 'barcode') || '').trim(),
        category: String(findValue(row, 'category') || 'Uncategorized').trim(),
        price: salePrice,
        purchasePrice,
        mrp: Number.isFinite(mrpValue) ? mrpValue : salePrice,
        gstPercent: Number.isFinite(gstPercent) ? gstPercent : 0,
        hsnCode: String(findValue(row, 'hsnCode') || '').trim(),
        openingStock,
        openingStockValue: Number.isFinite(openingStockValue) ? openingStockValue : openingStock * purchasePrice,
        description: String(findValue(row, 'description') || '').trim(),
        sizes: String(findValue(row, 'sizes') || '').split(',').map((value) => value.trim()).filter(Boolean),
      },
      errors,
    }
  })
}

export function validateDuplicateIdentifiers(rows, existingProducts = []) {
  const skuSet = new Set(existingProducts.map((product) => String(product.sku || '').trim().toLowerCase()).filter(Boolean))
  const barcodeSet = new Set(existingProducts.map((product) => String(product.barcode || '').trim()).filter(Boolean))
  const seenSku = new Set()
  const seenBarcode = new Set()
  return rows.map((row) => {
    const errors = [...row.errors]
    const sku = row.data.sku.toLowerCase()
    const barcode = row.data.barcode
    if (sku && (skuSet.has(sku) || seenSku.has(sku))) errors.push('Duplicate SKU')
    if (barcode && (barcodeSet.has(barcode) || seenBarcode.has(barcode))) errors.push('Duplicate barcode')
    if (sku) seenSku.add(sku)
    if (barcode) seenBarcode.add(barcode)
    return { ...row, errors }
  })
}
