import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { shareProductLink } from '../services/shareService'

function normalizeSizes(sizes) {
  const normalizeSizeValue = (value) => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
    if (value && typeof value === 'object') {
      const candidate = value.size ?? value.value ?? value.label
      return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate).trim() : ''
    }
    return ''
  }
  if (Array.isArray(sizes)) return sizes.map(normalizeSizeValue).filter(Boolean)
  if (typeof sizes === 'string') return sizes.split(',').map((size) => String(size || '').trim()).filter(Boolean)
  if (sizes && typeof sizes === 'object') return Object.entries(sizes).filter(([, isEnabled]) => Boolean(isEnabled)).map(([size]) => String(size || '').trim()).filter(Boolean)
  return []
}

function isWithinNewArrivalWindow(createdAt) {
  if (!createdAt) return false
  let createdDate
  try {
    if (typeof createdAt?.toDate === 'function') createdDate = createdAt.toDate()
    else if (typeof createdAt === 'object' && Number.isFinite(Number(createdAt?.seconds))) createdDate = new Date(Number(createdAt.seconds) * 1000)
    else createdDate = new Date(createdAt)
  } catch {
    return false
  }
  if (!(createdDate instanceof Date) || Number.isNaN(createdDate.getTime())) return false
  const ageMs = Date.now() - createdDate.getTime()
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000
}

