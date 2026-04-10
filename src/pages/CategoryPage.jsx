import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrandedNotification from '../components/BrandedNotification'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import ProductCard from '../components/ProductCard'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { fetchProducts } from '../services/productService'

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase()
}

function CategoryPage() {
  const { categoryName = '' } = useParams()
  const decodedCategoryName = decodeURIComponent(categoryName)
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const { errorMessage, showError, clearError } = useBrandedNotification()

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true)
      clearError()

      try {
        const productList = await fetchProducts()
        setProducts(productList)
      } catch {
        showError('Failed to load products. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [clearError, showError])

  const categoryProducts = useMemo(() => {
    const normalizedCategory = normalizeValue(decodedCategoryName)

    return products.filter(
      (product) => normalizeValue(product.category) === normalizedCategory,
    )
  }, [products, decodedCategoryName])

  return (
    <div className="min-h-screen bg-black text-white">
      <BrandedNotification message={errorMessage} />
      <Navbar />

      <main className="w-full bg-black pb-20 pt-28 md:pt-32">
        <div className="container-section space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-5">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                Category
              </p>
              <h1 className="heading-lg text-4xl text-white md:text-6xl">{decodedCategoryName}</h1>
            </div>

            <Link
              to="/"
              className="inline-flex items-center border border-white/30 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-black"
            >
              Back To Home
            </Link>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="h-72 animate-pulse border border-white/15 bg-white/5" />
              ))}
            </div>
          )}

          {!isLoading && categoryProducts.length === 0 && (
            <div className="border border-white/15 px-6 py-16 text-center text-white/70">
              <p className="text-lg">No products found in this category.</p>
            </div>
          )}

          {!isLoading && categoryProducts.length > 0 && (
            <div className="grid grid-cols-2 justify-items-start gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {categoryProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showNewTag={index < 2}
                  discountLabel={Number(product.price || 0) >= 2000 ? '10% OFF' : ''}
                  onError={showError}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default CategoryPage
