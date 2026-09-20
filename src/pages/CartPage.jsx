import { useEffect, useMemo, useRef, useState } from 'react'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import BrandedNotification from '../components/BrandedNotification'
import clientConfig from '../config'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { useCart } from '../context/CartContext'
import { auth } from '../firebase'
import { initiatePayment } from '../services/paymentService'
import { fetchProducts } from '../services/productService'

const CUSTOMER_DETAILS_KEY = 'dhaThreeStreetwearCustomerDetails'
const BUY_NOW_CHECKOUT_KEY = 'dhaThreeStreetwearBuyNowCheckout'
const initialFormState = { name: '', phone: '', doorNo: '', street: '', city: '', pincode: '', state: '', notes: '' }

function readStoredCustomerDetails() {
  if (typeof window === 'undefined') return initialFormState
  try {
    const rawValue = window.localStorage.getItem(CUSTOMER_DETAILS_KEY)
    if (!rawValue) return initialFormState
    const parsedValue = JSON.parse(rawValue)
    return {
      name: String(parsedValue?.name || '').trim(), phone: String(parsedValue?.phone || '').trim(), doorNo: String(parsedValue?.doorNo || '').trim(),
      street: String(parsedValue?.street || parsedValue?.address || '').trim(), city: String(parsedValue?.city || '').trim(),
      pincode: String(parsedValue?.pincode || '').trim(), state: String(parsedValue?.state || '').trim(), notes: String(parsedValue?.notes || '').trim(),
    }
  } catch { return initialFormState }
}

function persistCustomerDetails(details) {
  try { window.localStorage.setItem(CUSTOMER_DETAILS_KEY, JSON.stringify(details)) } catch { /* Ignore storage failures. */ }
}

function buildFullAddress({ doorNo, street, city, pincode, state }) {
  return [doorNo, street, city, pincode, state].map((value) => String(value || '').trim()).filter(Boolean).join(', ')
}

function formatCustomerField(value, fallback = 'N/A') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function buildWhatsAppMessage({ customerDetails, items, orderId, paymentId, amount }) {
  const productBlocks = items.map((item) => {
    const price = money(Number(item.price || 0))
    const size = formatCustomerField(item.selectedSize)
    const image = formatCustomerField(item.imageUrl)

    return [
      `Product: ${formatCustomerField(item.name)}`,
      `Price: ₹${price.toLocaleString('en-IN')}`,
      `Size: ${size}`,
      `Image: ${image}`,
    ].join('\n')
  })

  const address = buildFullAddress(customerDetails)
  return [
    'Hi, I want to confirm my order:',
    '',
    productBlocks.join('\n\n'),
    '',
    '✅ Payment Status: Paid',
    `Payment ID: ${formatCustomerField(paymentId)}`,
    `Order ID: ${formatCustomerField(orderId)}`,
    '',
    'Customer Details:',
    `Name: ${formatCustomerField(customerDetails.name)}`,
    `Phone: ${formatCustomerField(customerDetails.phone)}`,
    `Door No: ${formatCustomerField(customerDetails.doorNo)}`,
    `Street: ${formatCustomerField(customerDetails.street)}`,
    `City: ${formatCustomerField(customerDetails.city)}`,
    `Pincode: ${formatCustomerField(customerDetails.pincode)}`,
    `State: ${formatCustomerField(customerDetails.state)}`,
    `Address: ${formatCustomerField(address)}`,
    `Notes: ${formatCustomerField(customerDetails.notes)}`,
    '',
    `Total Paid: ₹${money(amount).toLocaleString('en-IN')}`,
  ].join('\n')
}

function openWhatsAppOrderMessage({ customerDetails, items, orderId, paymentId, amount }) {
  const whatsappNumber = String(clientConfig.whatsappNumber || clientConfig.whatsapp || '').replace(/\D/g, '')
  if (!whatsappNumber) throw new Error('WhatsApp number is not configured')

  const message = buildWhatsAppMessage({ customerDetails, items, orderId, paymentId, amount })
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
  window.location.href = whatsappUrl
}