function ProductCard({ product, showNewTag = false, discountLabel = '', onBuyNowClick, onError }) {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [selectedSize, setSelectedSize] = useState('')
  const [showSizeError, setShowSizeError] = useState(false)
  const [isSizeShakeActive, setIsSizeShakeActive] = useState(false)
  const [hasPrimaryImageError, setHasPrimaryImageError] = useState(false)
  const [hasSecondaryImageError, setHasSecondaryImageError] = useState(false)
  const shakeTimeoutRef = useRef(null)

  const productName = String(product?.name || 'Product').trim() || 'Product'
  const productId = product?.id
  const numericPrice = Number(product?.price || 0)
  const formattedPrice = new Intl.NumberFormat('en-IN').format(numericPrice)
  const categoryLabel = String(product?.category || 'Uncategorized').trim() || 'Uncategorized'
  const stock = Number(product?.stock ?? 0)
  const isOutOfStock = Number.isFinite(stock) && stock <= 0
  const sizeOptions = normalizeSizes(product?.sizes)
  const hasSizes = sizeOptions.length > 0
  const sizeStock = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
  const isNewArrival = isWithinNewArrivalWindow(product?.createdAt)

  const imageList = useMemo(() => {
    if (Array.isArray(product?.images) && product.images.length > 0) return product.images.map((image) => String(image || '').trim()).filter(Boolean)
    const fallbackImage = String(product?.imageUrl || product?.image || '').trim()
    return fallbackImage ? [fallbackImage] : []
  }, [product])

  useEffect(() => () => {
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current)
  }, [])

  const triggerSizeShake = () => {
    setIsSizeShakeActive(false)
    requestAnimationFrame(() => setIsSizeShakeActive(true))
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current)
    shakeTimeoutRef.current = window.setTimeout(() => setIsSizeShakeActive(false), 360)
  }

  const primaryImage = hasPrimaryImageError ? '' : imageList[0] || ''
  const secondaryImage = imageList.length > 1 && !hasSecondaryImageError ? imageList[1] : ''
  const hasAnyImage = Boolean(primaryImage)

  const openProductDetails = () => { if (productId) navigate(`/product/${productId}`) }

  const ensureCanBuy = () => {
    if (isOutOfStock) {
      onError?.('This product is currently out of stock')
      return false
    }
    if (hasSizes && !selectedSize) {
      setShowSizeError(true)
      triggerSizeShake()
      onError?.('Please select a size')
      return false
    }
    if (hasSizes && selectedSize && Object.prototype.hasOwnProperty.call(sizeStock, selectedSize) && Number(sizeStock[selectedSize]) <= 0) {
      onError?.(`Size ${selectedSize} is sold out`)
      return false
    }
    return true
  }

  const handleAddToCart = (event) => {
    event.stopPropagation()
    if (!ensureCanBuy()) return
    addToCart(product, { selectedSize: hasSizes ? selectedSize : 'N/A' })
    onError?.('Added to cart', 'success')
  }

  const handleShareClick = async (event) => {
    event.stopPropagation()
    try {
      const { copied, aborted } = await shareProductLink({ productId, productName })
      if (aborted) return
      if (copied) onError?.('Link copied', 'success')
    } catch {
      onError?.('Unable to share this product')
    }
  }

  const handleBuyNow = (event) => {
    event.stopPropagation()
    if (!ensureCanBuy()) return
    if (typeof onBuyNowClick === 'function') onBuyNowClick(product, hasSizes ? selectedSize : 'N/A')
    else openProductDetails()
  }

  const handleCardKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openProductDetails()
    }
  }

  return (
    <Motion.article role="button" tabIndex={0} onClick={openProductDetails} onKeyDown={handleCardKeyDown} whileHover={{ y: -6, scale: 1.015 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="group surface-elevated animate-rise w-full max-w-[360px] cursor-pointer overflow-hidden border border-white/15 bg-[#0a0a0a] text-white transition duration-500">
      <div className="relative aspect-[3/4] overflow-hidden bg-black">
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          {isNewArrival && <span className="border border-white/20 bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">New Arrival</span>}
          {discountLabel && <span className="border border-white/20 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-black">{discountLabel}</span>}
          {isOutOfStock && <span className="border border-red-300/30 bg-red-500/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white">Out of Stock</span>}
        </div>

        <button type="button" onClick={handleShareClick} aria-label={`Share ${productName}`} className="absolute right-3 top-3 z-10 border border-white/20 bg-black/70 p-2 text-white transition hover:bg-black">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2"><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="M8 12l8-6" /><path d="M8 12l8 6" /></svg>
        </button>

        {!hasAnyImage ? <div className="grid h-full w-full place-items-center bg-black/70 text-xs text-white/60">Image unavailable</div> : <>
          <img src={primaryImage} alt={productName} className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${secondaryImage ? 'opacity-100 group-hover:opacity-0' : 'opacity-100'} group-hover:scale-110 ${isOutOfStock ? 'grayscale opacity-60' : ''}`} loading="lazy" sizes="(min-width: 1280px) 280px, (min-width: 1024px) 30vw, (min-width: 768px) 35vw, 50vw" decoding="async" onError={() => setHasPrimaryImageError(true)} />
          {secondaryImage && <img src={secondaryImage} alt={`${productName} alternate view`} className={`absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100 group-hover:scale-110 ${isOutOfStock ? 'grayscale opacity-60' : ''}`} loading="lazy" sizes="(min-width: 1280px) 280px, (min-width: 1024px) 30vw, (min-width: 768px) 35vw, 50vw" decoding="async" onError={() => setHasSecondaryImageError(true)} />}
        </>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent opacity-80 transition duration-500 group-hover:opacity-100" />
      </div>

      <div className="space-y-3 p-4 md:p-5">
        <p className="w-fit border border-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">{categoryLabel}</p>
        <h3 className="line-clamp-2 min-h-[2.8rem] text-sm font-semibold uppercase tracking-[0.04em] text-white md:text-base">{productName}</h3>
        <p className="font-display text-2xl leading-none text-white md:text-[1.9rem]">₹{formattedPrice}</p>

        {hasSizes && !isOutOfStock && <div className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Available Sizes</p><p className="text-[10px] text-white/40">1 each</p></div><div className={`flex flex-wrap gap-1.5 ${showSizeError && isSizeShakeActive ? 'size-shake' : ''}`}>{sizeOptions.map((size) => { const soldOut = Object.prototype.hasOwnProperty.call(sizeStock, size) && Number(sizeStock[size]) <= 0; const isActive = selectedSize === size; return <button key={`${productId || productName}-${size}`} type="button" disabled={soldOut} onClick={(event) => { event.stopPropagation(); if (soldOut) return; setSelectedSize(size); setShowSizeError(false) }} className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${soldOut ? 'cursor-not-allowed border-black/10 bg-black/10 text-black/25 line-through opacity-40' : isActive ? 'border-white bg-white text-black' : showSizeError ? 'border-red-500 bg-red-500/10 text-red-200 hover:border-red-400' : 'border-white/20 bg-black text-white/80 hover:border-white/45'}`}>{size}</button> })}</div>{showSizeError && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">Select a size to continue</p>}</div>}
        {isOutOfStock && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Currently unavailable</p>}

        <div className="grid gap-1.5 sm:grid-cols-2">
          <button type="button" onClick={handleAddToCart} disabled={isOutOfStock} className="button-polish w-full border-white/35 bg-transparent text-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40">Add to Cart</button>
          <button type="button" onClick={handleBuyNow} disabled={isOutOfStock} className="button-polish w-full border-white/20 bg-white/10 text-white hover:border-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40">Buy Now</button>
        </div>
      </div>
    </Motion.article>
  )
}

export default memo(ProductCard)
