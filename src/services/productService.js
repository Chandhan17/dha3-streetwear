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

function normalizePrice(price) {
  const numericPrice = Number(price)
  return Number.isFinite(numericPrice) ? numericPrice : 0
}

function normalizeCategory(category) {
  return String(category || '').trim() || FALLBACK_CATEGORY
}

function normalizeSizes(sizes) {
  const normalizeSizeValue = (value) => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim()
    }

    if (value && typeof value === 'object') {
      const candidate = value.size ?? value.value ?? value.label
      return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate).trim()
        : ''
    }

    return ''
  }

  if (typeof sizes === 'string') {
    return sizes
      .split(',')
      .map((size) => String(size || '').trim())
      .filter((size) => Boolean(size))
  }

  if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) {
    return Object.entries(sizes)
      .filter(([, isEnabled]) => Boolean(isEnabled))
      .map(([size]) => String(size || '').trim())
      .filter((size) => Boolean(size))
  }

  if (!Array.isArray(sizes)) {
    return FALLBACK_SIZES
  }

  return sizes
    .map((size) => normalizeSizeValue(size))
    .filter((size) => Boolean(size))
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDescriptionValue(productData) {
  const rawDescription = productData.description

  if (typeof rawDescription === 'string') {
    return normalizeText(rawDescription)
  }

  if (rawDescription && typeof rawDescription === 'object' && !Array.isArray(rawDescription)) {
    return normalizeText(rawDescription.short)
  }

  return normalizeText(productData.shortDescription)
}

function normalizeSizeChartText(value) {
  return normalizeText(value)
}

function normalizeSizeChartImage(value) {
  return normalizeText(value)
}

function normalizeImageList(images, fallbackImage) {
  if (Array.isArray(images)) {
    const normalizedImages = images
      .map((image) => String(image || '').trim())
      .filter((image) => Boolean(image))

    if (normalizedImages.length > 0) {
      return normalizedImages
    }
  }

  return fallbackImage ? [fallbackImage] : []
}

function normalizeProduct(productId, productData) {
  const imageUrl = productData.imageUrl || productData.image || ''
  const category = normalizeCategory(productData.category)
  const sizes = normalizeSizes(productData.sizes)
  const description = normalizeDescriptionValue(productData)
  const sizeChartText = normalizeSizeChartText(productData.sizeChartText)
  const sizeChartImage = normalizeSizeChartImage(productData.sizeChartImage)
  const images = normalizeImageList(productData.images, imageUrl)

  return {
    id: productId,
    ...productData,
    category,
    sizes,
    description,
    sizeChartText,
    sizeChartImage,
    images,
    image: imageUrl,
    imageUrl,
  }
}

function buildProductPayload(
  { name, price, category, sizes, description, sizeChartText, sizeChartImage, images },
  imageUrl,
) {
  const normalizedImages = normalizeImageList(images, imageUrl)
  const primaryImage = normalizedImages[0] || ''

  return {
    name: name.trim(),
    price: normalizePrice(price),
    category: normalizeCategory(category),
    sizes: normalizeSizes(sizes),
    description: normalizeText(description),
    sizeChartText: normalizeSizeChartText(sizeChartText),
    sizeChartImage: normalizeSizeChartImage(sizeChartImage),
    images: normalizedImages,
    image: primaryImage,
    imageUrl: primaryImage,
  }
}

export async function fetchProducts(options = {}) {
  const forceRefresh = Boolean(options?.forceRefresh)
  const now = Date.now()

  if (
    !forceRefresh
    && Array.isArray(cachedProducts)
    && now - cachedProductsAt < PRODUCTS_CACHE_TTL_MS
  ) {
    return cachedProducts
  }

  if (!forceRefresh && productsRequestPromise) {
    return productsRequestPromise
  }

  productsRequestPromise = (async () => {
    const snapshot = await getDocs(productsCollectionRef)
    const productList = snapshot.docs
      .map((productDoc) => normalizeProduct(productDoc.id, productDoc.data()))
      .sort((a, b) => a.name.localeCompare(b.name))

    cachedProducts = productList
    cachedProductsAt = Date.now()

    return productList
  })()

  try {
    return await productsRequestPromise
  } finally {
    productsRequestPromise = null
  }
}

export async function fetchProductById(productId) {
  if (!productId) {
    throw new Error('Product id is required.')
  }

  if (Array.isArray(cachedProducts)) {
    const cachedProduct = cachedProducts.find((product) => product.id === productId)

    if (cachedProduct) {
      return cachedProduct
    }
  }

  const productRef = doc(db, PRODUCTS_COLLECTION, productId)
  const snapshot = await getDoc(productRef)

  if (!snapshot.exists()) {
    return null
  }

  return normalizeProduct(snapshot.id, snapshot.data())
}

export async function createProduct({
  name,
  price,
  category,
  sizes,
  description,
  sizeChartText,
  sizeChartImage,
  imageFiles,
  imageFile,
}) {
  const hasMultipleImages = Array.isArray(imageFiles) && imageFiles.length > 0

  if (!hasMultipleImages && !imageFile) {
    throw new Error('Product image is required.')
  }

  const uploadedImages = hasMultipleImages
    ? await uploadImages(imageFiles)
    : [await uploadImage(imageFile)]
  const imageUrl = uploadedImages[0] || ''
  const payload = buildProductPayload(
    {
      name,
      price,
      category,
      sizes,
      description,
      sizeChartText,
      sizeChartImage,
      images: uploadedImages,
    },
    imageUrl,
  )

  await addDoc(productsCollectionRef, payload)
  invalidateProductsCache()
}

export async function editProduct(
  productId,
  {
    name,
    price,
    category,
    sizes,
    description,
    sizeChartText,
    sizeChartImage,
    imageFiles,
    imageFile,
    currentImages = undefined,
    currentImageUrl = '',
    currentImage = '',
  },
) {
  let nextImages = Array.isArray(currentImages)
    ? normalizeImageList(currentImages)
    : (currentImageUrl || currentImage)
      ? normalizeImageList([], currentImageUrl || currentImage)
      : []

  if (Array.isArray(imageFiles) && imageFiles.length > 0) {
    const uploadedImages = await uploadImages(imageFiles)
    nextImages = [...nextImages, ...uploadedImages]
  } else if (imageFile) {
    nextImages = [...nextImages, await uploadImage(imageFile)]
  }

  const imageUrl = nextImages[0] || ''

  const payload = buildProductPayload(
    {
      name,
      price,
      category,
      sizes,
      description,
      sizeChartText,
      sizeChartImage,
      images: nextImages,
    },
    imageUrl,
  )
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), payload)
  invalidateProductsCache()
}

export async function removeProduct(productId) {
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId))
  invalidateProductsCache()
}