import { useMemo, useState } from 'react'
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

  const formattedTotal = useMemo(() => new Intl.NumberFormat('en-IN').format(money(cartTotal)), [cartTotal])
  const hasItems = items.length > 0

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

  const validateLiveStock = async () => {
    const products = await fetchProducts({ forceRefresh: true })
    const productMap = new Map(products.map((product) => [String(product.id), product]))
    const unavailable = []

    items.forEach((item) => {
      const product = productMap.get(String(item.productId))
      const stock = Number(product?.stock ?? 0)
      if (!product || !Number.isFinite(stock) || stock <= 0) unavailable.push(`${item.name} is out of stock`)
      else if (item.quantity > stock) unavailable.push(`Only ${stock} unit(s) of ${item.name} available`)
    })

    if (unavailable.length > 0) {
      showError(unavailable[0])
      return false
    }
    return true
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
        onSuccess: async ({ orderId, paymentId, amount }) => {
          const purchasedItems = [...items]
          const purchasedCustomerDetails = { ...customerDetails }
          clearCart()

          try {
            openWhatsAppOrderMessage({
              customerDetails: purchasedCustomerDetails,
              items: purchasedItems,
              orderId,
              paymentId,
              amount,
            })
          } catch (error) {
            showError(error.message || 'Payment succeeded, but WhatsApp could not be opened')
          }
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
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="street-panel overflow-hidden p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Curated Cart</p><h1 className="mt-2 font-display text-3xl md:text-5xl">Your Cart</h1></div><p className="text-sm text-white/65">{cartCount} item{cartCount === 1 ? '' : 's'} in your bag</p></div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4">
            {!hasItems ? <div className="street-panel p-6 text-center text-white/65">Your cart is empty. Add pieces from the collection to build your order.</div> : items.map((item) => (
              <article key={item.cartItemId} className="street-panel flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <img src={item.imageUrl || '/dha-logo.png'} alt={item.name} className="h-28 w-full rounded-2xl object-cover md:h-24 md:w-24" loading="lazy" decoding="async" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-semibold text-white md:text-lg">{item.name}</h2><p className="text-sm text-white/60">{item.category || 'Streetwear'}{item.selectedSize && item.selectedSize !== 'N/A' ? ` · Size ${item.selectedSize}` : ''}</p></div><p className="text-lg font-bold text-white">₹{Number(item.price || 0).toLocaleString('en-IN')}</p></div>
                  <div className="flex flex-wrap items-center gap-3"><div className="inline-flex items-center overflow-hidden rounded-full border border-white/15"><button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10">-</button><span className="min-w-10 px-3 py-1.5 text-center text-sm font-semibold text-white">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10">+</button></div><button type="button" onClick={() => removeFromCart(item.cartItemId)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/35 hover:bg-white/5">Remove</button></div>
                </div>
              </article>
            ))}
          </section>

          <aside className="space-y-4">
            <section className="street-panel p-5 md:p-6"><h2 className="font-display text-2xl">Checkout</h2><div className="mt-4 space-y-3">{['name', 'phone', 'doorNo', 'street', 'city', 'pincode', 'state'].map((field) => <input key={field} name={field} value={customerDetails[field]} onChange={handleInputChange} placeholder={field === 'doorNo' ? 'Door No' : field.charAt(0).toUpperCase() + field.slice(1)} disabled={isSubmitting} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30" />)}<textarea name="notes" value={customerDetails.notes} onChange={handleInputChange} rows={3} placeholder="Notes (optional)" disabled={isSubmitting} className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30" /></div></section>
            <section className="street-panel p-5 md:p-6">
              <div className="flex items-center justify-between text-sm text-white/65"><span>Subtotal</span><span>₹{formattedTotal}</span></div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-white"><span>Total</span><span>₹{formattedTotal}</span></div>
              <p className="mt-3 text-xs text-white/45">Online orders require 100% payment through Razorpay. Paid orders are then forwarded to WhatsApp for store confirmation.</p>
              <button type="button" onClick={handleRazorpayCheckout} disabled={!hasItems || isSubmitting} className="mt-5 w-full rounded-full border border-white/20 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Processing Payment...' : 'Pay 100% with Razorpay'}</button>
              <button type="button" onClick={clearCart} disabled={!hasItems || isSubmitting} className="mt-3 w-full rounded-full border border-white/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">Clear Cart</button>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

export default CartPage