function CartPage() {
  const { items, cartCount, cartTotal, updateQuantity, removeFromCart, clearCart } = useCart()
  const { errorMessage, showError, clearError } = useBrandedNotification()
  const [customerDetails, setCustomerDetails] = useState(() => readStoredCustomerDetails())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [onlineBill, setOnlineBill] = useState(null)
  const [liveStock, setLiveStock] = useState({})
  const [isCheckingLiveStock, setIsCheckingLiveStock] = useState(true)
  const clearCartRef = useRef(clearCart)
  const buyNowCleanupTimerRef = useRef(null)
  clearCartRef.current = clearCart

  useEffect(() => {
    let isBuyNowCheckout = false
    try { isBuyNowCheckout = window.sessionStorage.getItem(BUY_NOW_CHECKOUT_KEY) === '1' } catch { /* Ignore storage failures. */ }
    if (!isBuyNowCheckout) return undefined

    return () => {
      // React Strict Mode performs a development-only setup/cleanup cycle immediately
      // after mount. Delay the cleanup so a genuine route change clears the temporary
      // Buy Now cart while the Strict Mode remount can cancel the scheduled cleanup.
      buyNowCleanupTimerRef.current = window.setTimeout(() => {
        try { window.sessionStorage.removeItem(BUY_NOW_CHECKOUT_KEY) } catch { /* Ignore storage failures. */ }
        clearCartRef.current()
      }, 0)
    }
  }, [])

  useEffect(() => () => {
    if (buyNowCleanupTimerRef.current) window.clearTimeout(buyNowCleanupTimerRef.current)
  }, [])

  const formattedTotal = useMemo(() => new Intl.NumberFormat('en-IN').format(money(cartTotal)), [cartTotal])
  const hasItems = items.length > 0

  const refreshLiveStock = async () => {
    if (!items.length) {
      setLiveStock({})
      setIsCheckingLiveStock(false)
      return
    }

    try {
      const products = await fetchProducts({ forceRefresh: true })
      const productMap = new Map(products.map((product) => [String(product.id), product]))
      const nextStock = Object.fromEntries(items.map((item) => {
        const product = productMap.get(String(item.productId))
        const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0
        const selectedSize = String(item.selectedSize || 'N/A').trim() || 'N/A'
        const sizeStock = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
        const sizeKey = Object.keys(sizeStock).find((key) => String(key).trim().toLowerCase() === selectedSize.toLowerCase())
        const available = !product
          ? false
          : hasSizes
            ? Number(sizeKey === undefined ? 0 : sizeStock[sizeKey]) > 0
            : Number(product.stock ?? 0) > 0

        return [item.cartItemId, {
          available,
          stock: Number(product?.stock ?? 0),
          selectedSize,
          productFound: Boolean(product),
        }]
      }))
      setLiveStock(nextStock)
    } catch (error) {
      console.error('Live cart stock check failed:', error)
    } finally {
      setIsCheckingLiveStock(false)
    }
  }

  useEffect(() => {
    refreshLiveStock()

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') refreshLiveStock()
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    const intervalId = window.setInterval(refreshLiveStock, 15000)

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.clearInterval(intervalId)
    }
  }, [items])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setCustomerDetails((currentDetails) => ({ ...currentDetails, [name]: value }))
    clearError()
  }

  const validateDetails = () => {
    if (!customerDetails.name.trim() || !customerDetails.phone.trim()) {
      showError('Customer name and phone are required')
      return false
    }
    return true
  }

  const getCartItemAvailability = (item) => liveStock[item.cartItemId]?.available !== false
  const hasUnavailableItems = items.some((item) => liveStock[item.cartItemId]?.available === false)

  const validateLiveStock = async () => {
    const products = await fetchProducts({ forceRefresh: true })
    const productMap = new Map(products.map((product) => [String(product.id), product]))
    const unavailable = []

    items.forEach((item) => {
      const product = productMap.get(String(item.productId))
      const stock = Number(product?.stock ?? 0)
      const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0
      const sizeStock = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
      const selectedSize = String(item.selectedSize || 'N/A').trim() || 'N/A'
      const sizeKey = Object.keys(sizeStock).find((key) => String(key).trim().toLowerCase() === selectedSize.toLowerCase())
      const sizeAvailable = hasSizes ? Number(sizeStock[sizeKey] ?? 0) : null
      if (!product || (hasSizes ? !Number.isFinite(sizeAvailable) || sizeAvailable <= 0 : !Number.isFinite(stock) || stock <= 0)) {
        unavailable.push(hasSizes ? `Size ${selectedSize} of ${item.name} is out of stock` : `${item.name} is out of stock`)
      } else if (item.quantity > (hasSizes ? sizeAvailable : stock)) {
        unavailable.push(hasSizes ? `Only 1 unit of size ${selectedSize} is available for ${item.name}` : `Only ${stock} unit(s) of ${item.name} available`)
      }
    })

    if (unavailable.length > 0) {
      showError(unavailable[0])
      return false
    }
    return true
  }

  const handleContinueToWhatsApp = () => {
    if (!onlineBill) return
    try {
      openWhatsAppOrderMessage({
        customerDetails: onlineBill.customerDetails,
        items: onlineBill.items,
        orderId: onlineBill.orderId,
        paymentId: onlineBill.paymentId,
        amount: onlineBill.amount,
      })
    } catch (error) {
      showError(error.message || 'Payment succeeded, but WhatsApp could not be opened')
    }
  }

  const handleRazorpayCheckout = async () => {
    if (!hasItems) {
      showError('Your cart is empty')
      return
    }
    if (!validateDetails()) return

    setIsSubmitting(true)
    clearError()

    try {
      const stockIsValid = await validateLiveStock()
      if (!stockIsValid) return

      const fullAddress = buildFullAddress(customerDetails)
      persistCustomerDetails(customerDetails)

      await initiatePayment({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, selectedSize: item.selectedSize })),
        userId: auth.currentUser?.uid || 'guest',
        customerDetails: {
          name: customerDetails.name.trim(), phone: customerDetails.phone.trim(), doorNo: customerDetails.doorNo.trim(),
          street: customerDetails.street.trim(), city: customerDetails.city.trim(), pincode: customerDetails.pincode.trim(),
          state: customerDetails.state.trim(), notes: customerDetails.notes.trim(), address: fullAddress,
        },
        productName: `${clientConfig.brandName} Cart Order`,
        customerName: customerDetails.name.trim(),
        customerPhone: customerDetails.phone.trim(),
        customerEmail: '',
        productImage: items[0]?.imageUrl || '/dha-logo.png',
        onSuccess: async ({ orderId, paymentId, amount, baseSubtotal, subtotal, discountPercent, productDiscountAmount, orderDiscountAmount, discountAmount, products: paidProducts }) => {
          const purchasedItems = Array.isArray(paidProducts) && paidProducts.length
            ? paidProducts.map((item) => ({
                productId: item.productId,
                name: item.name,
                price: Number(item.unitPrice || 0),
                imageUrl: item.imageUrl || '',
                selectedSize: item.selectedSize || 'N/A',
                quantity: Number(item.quantity || 1),
              }))
            : [...items]
          const purchasedCustomerDetails = { ...customerDetails }
          try { window.sessionStorage.removeItem(BUY_NOW_CHECKOUT_KEY) } catch { /* Ignore storage failures. */ }
          clearCart()

          setOnlineBill({
            billNo: `ONL-${String(orderId || '').slice(-8).toUpperCase()}`,
            orderId,
            paymentId,
            amount: Number(amount || 0),
            baseSubtotal: Number(baseSubtotal || subtotal || 0),
            subtotal: Number(subtotal || 0),
            discountPercent: Number(discountPercent || 0),
            productDiscountAmount: Number(productDiscountAmount || 0),
            orderDiscountAmount: Number(orderDiscountAmount || 0),
            discountAmount: Number(discountAmount || 0),
            items: purchasedItems,
            customerDetails: purchasedCustomerDetails,
            createdAt: new Date().toISOString(),
          })
        },
        onFailure: (error) => showError(error.message || 'Payment failed. Please try again'),
      })
    } catch (error) {
      showError(error.message || 'Failed to start payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-white">
      <BrandedNotification message={errorMessage} />
      <Navbar />
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #online-bill-overlay,
          #online-bill-overlay * {
            visibility: visible !important;
          }
          #online-bill-overlay {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          #online-bill {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #000 !important;
            background: #fff !important;
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="street-panel overflow-hidden p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Curated Cart</p><h1 className="mt-2 font-display text-3xl md:text-5xl">Your Cart</h1></div><p className="text-sm text-white/65">{cartCount} item{cartCount === 1 ? '' : 's'} in your bag</p></div>
        </section>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4">
            {!hasItems ? <div className="street-panel p-6 text-center text-white/65">Your cart is empty. Add pieces from the collection to build your order.</div> : items.map((item) => {
              const isAvailable = getCartItemAvailability(item)
              return (
              <article key={item.cartItemId} className="street-panel flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <img src={item.imageUrl || '/dha-logo.png'} alt={item.name} className="h-28 w-full rounded-2xl object-cover md:h-24 md:w-24" loading="lazy" decoding="async" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-white md:text-lg">{item.name}</h2>{isCheckingLiveStock ? <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/40">Checking stock...</span> : !isAvailable ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-red-300">Out of stock</span> : null}</div><p className="text-sm text-white/60">{item.category || 'Streetwear'}{item.selectedSize && item.selectedSize !== 'N/A' ? ` · Size ${item.selectedSize}` : ''}</p>{!isAvailable && <p className="text-xs font-medium text-red-300">This item is no longer available in the selected size. Remove it from the cart to continue.</p>}</div><p className="text-lg font-bold text-white">₹{Number(item.price || 0).toLocaleString('en-IN')}</p></div>
                  <div className="flex flex-wrap items-center gap-3"><div className="inline-flex items-center overflow-hidden rounded-full border border-white/15"><button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10">-</button><span className="min-w-10 px-3 py-1.5 text-center text-sm font-semibold text-white">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10">+</button></div><button type="button" onClick={() => removeFromCart(item.cartItemId)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/35 hover:bg-white/5">Remove</button></div>
                </div>
              </article>
              )
            })}
          </section>
          <aside className="space-y-4">
            <section className="street-panel p-5 md:p-6"><h2 className="font-display text-2xl">Checkout</h2><div className="mt-4 space-y-3">{['name', 'phone', 'doorNo', 'street', 'city', 'pincode', 'state'].map((field) => <input key={field} name={field} value={customerDetails[field]} onChange={handleInputChange} placeholder={field === 'doorNo' ? 'Door No' : field.charAt(0).toUpperCase() + field.slice(1)} disabled={isSubmitting} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30" />)}<textarea name="notes" value={customerDetails.notes} onChange={handleInputChange} rows={3} placeholder="Notes (optional)" disabled={isSubmitting} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30" /></div></section>
            <section className="street-panel p-5 md:p-6">
              <div className="flex items-center justify-between text-sm text-white/65"><span>Subtotal</span><span>₹{formattedTotal}</span></div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-white"><span>Total</span><span>₹{formattedTotal}</span></div>
              <p className="mt-3 text-xs text-white/45">Online orders require 100% payment through Razorpay. Paid orders are then forwarded to WhatsApp for store confirmation.</p>
              {hasUnavailableItems && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">One or more items became out of stock after being added to your cart. Remove those items before completing the purchase.</p>}
              <button type="button" onClick={handleRazorpayCheckout} disabled={!hasItems || isSubmitting || isCheckingLiveStock || hasUnavailableItems} className="mt-5 w-full rounded-full border border-white/20 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Processing Payment...' : isCheckingLiveStock ? 'Checking Stock...' : hasUnavailableItems ? 'Remove Out-of-Stock Items' : 'Pay 100% with Razorpay'}</button>
              <button type="button" onClick={clearCart} disabled={!hasItems || isSubmitting} className="mt-3 w-full rounded-full border border-white/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">Clear Cart</button>
            </section>
          </aside>
        </div>
      </main>
      {onlineBill && <div id="online-bill-overlay" className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-2xl">
          <section id="online-bill" className="rounded-3xl bg-white p-6 text-black shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/45">Online Invoice</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">DHA THREE STREETWEAR</h2>
                <p className="mt-1 text-xs text-black/50">Bill No: {onlineBill.billNo}</p>
              </div>
              <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-green-700">Paid</div>
            </div>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Customer</p><p className="mt-1 font-semibold">{formatCustomerField(onlineBill.customerDetails.name)}</p><p className="text-black/60">{formatCustomerField(onlineBill.customerDetails.phone)}</p></div>
              <div className="sm:text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Order Date</p><p className="mt-1 font-semibold">{new Date(onlineBill.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p><p className="text-black/60">Payment: Razorpay</p></div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-black/10">
              {onlineBill.items.map((item, index) => <div key={String(item.productId || item.name) + '-' + String(item.selectedSize || 'N/A') + '-' + index} className="flex items-start justify-between gap-4 border-b border-black/10 p-4 last:border-b-0">
                <div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-black/55">{item.selectedSize && item.selectedSize !== 'N/A' ? 'Size ' + item.selectedSize + ' · ' : ''}Qty {item.quantity}</p></div>
                <p className="shrink-0 font-semibold">₹{money(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString('en-IN')}</p>
              </div>)}
            </div>

            <div className="mt-6 ml-auto max-w-sm space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-black/55">Original Subtotal</span><span>₹{money(onlineBill.baseSubtotal).toLocaleString('en-IN')}</span></div>
              {onlineBill.productDiscountAmount > 0 && <div className="flex justify-between text-green-700"><span>Product Discount</span><span>-₹{money(onlineBill.productDiscountAmount).toLocaleString('en-IN')}</span></div>}
              {onlineBill.orderDiscountAmount > 0 && <div className="flex justify-between text-green-700"><span>Order Discount</span><span>-₹{money(onlineBill.orderDiscountAmount).toLocaleString('en-IN')}</span></div>}
              <div className="flex justify-between border-t border-black/10 pt-3 text-lg font-bold"><span>Total Paid</span><span>₹{money(onlineBill.amount).toLocaleString('en-IN')}</span></div>
            </div>

            <div className="mt-6 rounded-2xl bg-black/[0.04] p-4 text-xs text-black/60">
              <p>Order ID: <span className="font-semibold text-black">{onlineBill.orderId}</span></p>
              <p className="mt-1">Payment ID: <span className="font-semibold text-black">{onlineBill.paymentId}</span></p>
              {buildFullAddress(onlineBill.customerDetails) && <p className="mt-1">Delivery Address: <span className="font-semibold text-black">{buildFullAddress(onlineBill.customerDetails)}</span></p>}
            </div>

            <div className="no-print mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => window.print()} className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-black">Print Bill</button>
              <button type="button" onClick={handleContinueToWhatsApp} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white">Continue to WhatsApp</button>
              <button type="button" onClick={() => setOnlineBill(null)} className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-black">Close</button>
            </div>
          </section>
        </div>
      </div>}
      <Footer />
    </div>
  )
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

export default CartPage
