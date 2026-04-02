import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import ImageGallery from '../components/ImageGallery'
import Navbar from '../components/Navbar'
import QuickShopModal from '../components/QuickShopModal'
import SizeSelector from '../components/SizeSelector'
import BrandedNotification from '../components/BrandedNotification'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { fetchProductById } from '../services/productService'

function ProductDetails() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImage, setSelectedImage] = useState('')
  const [isQuickShopModalOpen, setIsQuickShopModalOpen] = useState(false)
  const [failedSizeChartImage, setFailedSizeChartImage] = useState('')
  const { errorMessage, showError, clearError } = useBrandedNotification()

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
  }, [id])

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

  const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0

  const handleQuickShop = () => {
    if (!product) {
      showError('Product not found')
      return
    }

    if (hasSizes && !selectedSize) {
      showError('Please select a size')
      return
    }

    setIsQuickShopModalOpen(true)
  }

  return (
    <div className="min-h-screen">
      <BrandedNotification message={errorMessage} />
      <Navbar />

      <main className="mx-auto w-full max-w-[1200px] space-y-8 px-4 pb-16 pt-8 md:px-6 md:pt-12">
        {isLoading && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="luxury-panel h-96 animate-pulse bg-white/70" />
            <div className="luxury-panel h-96 animate-pulse bg-white/70" />
          </section>
        )}

        {!isLoading && pageError && (
          <div className="luxury-panel px-4 py-10 text-center text-sm text-red-700">
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
                <p className="chip w-fit border-black/10 bg-black/[0.04] text-[0.62rem] text-black/70">
                  {categoryName}
                </p>

                <h1 className="font-display text-3xl leading-tight text-obsidian md:text-4xl">
                  {productName}
                </h1>

                <p className="text-3xl font-bold text-accent">Rs. {formattedPrice}</p>

                <p className="text-sm leading-relaxed text-black/70">
                  {descriptionText || 'No product description available'}
                </p>

                <SizeSelector
                  sizes={product.sizes}
                  selectedSize={selectedSize}
                  onSelectSize={setSelectedSize}
                />

                <button
                  type="button"
                  onClick={handleQuickShop}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#1EBE5D]"
                >
                  Quick Shop
                </button>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="luxury-panel space-y-4 p-5 md:p-6">
                <h2 className="font-display text-2xl text-obsidian md:text-3xl">
                  Product Description
                </h2>
                <p className="text-sm leading-relaxed text-black/75">
                  {descriptionText || 'No product description available'}
                </p>
              </div>

              <div className="luxury-panel space-y-4 p-5 md:p-6">
                <h2 className="font-display text-2xl text-obsidian md:text-3xl">
                  Size Chart
                </h2>

                {hasSizeChartImage ? (
                  <img
                    src={sizeChartImageUrl}
                    alt={`${productName} size chart`}
                    className="w-full rounded-xl border border-black/10 bg-white object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailedSizeChartImage(sizeChartImageUrl)}
                  />
                ) : product.sizeChartText ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-black/75">
                    {product.sizeChartText}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-black/55">
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