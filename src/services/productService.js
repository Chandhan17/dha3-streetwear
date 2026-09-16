import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { uploadImage, uploadImages } from './uploadService'

const PRODUCTS_COLLECTION = 'products'
const productsCollectionRef = collection(db, PRODUCTS_COLLECTION)
const FALLBACK_CATEGORY = 'Uncategorized'
const FALLBACK_SIZES = []
const PRODUCTS_CACHE_TTL_MS = 30 * 1000

let cachedProducts = null
let cachedProductsAt = 0
let productsRequestPromise = null

function invalidateProductsCache() {
  cachedProducts = null
  cachedProductsAt = 0
  productsRequestPromise = null
}

function normalizeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizePrice(price) { return normalizeNumber(price) }
function normalizeCategory(category) { return String(category || '').trim() || FALLBACK_CATEGORY }
function normalizeText(value) { return typeof value === 'string' ? value.trim() : '' }

function normalizeSizes(sizes) {
  const normalizeSizeValue = (value) => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
    if (value && typeof value === 'object') {
      const candidate = value.size ?? value.value ?? value.label
      return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate).trim() : ''
    }
    return ''
  }
  if (typeof sizes === 'string') return sizes.split(',').map((size) => String(size || '').trim()).filter(Boolean)
  if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) {
    return Object.entries(sizes).filter(([, enabled]) => Boolean(enabled)).map(([size]) => String(size || '').trim()).filter(Boolean)
  }
  if (!Array.isArray(sizes)) return FALLBACK_SIZES
  return sizes.map(normalizeSizeValue).filter(Boolean)
}

function normalizeImageList(images, fallbackImage) {
  if (Array.isArray(images)) {
    const normalizedImages = images.map((image) => String(image || '').trim()).filter(Boolean)
    if (normalizedImages.length > 0) return normalizedImages
  }
  return fallbackImage ? [fallbackImage] : []
}

function normalizeProduct(productId, productData) {
  const imageUrl = productData.imageUrl || productData.image || ''
  const images = normalizeImageList(productData.images, imageUrl)
  return {
    id: productId,
    ...productData,
    name: normalizeText(productData.name),
    price: normalizePrice(productData.price),
    purchasePrice: normalizePrice(productData.purchasePrice),
    mrp: normalizePrice(productData.mrp),
    gstPercent: normalizeNumber(productData.gstPercent),
    hsnCode: normalizeText(productData.hsnCode),
    sku: normalizeText(productData.sku),
    barcode: normalizeText(productData.barcode),
    stock: normalizeNumber(productData.stock),
    openingStock: normalizeNumber(productData.openingStock),
    openingStockValue: normalizeNumber(productData.openingStockValue),
    category: normalizeCategory(productData.category),
    sizes: normalizeSizes(productData.sizes),
    description: normalizeText(typeof productData.description === 'object' ? productData.description?.short : productData.description || productData.shortDescription),
    sizeChartText: normalizeText(productData.sizeChartText),
    sizeChartImage: normalizeText(productData.sizeChartImage),
    images,
    image: imageUrl,
    imageUrl,
  }
}

function generateBarcode() {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.floor(100 + Math.random() * 900)
  return `890${timestamp}${random}`
}

function generateSku(name) {
  const prefix = String(name || 'ITEM').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'ITEM'
  return `${prefix}-${Date.now().toString().slice(-6)}`
}

