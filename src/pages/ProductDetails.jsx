import { useEffect, useRef, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import ImageGallery from '../components/ImageGallery'
import Navbar from '../components/Navbar'
import QuickShopModal from '../components/QuickShopModal'
import SizeSelector from '../components/SizeSelector'
import BrandedNotification from '../components/BrandedNotification'
import { useCart } from '../context/CartContext'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { fetchProductById } from '../services/productService'
import { shareProductLink } from '../services/shareService'

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

  if (Array.isArray(sizes)) {
    return sizes.map((size) => normalizeSizeValue(size)).filter(Boolean)
  }

  if (typeof sizes === 'string') {
    return sizes
      .split(',')
      .map((size) => String(size || '').trim())
      .filter(Boolean)
  }

  if (sizes && typeof sizes === 'object') {
    return Object.entries(sizes)
      .filter(([, isEnabled]) => Boolean(isEnabled))
      .map(([size]) => String(size || '').trim())
      .filter(Boolean)
  }

  return []
}

function ProductDetails() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [showSizeError, setShowSizeError] = useState(false)
  const [isSizeShakeActive, setIsSizeShakeActive] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [isQuickShopModalOpen, setIsQuickShopModalOpen] = useState(false)
  const [failedSizeChartImage, setFailedSizeChartImage] = useState('')
  const shakeTimeoutRef = useRef(null)
  const { errorMessage, showError, clearError } = useBrandedNotification()
  const { addToCart } = useCart()

  useEffect(() => {
    let isMounted = true

    const loadProduct = async () => {
      setIsLoading(true)
      setPageError('')
      clearError()

      try {
        const productData = await fetchProductById(id)

        if (!isMounted) {
          return
        }

        if (!productData) {
          setPageError('Product not found.')
          showError('Product not found')
          return
        }

        setProduct(productData)
        setSelectedImage(
          productData.images?.[0] || productData.imageUrl || productData.image || '',
        )
      } catch {
        if (isMounted) {
          setPageError('Unable to load product details. Please try again.')
          showError('Unable to load product details. Please try again')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProduct()

    return () => {
      isMounted = false
    }
  }, [id, clearError, showError])

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        window.clearTimeout(shakeTimeoutRef.current)
      }
    }
  }, [])

  const imageList = useMemo(() => {
    if (!product) {
      return []
    }

    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images
    }

    const fallbackImage = product.imageUrl || product.image || ''
    return fallbackImage ? [fallbackImage] : []
  }, [product])

  useEffect(() => {
    if (imageList.length === 0) {
      return
    }

    if (!selectedImage || !imageList.includes(selectedImage)) {
      setSelectedImage(imageList[0])
    }
  }, [imageList, selectedImage])

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat('en-IN').format(Number(product?.price || 0))
  }, [product?.price])
  const descriptionText = (product?.description || '').trim()
  const productName = String(product?.name || 'Product').trim() || 'Product'
  const categoryName = String(product?.category || 'Uncategorized').trim() || 'Uncategorized'
  const sizeChartImageUrl = String(product?.sizeChartImage || '').trim()
  const hasSizeChartImage =
    Boolean(sizeChartImageUrl) && failedSizeChartImage !== sizeChartImageUrl

  const normalizedSizes = normalizeSizes(product?.sizes)
  const hasSizes = normalizedSizes.length > 0

  const triggerSizeShake = () => {
    setIsSizeShakeActive(false)
    requestAnimationFrame(() => {
      setIsSizeShakeActive(true)
    })

    if (shakeTimeoutRef.current) {
      window.clearTimeout(shakeTimeoutRef.current)
    }

    shakeTimeoutRef.current = window.setTimeout(() => {
      setIsSizeShakeActive(false)
    }, 360)
  }

  const handleAddToCart = () => {
    if (!product) {
      showError('Product not found')
      return
    }

    if (hasSizes && !selectedSize) {
      setShowSizeError(true)
      triggerSizeShake()
      showError('Please select a size')
      return
    }

    addToCart(product, {
      selectedSize: hasSizes ? selectedSize : 'N/A',
    })
    setShowSizeError(false)
    showError('Added to cart', 'success')
  }

  const handleBuyNow = () => {
    if (!product) {
      showError('Product not found')
      return
    }

    if (hasSizes && !selectedSize) {
      setShowSizeError(true)
      triggerSizeShake()
      showError('Please select a size')
      return
    }

    setShowSizeError(false)
    setIsQuickShopModalOpen(true)
  }

  const handleShareProduct = async () => {
    if (!product?.id) {
      showError('Product not found')
      return
    }

    try {
      const { copied, aborted } = await shareProductLink({
        productId: product.id,
        productName,
      })

      if (aborted) {
        return
      }

      if (copied) {
        showError('Link copied', 'success')
      }
    } catch {
      showError('Unable to share this product')
    }
  }

  return (
    <div className="min-h-screen">
      <BrandedNotification message={errorMessage} />
      <Navbar />

      <main className="mx-auto w-full max-w-[1200px] space-y-8 px-4 pb-16 pt-8 md:px-6 md:pt-12">
        {isLoading && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="luxury-panel h-96 animate-pulse bg-white/10" />
            <div className="luxury-panel h-96 animate-pulse bg-white/10" />
          </section>
        )}

        {!isLoading && pageError && (
          <div className="luxury-panel px-4 py-10 text-center text-sm text-red-300">
            {pageError}
          </div>
        )}

        {!isLoading && product && (
          <>
            <section className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
              <ImageGallery
                images={imageList}
                productName={productName}
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
              />

              <div className="luxury-panel space-y-5 p-5 md:p-7">
                <p className="chip w-fit border-white/10 bg-white/[0.06] text-[0.62rem] text-white/75">
                  {categoryName}
                </p>

                <h1 className="font-display text-3xl leading-tight text-white md:text-4xl">
                  {productName}
                </h1>

                <p className="text-3xl font-bold text-accent">Rs. {formattedPrice}</p>

                <p className="text-sm leading-relaxed text-white/70">
                  {descriptionText || 'No product description available'}
                </p>

                <SizeSelector
                  sizes={normalizedSizes}
                  selectedSize={selectedSize}
                  hasError={showSizeError}
                  isShaking={isSizeShakeActive}
                  onSelectSize={(size) => {
                    setSelectedSize(size)
                    setShowSizeError(false)
                    setIsSizeShakeActive(false)
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-black transition hover:-translate-y-0.5 hover:bg-white/90"
                  >
                    Buy Now
                  </button>
                  <button
                    type="button"
                    onClick={handleShareProduct}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    Share
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="luxury-panel space-y-4 p-5 md:p-6">
                <h2 className="font-display text-2xl text-white md:text-3xl">
                  Product Description
                </h2>
                <p className="text-sm leading-relaxed text-white/75">
                  {descriptionText || 'No product description available'}
                </p>
              </div>

              <div className="luxury-panel space-y-4 p-5 md:p-6">
                <h2 className="font-display text-2xl text-white md:text-3xl">
                  Size Chart
                </h2>

                {hasSizeChartImage ? (
                  <img
                    src={sizeChartImageUrl}
                    alt={`${productName} size chart`}
                    className="w-full rounded-xl border border-white/10 bg-black object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailedSizeChartImage(sizeChartImageUrl)}
                  />
                ) : product.sizeChartText ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                    {product.sizeChartText}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-white/55">
                    No size chart available
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      <QuickShopModal
        open={isQuickShopModalOpen}
        onClose={() => setIsQuickShopModalOpen(false)}
        product={product}
        selectedSize={hasSizes ? selectedSize : 'N/A'}
      />
    </div>
  )
}

export default ProductDetails