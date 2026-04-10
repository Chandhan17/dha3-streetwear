import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import BrandStrip from '../components/BrandStrip'
import BrandedNotification from '../components/BrandedNotification'
import CategoryGridSection from '../components/CategoryGridSection'
import FeatureSection from '../components/FeatureSection'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import IntroSection from '../components/IntroSection'
import Navbar from '../components/Navbar'
import ProductCard from '../components/ProductCard'
import QuickShopModal from '../components/QuickShopModal'
import clientConfig from '../config'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { fetchProducts } from '../services/productService'

const FALLBACK_CATEGORY = 'Uncategorized'
const fadeUpTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
}

const fadeUpInitial = {
  opacity: 0,
  y: 28,
}

const fadeUpInView = {
  opacity: 1,
  y: 0,
}

function normalizeCategoryName(category) {
  return String(category || FALLBACK_CATEGORY).trim().toLowerCase()
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesPriceRange(price, selectedPriceRange) {
  const safePrice = Number(price || 0)

  if (selectedPriceRange === 'under-500') {
    return safePrice < 500
  }

  if (selectedPriceRange === '500-1000') {
    return safePrice >= 500 && safePrice <= 1000
  }

  if (selectedPriceRange === 'above-1000') {
    return safePrice > 1000
  }

  return true
}

function Home() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory] = useState('All')
  const [selectedSizes] = useState([])
  const [selectedPriceRange] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const { errorMessage, showError, clearError } = useBrandedNotification()

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeValue(searchQuery)
    const normalizedSelectedCategory = normalizeCategoryName(selectedCategory)
    const normalizedSelectedSizes = selectedSizes.map((size) => normalizeValue(size))

    return products.filter((product) => {
      const productName = normalizeValue(product.name)
      const productCategory = normalizeCategoryName(product.category)
      const productSizes = Array.isArray(product.sizes)
        ? product.sizes.map((size) => normalizeValue(size))
        : []

      const matchesSearch = productName.includes(normalizedQuery)
      const matchesCategory =
        selectedCategory === 'All' || productCategory === normalizedSelectedCategory
      const matchesSize =
        normalizedSelectedSizes.length === 0 ||
        normalizedSelectedSizes.some((size) => productSizes.includes(size))
      const matchesPrice = matchesPriceRange(product.price, selectedPriceRange)

      return matchesSearch && matchesCategory && matchesSize && matchesPrice
    })
  }, [products, searchQuery, selectedCategory, selectedSizes, selectedPriceRange])

  const categorySections = useMemo(() => {
    const configured = Array.isArray(clientConfig.productCategories) ? clientConfig.productCategories : []
    const dataCategories = new Set(
      filteredProducts
        .map((product) => normalizeCategoryName(product.category))
        .filter((category) => Boolean(category) && category !== normalizeCategoryName(FALLBACK_CATEGORY)),
    )

    const sectionTitles = [
      ...configured.filter((category) => dataCategories.has(normalizeCategoryName(category))),
      ...[...dataCategories].filter(
        (category) => !configured.some((configuredCategory) => normalizeCategoryName(configuredCategory) === category),
      ),
    ]

    return sectionTitles
      .map((title) => ({
        title,
        products: filteredProducts.filter(
          (product) => normalizeCategoryName(product.category) === normalizeCategoryName(title),
        ),
      }))
      .filter((section) => section.products.length > 0)
  }, [filteredProducts])

  const categoryGridItems = useMemo(() => {
    const configuredCategories = Array.isArray(clientConfig.productCategories)
      ? clientConfig.productCategories
      : []

    const normalizedConfigured = configuredCategories
      .map((category) => String(category || '').trim())
      .filter(Boolean)

    const discoveredCategories = [...new Set(
      products
        .map((product) => String(product?.category || '').trim())
        .filter(Boolean),
    )]

    const preferredCategoryOrder = [...new Set([...normalizedConfigured, ...discoveredCategories])]
      .slice(0, 5)

    return preferredCategoryOrder.map((categoryName) => {
      const firstProductInCategory = products.find(
        (product) => normalizeCategoryName(product.category) === normalizeCategoryName(categoryName),
      )

      const categoryImage = firstProductInCategory?.images?.[0]
        || firstProductInCategory?.imageUrl
        || firstProductInCategory?.image
        || clientConfig.heroImage

      return {
        name: categoryName,
        image: categoryImage,
      }
    })
  }, [products])

  const loadProducts = useCallback(async (forceRefresh = false) => {
    setIsLoading(true)
    clearError()

    try {
      const productList = await fetchProducts({ forceRefresh })
      setProducts(productList)
    } catch {
      showError('Failed to load products. Please refresh and try again')
    } finally {
      setIsLoading(false)
    }
  }, [clearError, showError])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleProductCardError = useCallback((message) => {
    showError(message)
  }, [showError])

  const handleBuyNowClick = useCallback((product, selectedSize = 'N/A') => {
    if (!product) {
      return
    }

    setSelectedProduct({
      ...product,
      selectedSize,
    })
    setShowModal(true)
  }, [])

  const hasActiveSearch = normalizeValue(searchQuery).length > 0
  const hasNoResults = !isLoading && products.length > 0 && categorySections.length === 0

  return (
    <Motion.div
      className="min-h-screen bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <BrandedNotification message={errorMessage} />
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {hasActiveSearch && (
        <Motion.section
          className="w-full bg-white pb-10 pt-24 text-black md:pb-12 md:pt-28"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="container-section space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">Search</p>
              <h2 className="heading-md text-black">Results for "{searchQuery.trim()}"</h2>
              {!isLoading && (
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/55">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Style' : 'Styles'} Found
                </p>
              )}
            </div>

            {isLoading && (
              <div className="grid grid-cols-2 gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-72 animate-pulse border border-black/10 bg-black/5" />
                ))}
              </div>
            )}

            {!isLoading && filteredProducts.length === 0 && (
              <div className="border border-black/15 px-6 py-12 text-center text-black/65">
                <p className="text-lg">No products found</p>
                <p className="text-sm">Try another keyword</p>
              </div>
            )}

            {!isLoading && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 justify-items-start gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={`top-search-${product.id}`}
                    product={product}
                    showNewTag={index < 2}
                    discountLabel={Number(product.price || 0) >= 2000 ? '10% OFF' : ''}
                    onBuyNowClick={handleBuyNowClick}
                    onError={handleProductCardError}
                  />
                ))}
              </div>
            )}
          </div>
        </Motion.section>
      )}

      {!hasActiveSearch && (
        <>
          <Hero />

          <Motion.div
            initial={fadeUpInitial}
            whileInView={fadeUpInView}
            viewport={{ once: true, amount: 0.25 }}
            transition={fadeUpTransition}
          >
            <BrandStrip />
          </Motion.div>

          <Motion.div
            initial={fadeUpInitial}
            whileInView={fadeUpInView}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ ...fadeUpTransition, delay: 0.14 }}
          >
            <IntroSection />
          </Motion.div>

          <Motion.div
            initial={fadeUpInitial}
            whileInView={fadeUpInView}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ ...fadeUpTransition, delay: 0.16 }}
          >
            {categorySections.length > 0 && categorySections[0]?.products.length > 0 && (
              <FeatureSection
                product={categorySections[0].products[0]}
                index={0}
              />
            )}
          </Motion.div>

          <Motion.div
            initial={fadeUpInitial}
            whileInView={fadeUpInView}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ ...fadeUpTransition, delay: 0.18 }}
          >
            <CategoryGridSection items={categoryGridItems} />
          </Motion.div>

          <Motion.main
            id="shop"
            className="w-full bg-white py-16 text-black md:py-20"
            initial={fadeUpInitial}
            whileInView={fadeUpInView}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ ...fadeUpTransition, delay: 0.05 }}
          >
            <div className="container-section space-y-12">
              <Motion.div
                className="space-y-2"
                initial={fadeUpInitial}
                whileInView={fadeUpInView}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ ...fadeUpTransition, delay: 0.08 }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">Shop</p>
                <h2 className="heading-lg text-4xl text-black md:text-6xl">The Collection</h2>
              </Motion.div>

              {isLoading && (
                <div className="grid grid-cols-2 gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                  {[...Array(8)].map((_, index) => (
                    <div key={index} className="h-72 animate-pulse border border-black/10 bg-black/5" />
                  ))}
                </div>
              )}

              {!isLoading && products.length === 0 && (
                <div className="border border-black/15 px-6 py-16 text-center text-black/65">
                  <p className="text-lg">No products available yet.</p>
                  <p className="text-sm">Add items from the admin dashboard.</p>
                </div>
              )}

              {hasNoResults && (
                <div className="border border-black/15 px-6 py-16 text-center text-black/65">
                  <p className="text-lg">No products found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {!isLoading && categorySections.length > 0 && (
                <div className="space-y-16">
                  {categorySections.map((section) => (
                    <Motion.section
                      key={section.title}
                      className="space-y-6"
                      initial={fadeUpInitial}
                      whileInView={fadeUpInView}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={fadeUpTransition}
                    >
                      <Motion.div
                        className="flex items-end justify-between gap-3"
                        initial={fadeUpInitial}
                        whileInView={fadeUpInView}
                        viewport={{ once: true, amount: 0.7 }}
                        transition={{ ...fadeUpTransition, delay: 0.05 }}
                      >
                        <h3 className="heading-md text-black">{section.title}</h3>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45">
                          {section.products.length} Styles
                        </p>
                      </Motion.div>

                      <div className="grid grid-cols-2 justify-items-start gap-5 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                        {section.products.map((product, index) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            showNewTag={index < 2}
                            discountLabel={Number(product.price || 0) >= 2000 ? '10% OFF' : ''}
                            onBuyNowClick={handleBuyNowClick}
                            onError={handleProductCardError}
                          />
                        ))}
                      </div>
                    </Motion.section>
                  ))}
                </div>
              )}
            </div>
          </Motion.main>
        </>
      )}

      <QuickShopModal
        product={selectedProduct}
        selectedSize={selectedProduct?.selectedSize || 'N/A'}
        open={showModal}
        onClose={() => setShowModal(false)}
      />

      <Footer />
    </Motion.div>
  )
}

export default Home