function buildProductPayload({ name, price, category, sizes, description, sizeChartText, sizeChartImage, images, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, stock, openingStock, openingStockValue }, imageUrl, existing = {}) {
  const normalizedImages = normalizeImageList(images, imageUrl)
  const primaryImage = normalizedImages[0] || ''
  const normalizedOpeningStock = normalizeNumber(openingStock)
  return {
    name: normalizeText(name),
    price: normalizePrice(price),
    category: normalizeCategory(category),
    sizes: normalizeSizes(sizes),
    description: normalizeText(description),
    sizeChartText: normalizeText(sizeChartText),
    sizeChartImage: normalizeText(sizeChartImage),
    images: normalizedImages,
    image: primaryImage,
    imageUrl: primaryImage,
    sku: normalizeText(sku) || existing.sku || generateSku(name),
    barcode: normalizeText(barcode) || existing.barcode || generateBarcode(),
    purchasePrice: normalizePrice(purchasePrice),
    mrp: normalizePrice(mrp || price),
    gstPercent: normalizeNumber(gstPercent),
    hsnCode: normalizeText(hsnCode),
    stock: normalizeNumber(stock ?? existing.stock),
    openingStock: normalizeNumber(openingStock ?? existing.openingStock ?? normalizedOpeningStock),
    openingStockValue: normalizeNumber(openingStockValue ?? existing.openingStockValue ?? (normalizedOpeningStock * normalizePrice(purchasePrice))),
  }
}

export async function fetchProducts(options = {}) {
  const forceRefresh = Boolean(options?.forceRefresh)
  const now = Date.now()
  if (!forceRefresh && Array.isArray(cachedProducts) && now - cachedProductsAt < PRODUCTS_CACHE_TTL_MS) return cachedProducts
  if (!forceRefresh && productsRequestPromise) return productsRequestPromise
  productsRequestPromise = (async () => {
    const snapshot = await getDocs(productsCollectionRef)
    const productList = snapshot.docs.map((productDoc) => normalizeProduct(productDoc.id, productDoc.data())).sort((a, b) => a.name.localeCompare(b.name))
    cachedProducts = productList
    cachedProductsAt = Date.now()
    return productList
  })()
  try { return await productsRequestPromise } finally { productsRequestPromise = null }
}

export async function fetchProductById(productId) {
  if (!productId) throw new Error('Product id is required.')
  if (Array.isArray(cachedProducts)) {
    const cachedProduct = cachedProducts.find((product) => product.id === productId)
    if (cachedProduct) return cachedProduct
  }
  const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId))
  return snapshot.exists() ? normalizeProduct(snapshot.id, snapshot.data()) : null
}

export async function createProduct({ name, price, category, sizes, description, sizeChartText, sizeChartImage, imageFiles, imageFile, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock = 0, openingStockValue }) {
  const hasMultipleImages = Array.isArray(imageFiles) && imageFiles.length > 0
  if (!hasMultipleImages && !imageFile) throw new Error('Product image is required.')
  const uploadedImages = hasMultipleImages ? await uploadImages(imageFiles) : [await uploadImage(imageFile)]
  const imageUrl = uploadedImages[0] || ''
  const payload = buildProductPayload({ name, price, category, sizes, description, sizeChartText, sizeChartImage, images: uploadedImages, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, stock: openingStock, openingStock, openingStockValue }, imageUrl)
  await addDoc(productsCollectionRef, payload)
  invalidateProductsCache()
  return payload
}

export async function editProduct(productId, { name, price, category, sizes, description, sizeChartText, sizeChartImage, imageFiles, imageFile, currentImages, currentImageUrl, currentImage, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock, openingStockValue, stock }) {
  const existing = await fetchProductById(productId)
  if (!existing) throw new Error('Product not found.')
  let nextImages = Array.isArray(currentImages) ? normalizeImageList(currentImages) : normalizeImageList([], currentImageUrl || currentImage)
  if (Array.isArray(imageFiles) && imageFiles.length > 0) nextImages = [...nextImages, ...(await uploadImages(imageFiles))]
  else if (imageFile) nextImages = [...nextImages, await uploadImage(imageFile)]
  const imageUrl = nextImages[0] || ''
  const payload = buildProductPayload({ name, price, category, sizes, description, sizeChartText, sizeChartImage, images: nextImages, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock, openingStockValue, stock }, imageUrl, existing)
  if (stock === undefined || stock === null) payload.stock = existing.stock
  if (openingStock === undefined || openingStock === null) payload.openingStock = existing.openingStock
  if (openingStockValue === undefined || openingStockValue === null) payload.openingStockValue = existing.openingStockValue
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), payload)
  invalidateProductsCache()
  return payload
}

export async function removeProduct(productId) {
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId))
  invalidateProductsCache()
}