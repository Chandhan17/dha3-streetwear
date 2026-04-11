import { useMemo, useState } from 'react'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import BrandedNotification from '../components/BrandedNotification'
import clientConfig from '../config'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { useCart } from '../context/CartContext'
import { auth } from '../firebase'
import { createOrder } from '../services/orderService'
import { initiatePayment } from '../services/paymentService'

const CUSTOMER_DETAILS_KEY = 'dhaThreeStreetwearCustomerDetails'

const initialFormState = {
  name: '',
  phone: '',
  doorNo: '',
  street: '',
  city: '',
  pincode: '',
  state: '',
  notes: '',
}

function readStoredCustomerDetails() {
  if (typeof window === 'undefined') {
    return initialFormState
  }

  try {
    const rawValue = window.localStorage.getItem(CUSTOMER_DETAILS_KEY)

    if (!rawValue) {
      return initialFormState
    }

    const parsedValue = JSON.parse(rawValue)

    return {
      name: String(parsedValue?.name || '').trim(),
      phone: String(parsedValue?.phone || '').trim(),
      doorNo: String(parsedValue?.doorNo || '').trim(),
      street: String(parsedValue?.street || parsedValue?.address || '').trim(),
      city: String(parsedValue?.city || '').trim(),
      pincode: String(parsedValue?.pincode || '').trim(),
      state: String(parsedValue?.state || '').trim(),
      notes: String(parsedValue?.notes || '').trim(),
    }
  } catch {
    return initialFormState
  }
}

function persistCustomerDetails(details) {
  try {
    window.localStorage.setItem(CUSTOMER_DETAILS_KEY, JSON.stringify(details))
  } catch {
    // Ignore storage failures.
  }
}

function buildFullAddress({ doorNo, street, city, pincode, state }) {
  return [doorNo, street, city, pincode, state]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ')
}

function buildOrderLines(items) {
  return items.map((item) => {
    const lineTotal = Number(item.price || 0) * Number(item.quantity || 0)
    const sizeLabel = item.selectedSize && item.selectedSize !== 'N/A' ? `, Size ${item.selectedSize}` : ''
    return `${item.name}${sizeLabel} x${item.quantity} - ₹${lineTotal.toLocaleString('en-IN')}`
  })
}

function openWhatsApp(whatsappLink) {
  const popup = window.open(whatsappLink, '_blank', 'noopener,noreferrer')
  if (popup && typeof popup.focus === 'function') {
    popup.focus()
  }
  return Boolean(popup)
}

