import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function ProductCard({
  product,
  showNewTag = false,
  discountLabel = '',
  onQuickShopClick,
  onError,
}) {
  const navigate = useNavigate()
  const [selectedSize, setSelectedSize] = useState('')
  const [hasImageError, setHasImageError] = useState(false)

  const productName = String(product?.name || 'Product').trim() || 'Product'
  const productId = product?.id
  const numericPrice = Number(product?.price || 0)
  const formattedPrice = new Intl.NumberFormat('en-IN').format(numericPrice)
  const imageSrc = hasImageError ? '' : product?.imageUrl || product?.image || ''
  const categoryLabel = String(product?.category || 'Uncategorized').trim() || 'Uncategorized'
  const sizeOptions = Array.isArray(product?.sizes)
    ? product.sizes.map((size) => String(size || '').trim()).filter((size) => Boolean(size))
    : []
  const hasSizes = sizeOptions.length > 0

  const openProductDetails = () => {
    if (!productId) {
      return
    }

    navigate(`/product/${productId}`)
  }

  const handleOrderClick = (event) => {
    event.stopPropagation()

    if (hasSizes && !selectedSize) {
      if (onError) {
        onError('Please select a size')
      }
      return
    }

    if (onQuickShopClick) {
      onQuickShopClick(product, hasSizes ? selectedSize : 'N/A')
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openProductDetails}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openProductDetails()
        }
      }}
      className="group luxury-panel animate-rise cursor-pointer overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1.5 hover:shadow-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/5 md:aspect-[4/5]">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          {showNewTag && (
            <span className="rounded-full bg-black/75 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white">
              New Arrival
            </span>
          )}
          {discountLabel && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-black">
              {discountLabel}
            </span>
          )}
        </div>

        {hasImageError ? (
          <div className="grid h-full w-full place-items-center bg-black/[0.04] text-xs text-black/55">
            Image unavailable
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={productName}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
            onError={() => setHasImageError(true)}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent opacity-70 transition duration-300 group-hover:opacity-100" />
      </div>

      <div className="space-y-2 p-3 md:space-y-2.5 md:p-4">
        <p className="chip w-fit border-black/15 bg-black/[0.04] text-[0.62rem] text-black/70">
          {categoryLabel}
        </p>
        <h3 className="line-clamp-1 text-base font-semibold text-obsidian md:text-lg">
          {productName}
        </h3>
        <p className="text-lg font-bold text-accent md:text-xl">Rs. {formattedPrice}</p>

        {hasSizes && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
              Available Sizes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sizeOptions.map((size) => {
                const isActive = selectedSize === size

                return (
                  <button
                    key={`${productId || productName}-${size}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSize(size)
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? 'border-obsidian bg-obsidian text-white'
                        : 'border-black/20 bg-white text-black/65 hover:border-black/35 hover:bg-black/[0.04]'
                    }`}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleOrderClick}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-soft transition duration-300 hover:-translate-y-0.5 hover:bg-[#1EBE5D]"
        >
          Quick Shop
        </button>
      </div>
    </article>
  )
}

export default ProductCard