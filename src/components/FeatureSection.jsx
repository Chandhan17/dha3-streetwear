function FeatureSection({ product, index = 0 }) {
  if (!product) return null

  const isEven = index % 2 === 0
  const imageSrc = product?.imageUrl || product?.image || ''
  const productName = String(product?.name || 'Product').trim() || 'Product'
  const productCategory = String(product?.category || 'Uncategorized').trim() || 'Uncategorized'
  const numericPrice = Number(product?.price || 0)
  const formattedPrice = new Intl.NumberFormat('en-IN').format(numericPrice)

  const handleViewProduct = () => {
    window.location.href = `/product/${product.id}`
  }

  return (
    <section className="w-full bg-black py-16 md:py-20">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 md:grid-cols-2 md:gap-12 md:px-6">
        {/* Image */}
        <div className={`overflow-hidden ${isEven ? 'md:col-start-2' : ''}`}>
          <img
            src={imageSrc}
            alt={productName}
            className="aspect-[4/5] w-full object-cover transition duration-700 hover:scale-105"
          />
        </div>

        {/* Content */}
        <div
          className={`space-y-4 text-white ${isEven ? 'md:col-start-1 md:row-start-1' : ''}`}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
              {productCategory}
            </p>
            <h3 className="heading-lg text-5xl md:text-6xl">CHAMPION</h3>
          </div>

          <p className="max-w-md text-xs leading-relaxed text-white/65 md:text-sm">
            The best t-shirt this season. Curated for a clean streetwear look with sharp details and everyday comfort.
          </p>

          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl md:text-5xl">
              ₹{formattedPrice}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
              Premium Quality
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleViewProduct}
              className="border border-white px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-white hover:text-black"
            >
              Shop Now
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FeatureSection