function CartPage() {
  const { items, cartCount, cartTotal, updateQuantity, removeFromCart, clearCart } = useCart()
  const { errorMessage, showError, clearError } = useBrandedNotification()
  const [customerDetails, setCustomerDetails] = useState(() => readStoredCustomerDetails())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formattedTotal = useMemo(
    () => new Intl.NumberFormat('en-IN').format(cartTotal),
    [cartTotal],
  )

  const hasItems = items.length > 0

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setCustomerDetails((currentDetails) => ({
      ...currentDetails,
      [name]: value,
    }))
    clearError()
  }

  const validateDetails = () => {
    if (!customerDetails.name.trim() || !customerDetails.phone.trim()) {
      showError('Customer name and phone are required')
      return false
    }

    return true
  }

  const saveCartOrder = async (paymentMethod, paymentStatus, paymentResponse = {}) => {
    const fullAddress = buildFullAddress(customerDetails)
    const orderSummary = buildOrderLines(items).join('\n')

    await createOrder({
      userId: auth.currentUser?.uid || 'guest',
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
      })),
      customerDetails: {
        name: customerDetails.name.trim(),
        phone: customerDetails.phone.trim(),
        doorNo: customerDetails.doorNo.trim(),
        street: customerDetails.street.trim(),
        city: customerDetails.city.trim(),
        pincode: customerDetails.pincode.trim(),
        state: customerDetails.state.trim(),
        notes: customerDetails.notes.trim(),
        address: fullAddress,
      },
      paymentMethod,
      paymentStatus,
      orderStatus: paymentStatus === 'paid' ? 'processing' : 'pending',
      paymentId: paymentResponse.paymentId || '',
      paymentOrderId: paymentResponse.orderId || '',
    })

    persistCustomerDetails(customerDetails)

    return { fullAddress, orderSummary }
  }

  const handleWhatsAppCheckout = async () => {
    if (!hasItems) {
      showError('Your cart is empty')
      return
    }

    if (!validateDetails()) {
      return
    }

    setIsSubmitting(true)
    clearError()

    try {
      const { fullAddress, orderSummary } = await saveCartOrder('whatsapp', 'pending')
      const whatsappMessage = [
        'Order Details:',
        orderSummary,
        `Total: ₹${formattedTotal}`,
        '',
        'Customer Details:',
        `Name: ${customerDetails.name.trim()}`,
        `Phone: ${customerDetails.phone.trim()}`,
        `Door No: ${customerDetails.doorNo.trim() || 'N/A'}`,
        `Street: ${customerDetails.street.trim() || 'N/A'}`,
        `City: ${customerDetails.city.trim() || 'N/A'}`,
        `Pincode: ${customerDetails.pincode.trim() || 'N/A'}`,
        `State: ${customerDetails.state.trim() || 'N/A'}`,
        `Address: ${fullAddress || 'N/A'}`,
        `Notes: ${customerDetails.notes.trim() || 'N/A'}`,
      ].join('\n')

      const whatsappLink = `https://wa.me/${String(clientConfig.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
      const wasOpened = openWhatsApp(whatsappLink)

      if (wasOpened) {
        clearCart()
        return
      }

      showError('Unable to open WhatsApp automatically. Please try again')
    } catch (error) {
      showError(error.message || 'Failed to prepare WhatsApp order')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRazorpayCheckout = async () => {
    if (!hasItems) {
      showError('Your cart is empty')
      return
    }

    if (!validateDetails()) {
      return
    }

    setIsSubmitting(true)
    clearError()

    try {
      const fullAddress = buildFullAddress(customerDetails)
      persistCustomerDetails(customerDetails)

      await initiatePayment({
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          selectedSize: item.selectedSize,
        })),
        userId: auth.currentUser?.uid || 'guest',
        customerDetails: {
          name: customerDetails.name.trim(),
          phone: customerDetails.phone.trim(),
          doorNo: customerDetails.doorNo.trim(),
          street: customerDetails.street.trim(),
          city: customerDetails.city.trim(),
          pincode: customerDetails.pincode.trim(),
          state: customerDetails.state.trim(),
          notes: customerDetails.notes.trim(),
          address: fullAddress,
        },
        productName: `${clientConfig.brandName} Cart Order`,
        customerName: customerDetails.name.trim(),
        customerPhone: customerDetails.phone.trim(),
        customerEmail: '',
        productImage: items[0]?.imageUrl || '/dha-logo.png',
        onSuccess: async () => {
          clearCart()
        },
        onFailure: (error) => {
          showError(error.message || 'Payment failed. Please try again')
        },
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
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
                Curated Cart
              </p>
              <h1 className="mt-2 font-display text-3xl md:text-5xl">Your Cart</h1>
            </div>
            <p className="text-sm text-white/65">
              {cartCount} item{cartCount === 1 ? '' : 's'} in your bag
            </p>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4">
            {!hasItems ? (
              <div className="street-panel p-6 text-center text-white/65">
                Your cart is empty. Add pieces from the collection to build your order.
              </div>
            ) : (
              items.map((item) => (
                <article
                  key={item.cartItemId}
                  className="street-panel flex flex-col gap-4 p-4 md:flex-row md:items-center"
                >
                  <img
                    src={item.imageUrl || '/dha-logo.png'}
                    alt={item.name}
                    className="h-28 w-full rounded-2xl object-cover md:h-24 md:w-24"
                    loading="lazy"
                    decoding="async"
                  />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-white md:text-lg">{item.name}</h2>
                        <p className="text-sm text-white/60">
                          {item.category || 'Streetwear'}
                          {item.selectedSize && item.selectedSize !== 'N/A' ? ` · Size ${item.selectedSize}` : ''}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-white">₹{Number(item.price || 0).toLocaleString('en-IN')}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center overflow-hidden rounded-full border border-white/15">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10"
                        >
                          -
                        </button>
                        <span className="min-w-10 px-3 py-1.5 text-center text-sm font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/35 hover:bg-white/5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <section className="street-panel p-5 md:p-6">
              <h2 className="font-display text-2xl">Checkout</h2>

              <div className="mt-4 space-y-3">
                {['name', 'phone', 'doorNo', 'street', 'city', 'pincode', 'state'].map((field) => (
                  <input
                    key={field}
                    name={field}
                    value={customerDetails[field]}
                    onChange={handleInputChange}
                    placeholder={field === 'doorNo' ? 'Door No' : field.charAt(0).toUpperCase() + field.slice(1)}
                    className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
                  />
                ))}
                <textarea
                  name="notes"
                  value={customerDetails.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Notes (optional)"
                  className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
                />
              </div>
            </section>

            <section className="street-panel p-5 md:p-6">
              <div className="flex items-center justify-between text-sm text-white/65">
                <span>Subtotal</span>
                <span>₹{formattedTotal}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-white">
                <span>Total</span>
                <span>₹{formattedTotal}</span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleWhatsAppCheckout}
                  disabled={!hasItems || isSubmitting}
                  className="w-full rounded-full border border-white/20 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleRazorpayCheckout}
                  disabled={!hasItems || isSubmitting}
                  className="w-full rounded-full border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pay with Razorpay
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={!hasItems || isSubmitting}
                  className="w-full rounded-full border border-white/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Cart
                </button>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default CartPage