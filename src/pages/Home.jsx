import { useEffect, useMemo, useState } from 'react'
import Filters from '../components/Filters'
import BrandedNotification from '../components/BrandedNotification'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import ProductCard from '../components/ProductCard'
import QuickShopModal from '../components/QuickShopModal'
import clientConfig from '../config'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { fetchProducts } from '../services/productService'

const FALLBACK_CATEGORY = 'Uncategorized'
const CORE_SECTIONS = ['Shirts', 'T-Shirts', 'Jeans', 'Shoes']
const FILTER_CATEGORY_OPTIONS = [
  'All',
  'Shirts',
  'T-Shirts',
  'Jeans',
  'Shoes',
  'Accessories',
]
const FILTER_PRICE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Under Rs.500', value: 'under-500' },
  { label: 'Rs.500 - Rs.1000', value: '500-1000' },
  { label: 'Above Rs.1000', value: 'above-1000' },
]

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
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedSizes, setSelectedSizes] = useState([])
  const [selectedPriceRange, setSelectedPriceRange] = useState('all')

  const [draftCategory, setDraftCategory] = useState('All')
  const [draftSizes, setDraftSizes] = useState([])
  const [draftPriceRange, setDraftPriceRange] = useState('all')
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

  const filterSizeOptions = useMemo(() => {
    const sizes = new Set()
    filteredProducts.forEach((product) => {
      if (Array.isArray(product.sizes)) {
        product.sizes.forEach((size) => {
          const trimmedSize = String(size || '').trim()
          if (trimmedSize) {
            sizes.add(trimmedSize)
          }
        })
      }
    })
    return Array.from(sizes).sort((a, b) => {
      const aNum = Number(a)
      const bNum = Number(b)
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum
      }
      return String(a).localeCompare(String(b))
    })
  }, [filteredProducts])

  const categorySections = useMemo(() => {
    const configured = Array.isArray(clientConfig.productCategories)
      ? clientConfig.productCategories
      : []
    const dataCategories = new Set(
      filteredProducts
        .map((p) => normalizeCategoryName(p.category))
        .filter((c) => Boolean(c) && c !== normalizeCategoryName(FALLBACK_CATEGORY)),
    )
    const sectionTitles = [
      ...configured.filter((c) => dataCategories.has(normalizeCategoryName(c))),
      ...[...dataCategories].filter(
        (c) => !configured.some((configC) => normalizeCategoryName(configC) === c),
      ),
    ]

    return sectionTitles
      .map((title) => ({
        title,
        products: filteredProducts.filter(
          (product) =>
            normalizeCategoryName(product.category) === normalizeCategoryName(title),
        ),
      }))
      .filter((section) => section.products.length > 0)
  }, [filteredProducts])

  const loadProducts = async (forceRefresh = false) => {
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
  }

  const handleProductCardError = (message) => {
    showError(message)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const activeFiltersCount = useMemo(() => {
    let count = 0

    if (selectedCategory !== 'All') {
      count += 1
    }

    if (selectedSizes.length > 0) {
      count += 1
    }

    if (selectedPriceRange !== 'all') {
      count += 1
    }

    return count
  }, [selectedCategory, selectedSizes, selectedPriceRange])

  const openFilters = () => {
    setDraftCategory(selectedCategory)
    setDraftSizes(selectedSizes)
    setDraftPriceRange(selectedPriceRange)
    setIsFiltersOpen(true)
  }

  const closeFilters = () => {
    setIsFiltersOpen(false)
  }

  const toggleDraftSize = (size) => {
    setDraftSizes((currentSizes) =>
      currentSizes.includes(size)
        ? currentSizes.filter((currentSize) => currentSize !== size)
        : [...currentSizes, size],
    )
  }

  const applyFilters = () => {
    setSelectedCategory(draftCategory)
    setSelectedSizes(draftSizes)
    setSelectedPriceRange(draftPriceRange)
    setIsFiltersOpen(false)
  }

  const clearDraftFilters = () => {
    setDraftCategory('All')
    setDraftSizes([])
    setDraftPriceRange('all')
  }

  const handleQuickShopClick = (product, selectedSize = 'N/A') => {
    if (!product) {
      return
    }

    setSelectedProduct({
      ...product,
      selectedSize,
    })
    setShowModal(true)
  }

  const hasNoResults = !isLoading && products.length > 0 && categorySections.length === 0

  return (
    <div className="min-h-screen">
      <BrandedNotification message={errorMessage} />
      <Navbar />
      <Hero />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-10 md:px-6 md:pt-14">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50">
                Curated Collections
              </p>
              <h2 className="mt-2 font-display text-3xl text-obsidian md:text-4xl">
                Shop By Category
              </h2>
            </div>

            <button
              type="button"
              onClick={() => loadProducts(true)}
              className="w-fit rounded-full border border-black/20 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-black/70 transition hover:-translate-y-0.5 hover:bg-black/5"
            >
              Refresh Collection
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/45">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-black/15 bg-white py-2.5 pl-10 pr-4 text-sm text-obsidian outline-none transition focus:border-obsidian"
              />
            </div>

            <Filters
              isOpen={isFiltersOpen}
              onOpen={openFilters}
              onClose={closeFilters}
              categories={FILTER_CATEGORY_OPTIONS}
              sizeOptions={filterSizeOptions}
              priceOptions={FILTER_PRICE_OPTIONS}
              selectedCategory={draftCategory}
              selectedSizes={draftSizes}
              selectedPriceRange={draftPriceRange}
              onCategoryChange={setDraftCategory}
              onToggleSize={toggleDraftSize}
              onPriceRangeChange={setDraftPriceRange}
              onApply={applyFilters}
              onClear={clearDraftFilters}
              activeFiltersCount={activeFiltersCount}
            />
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(8)].map((_, index) => (
              <div
                key={index}
                className="luxury-panel h-72 animate-pulse rounded-2xl bg-white/70"
              />
            ))}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="luxury-panel px-4 py-12 text-center text-black/65">
            No products available yet. Add items from the admin dashboard.
          </div>
        )}

        {hasNoResults && (
          <div className="luxury-panel px-4 py-12 text-center text-black/65">
            No products found
          </div>
        )}

        {!isLoading && categorySections.length > 0 && (
          <div className="space-y-12">
            {categorySections.map((section) => (
              <section key={section.title} className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <h3 className="font-display text-2xl text-obsidian md:text-3xl">
                    {section.title}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    {section.products.length} Styles
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {section.products.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      showNewTag={index < 2}
                      discountLabel={Number(product.price || 0) >= 2000 ? '10% OFF' : ''}
                      onQuickShopClick={handleQuickShopClick}
                      onError={handleProductCardError}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <QuickShopModal
        product={selectedProduct}
        selectedSize={selectedProduct?.selectedSize || 'N/A'}
        open={showModal}
        onClose={() => setShowModal(false)}
      />

      <Footer />
    </div>
  )
}

export default Home