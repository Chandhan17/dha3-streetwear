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
function invalidateProductsCache() { cachedProducts = null; cachedProductsAt = 0; productsRequestPromise = null }
function normalizeNumber(value) { const numericValue = Number(value); return Number.isFinite(numericValue) ? numericValue : 0 }
function normalizePrice(price) { return normalizeNumber(price) }
function normalizeCategory(category) { return String(category || '').trim() || FALLBACK_CATEGORY }
function normalizeText(value) { return typeof value === 'string' ? value.trim() : '' }
function normalizeSizes(sizes) {
  const normalizeSizeValue = (value) => { if (typeof value === 'string' || typeof value === 'number') return String(value).trim(); if (value && typeof value === 'object') { const candidate = value.size ?? value.value ?? value.label; return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate).trim() : '' } return '' }
  if (typeof sizes === 'string') return [...new Set(sizes.split(',').map((size) => String(size || '').trim()).filter(Boolean))]
  if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) return Object.entries(sizes).filter(([, enabled]) => Boolean(enabled)).map(([size]) => String(size || '').trim()).filter(Boolean)
  if (!Array.isArray(sizes)) return FALLBACK_SIZES
  return [...new Set(sizes.map(normalizeSizeValue).filter(Boolean))]
}
function normalizeSizeStock(sizeStock, sizes) {
  const normalizedSizes = normalizeSizes(sizes)
  if (!normalizedSizes.length) return {}
  const source = sizeStock && typeof sizeStock === 'object' && !Array.isArray(sizeStock) ? sizeStock : {}
  return Object.fromEntries(normalizedSizes.map((size) => [size, source[size] !== undefined ? (normalizeNumber(source[size]) > 0 ? 1 : 0) : 1]))
}
function getTotalSizeStock(sizeStock) { return Object.values(sizeStock || {}).reduce((sum, value) => sum + (Number(value) > 0 ? 1 : 0), 0) }
function normalizeImageList(images, fallbackImage) { if (Array.isArray(images)) { const normalizedImages = images.map((image) => String(image || '').trim()).filter(Boolean); if (normalizedImages.length) return normalizedImages } return fallbackImage ? [fallbackImage] : [] }
function normalizeProduct(productId, productData) {
  const imageUrl = productData.imageUrl || productData.image || ''
  const sizes = normalizeSizes(productData.sizes)
  const sizeStock = normalizeSizeStock(productData.sizeStock, sizes)
  return { id: productId, ...productData, name: normalizeText(productData.name), price: normalizePrice(productData.price), purchasePrice: normalizePrice(productData.purchasePrice), mrp: normalizePrice(productData.mrp), gstPercent: normalizeNumber(productData.gstPercent), hsnCode: normalizeText(productData.hsnCode), sku: normalizeText(productData.sku), barcode: normalizeText(productData.barcode), stock: sizes.length ? getTotalSizeStock(sizeStock) : normalizeNumber(productData.stock), openingStock: normalizeNumber(productData.openingStock), openingStockValue: normalizeNumber(productData.openingStockValue), category: normalizeCategory(productData.category), sizes, sizeStock, description: normalizeText(typeof productData.description === 'object' ? productData.description?.short : productData.description || productData.shortDescription), sizeChartText: normalizeText(productData.sizeChartText), sizeChartImage: normalizeText(productData.sizeChartImage), images: normalizeImageList(productData.images, imageUrl), image: imageUrl, imageUrl }
}
function generateBarcode() { return `890${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}` }
function generateSku(name) { const prefix = String(name || 'ITEM').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'ITEM'; return `${prefix}-${Date.now().toString().slice(-6)}` }
function buildProductPayload(data, imageUrl, existing = {}) {
  const { name, price, category, sizes, description, sizeChartText, sizeChartImage, images, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, stock, openingStock, openingStockValue } = data
  const normalizedSizes = normalizeSizes(sizes)
  const sizeStock = normalizeSizeStock(data.sizeStock ?? existing.sizeStock, normalizedSizes)
  const normalizedImages = normalizeImageList(images, imageUrl); const primaryImage = normalizedImages[0] || ''; const normalizedOpeningStock = normalizeNumber(openingStock)
  const effectiveStock = normalizedSizes.length ? getTotalSizeStock(sizeStock) : normalizeNumber(stock ?? existing.stock)
  return { name: normalizeText(name), price: normalizePrice(price), category: normalizeCategory(category), sizes: normalizedSizes, sizeStock, description: normalizeText(description), sizeChartText: normalizeText(sizeChartText), sizeChartImage: normalizeText(sizeChartImage), images: normalizedImages, image: primaryImage, imageUrl: primaryImage, sku: normalizeText(sku) || existing.sku || generateSku(name), barcode: normalizeText(barcode) || existing.barcode || generateBarcode(), purchasePrice: normalizePrice(purchasePrice), mrp: normalizePrice(mrp || price), gstPercent: normalizeNumber(gstPercent), hsnCode: normalizeText(hsnCode), stock: effectiveStock, openingStock: normalizedSizes.length ? effectiveStock : normalizeNumber(openingStock ?? existing.openingStock ?? normalizedOpeningStock), openingStockValue: normalizeNumber(openingStockValue ?? existing.openingStockValue ?? (effectiveStock * normalizePrice(purchasePrice))), createdAt: existing.createdAt || new Date().toISOString() }
}
export async function fetchProducts(options = {}) { const forceRefresh = Boolean(options?.forceRefresh); const now = Date.now(); if (!forceRefresh && Array.isArray(cachedProducts) && now - cachedProductsAt < PRODUCTS_CACHE_TTL_MS) return cachedProducts; if (!forceRefresh && productsRequestPromise) return productsRequestPromise; productsRequestPromise = (async () => { const snapshot = await getDocs(productsCollectionRef); const list = snapshot.docs.map((item) => normalizeProduct(item.id, item.data())).sort((a, b) => a.name.localeCompare(b.name)); cachedProducts = list; cachedProductsAt = Date.now(); return list })(); try { return await productsRequestPromise } finally { productsRequestPromise = null } }
export async function fetchProductById(productId) { if (!productId) throw new Error('Product id is required.'); if (Array.isArray(cachedProducts)) { const found = cachedProducts.find((product) => product.id === productId); if (found) return found } const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId)); return snapshot.exists() ? normalizeProduct(snapshot.id, snapshot.data()) : null }
export async function createProduct({ name, price, category, sizes, description, sizeChartText, sizeChartImage, imageFiles, imageFile, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock = 0, openingStockValue, allowMissingImage = false }) {
  const hasMultipleImages = Array.isArray(imageFiles) && imageFiles.length > 0
  if (!hasMultipleImages && !imageFile && !allowMissingImage) throw new Error('Product image is required.')
  const uploadedImages = hasMultipleImages ? await uploadImages(imageFiles) : imageFile ? [await uploadImage(imageFile)] : []
  const imageUrl = uploadedImages[0] || ''
  const normalizedSizes = normalizeSizes(sizes)
  const payload = buildProductPayload({ name, price, category, sizes: normalizedSizes, description, sizeChartText, sizeChartImage, images: uploadedImages, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, stock: normalizedSizes.length ? normalizedSizes.length : openingStock, openingStock: normalizedSizes.length ? normalizedSizes.length : openingStock, openingStockValue }, imageUrl)
  const ref = await addDoc(productsCollectionRef, payload); invalidateProductsCache(); return { id: ref.id, ...payload }
}
export async function editProduct(productId, { name, price, category, sizes, description, sizeChartText, sizeChartImage, imageFiles, imageFile, currentImages, currentImageUrl, currentImage, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock, openingStockValue, stock }) { const existing = await fetchProductById(productId); if (!existing) throw new Error('Product not found.'); let nextImages = Array.isArray(currentImages) ? normalizeImageList(currentImages) : normalizeImageList([], currentImageUrl || currentImage); if (Array.isArray(imageFiles) && imageFiles.length) nextImages = [...nextImages, ...(await uploadImages(imageFiles))]; else if (imageFile) nextImages = [...nextImages, await uploadImage(imageFile)]; const payload = buildProductPayload({ name, price, category, sizes, description, sizeChartText, sizeChartImage, images: nextImages, sku, barcode, purchasePrice, mrp, gstPercent, hsnCode, openingStock, openingStockValue, stock, sizeStock: existing.sizeStock }, nextImages[0] || '', existing); if (!normalizeSizes(sizes).length && (stock === undefined || stock === null)) payload.stock = existing.stock; if (!normalizeSizes(sizes).length && (openingStock === undefined || openingStock === null)) payload.openingStock = existing.openingStock; if (openingStockValue === undefined || openingStockValue === null) payload.openingStockValue = existing.openingStockValue; await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), payload); invalidateProductsCache(); return payload }
export async function removeProduct(productId) { await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId)); invalidateProductsCache() }
