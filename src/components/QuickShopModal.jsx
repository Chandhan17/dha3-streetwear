import { useEffect, useState } from 'react'
import BrandedNotification from './BrandedNotification'
import clientConfig from '../config'
import { useBrandedNotification } from '../hooks/useBrandedNotification'
import { auth } from '../firebase'
import { initiatePayment } from '../services/paymentService'
import { createOrder } from '../services/orderService'

const CUSTOMER_DETAILS_STORAGE_KEY = 'quickShopCustomerDetails'

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

const initialErrorState = {
  name: '',
  phone: '',
  doorNo: '',
  street: '',
  city: '',
  pincode: '',
  state: '',
}

function getStoredCustomerDetails() {
  try {
    const rawValue = window.localStorage.getItem(CUSTOMER_DETAILS_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || typeof parsedValue !== 'object') {
      return null
    }

    return {
      name: typeof parsedValue.name === 'string' ? parsedValue.name : '',
      phone: typeof parsedValue.phone === 'string' ? parsedValue.phone : '',
      doorNo: typeof parsedValue.doorNo === 'string' ? parsedValue.doorNo : '',
      street:
        typeof parsedValue.street === 'string'
          ? parsedValue.street
          : typeof parsedValue.address === 'string'
            ? parsedValue.address
            : '',
      city: typeof parsedValue.city === 'string' ? parsedValue.city : '',
      pincode: typeof parsedValue.pincode === 'string' ? parsedValue.pincode : '',
      state: typeof parsedValue.state === 'string' ? parsedValue.state : '',
    }
  } catch {
    return null
  }
}

function persistCustomerDetails({ name, phone, doorNo, street, city, pincode, state }) {
  try {
    const valueToStore = JSON.stringify({ name, phone, doorNo, street, city, pincode, state })
    window.localStorage.setItem(CUSTOMER_DETAILS_STORAGE_KEY, valueToStore)
  } catch {
    // Ignore storage failures so ordering flow is never blocked.
  }
}

function buildFullAddress({ doorNo, street, city, pincode, state }) {
  return [doorNo, street, city, pincode, state]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ')
}

function openWhatsAppWithFallback(whatsappLink) {
  try {
    // Avoid false-negative popup detection in some browsers.
    const popup = window.open(whatsappLink, '_blank')
    if (!popup) {
      return false
    }

    try {
      if (typeof popup.focus === 'function') {
        popup.focus()
      }
    } catch {
      // Focus can fail on some browsers/extensions even when tab opened successfully.
    }

    return true
  } catch {
    return false
  }
}

function QuickShopModal({
  isOpen,
  open,
  onClose,
  onSubmit,
  product,
  selectedSize,
  productName,
  price,
  size,
}) {
  const [formValues, setFormValues] = useState(() => {
    const storedDetails = getStoredCustomerDetails()
    return {
      name: storedDetails?.name || '',
      phone: storedDetails?.phone || '',
      doorNo: storedDetails?.doorNo || '',
      street: storedDetails?.street || '',
      city: storedDetails?.city || '',
      pincode: storedDetails?.pincode || '',
      state: storedDetails?.state || '',
      notes: '',
    }
  })
  const [errors, setErrors] = useState(initialErrorState)
  const [isProcessing, setIsProcessing] = useState(false)
  const [manualWhatsAppLink, setManualWhatsAppLink] = useState('')
  const { errorMessage, showError, clearError } = useBrandedNotification()
  const modalOpen = typeof isOpen === 'boolean' ? isOpen : Boolean(open)

  const resolvedProductName = String(product?.name || productName || '').trim()
  const numericPrice = Number(product?.price ?? price ?? 0)
  const formattedPrice = new Intl.NumberFormat('en-IN').format(numericPrice)
  const resolvedSize = String(selectedSize || product?.selectedSize || size || 'N/A').trim()
  const resolvedImageUrl = String(
    product?.imageUrl || product?.image || product?.images?.[0] || '',
  ).trim()
  const sanitizedPhone = String(clientConfig.whatsapp || clientConfig.whatsappNumber || '').replace(/\D/g, '')

  useEffect(() => {
    if (!modalOpen) {
      return
    }

    const handleEscapePress = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscapePress)

    return () => {
      window.removeEventListener('keydown', handleEscapePress)
    }
  }, [modalOpen, onClose])

  if (!modalOpen) {
    return null
  }

  const validateForm = () => {
    const nextErrors = {
      name: formValues.name.trim() ? '' : 'Name is required.',
      phone: formValues.phone.trim() ? '' : 'Phone number is required.',
      doorNo: formValues.doorNo.trim() ? '' : 'Door No is required.',
      street: formValues.street.trim() ? '' : 'Street is required.',
      city: formValues.city.trim() ? '' : 'City is required.',
      pincode: formValues.pincode.trim() ? '' : 'Pincode is required.',
      state: formValues.state.trim() ? '' : 'State is required.',
    }

    setErrors(nextErrors)

    if (nextErrors.name || nextErrors.phone || nextErrors.address) {
      showError('Please fill all required details')
    }

    return (
      !nextErrors.name &&
      !nextErrors.phone &&
      !nextErrors.doorNo &&
      !nextErrors.street &&
      !nextErrors.city &&
      !nextErrors.pincode &&
      !nextErrors.state
    )
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target

    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }))

    if (errors[name]) {
      setErrors((previousErrors) => ({
        ...previousErrors,
        [name]: '',
      }))
    }

    clearError()

    if (manualWhatsAppLink) {
      setManualWhatsAppLink('')
    }
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!resolvedProductName) {
      showError('Product not found')
      return
    }

    if (!sanitizedPhone) {
      showError('WhatsApp number is not configured')
      return
    }

    setIsProcessing(true)
    clearError()
    setManualWhatsAppLink('')

    try {
      const payload = {
        name: formValues.name.trim(),
        phone: formValues.phone.trim(),
        doorNo: formValues.doorNo.trim(),
        street: formValues.street.trim(),
        city: formValues.city.trim(),
        pincode: formValues.pincode.trim(),
        state: formValues.state.trim(),
        notes: formValues.notes.trim(),
      }
      const fullAddress = buildFullAddress(payload)

      await createOrder({
        userId: auth.currentUser?.uid || 'guest',
        productId: product?.id || '',
        quantity: 1,
        selectedSize: resolvedSize,
        customerDetails: {
          name: payload.name,
          phone: payload.phone,
          doorNo: payload.doorNo,
          street: payload.street,
          city: payload.city,
          pincode: payload.pincode,
          state: payload.state,
          notes: payload.notes,
          address: fullAddress,
        },
        paymentMethod: 'whatsapp',
        orderStatus: 'pending',
      })

      persistCustomerDetails(payload)
      if (onSubmit) {
        onSubmit(payload)
      }

      const imageLine = resolvedImageUrl ? `\nImage: ${resolvedImageUrl}` : ''
      const whatsappMessage = `Hi, I want to order:\nProduct: ${resolvedProductName}\nPrice: ₹${formattedPrice}\nSize: ${resolvedSize || 'N/A'}${imageLine}\n\n💳 Payment Status: Pending\n\nCustomer Details:\nName: ${payload.name}\nPhone: ${payload.phone}\nDoor No: ${payload.doorNo}\nStreet: ${payload.street}\nCity: ${payload.city}\nPincode: ${payload.pincode}\nState: ${payload.state}\nAddress: ${fullAddress}\nNotes: ${payload.notes || 'N/A'}`
      const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(whatsappMessage)}`

      window.open(whatsappLink, '_blank', 'noopener,noreferrer')
      onClose()
      setFormValues(initialFormState)
      setErrors(initialErrorState)
    } catch (error) {
      console.error('Error saving WhatsApp order:', error)
      showError(error.message || 'Failed to save order. Please try again')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentClick = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!resolvedProductName) {
      showError('Product not found')
      return
    }

    if (numericPrice <= 0) {
      showError('Invalid product price')
      return
    }

    if (!sanitizedPhone) {
      showError('WhatsApp number is not configured')
      return
    }

    const payload = {
      name: formValues.name.trim(),
      phone: formValues.phone.trim(),
      doorNo: formValues.doorNo.trim(),
      street: formValues.street.trim(),
      city: formValues.city.trim(),
      pincode: formValues.pincode.trim(),
      state: formValues.state.trim(),
      notes: formValues.notes.trim(),
    }
    const fullAddress = buildFullAddress(payload)

    setIsProcessing(true)
    clearError()
    setManualWhatsAppLink('')

    try {
      persistCustomerDetails(payload)

      await initiatePayment({
        productId: product?.id || '',
        quantity: 1,
        userId: auth.currentUser?.uid || 'guest',
        customerDetails: {
          name: payload.name,
          phone: payload.phone,
          doorNo: payload.doorNo,
          street: payload.street,
          city: payload.city,
          pincode: payload.pincode,
          state: payload.state,
          notes: payload.notes,
          address: fullAddress,
        },
        productName: resolvedProductName,
        customerName: payload.name,
        customerPhone: payload.phone,
        customerEmail: '',
        productImage: resolvedImageUrl || '/logo.png',
        onSuccess: async (response) => {
          try {
            showError('Payment successful and order saved', 'success')
            
            // Send WhatsApp message BEFORE alert (alert can block popups)
            const imageLine = resolvedImageUrl ? `\nImage: ${resolvedImageUrl}` : ''
            const whatsappMessage = `Hi, I want to confirm my order:\nProduct: ${resolvedProductName}\nPrice: ₹${formattedPrice}\nSize: ${resolvedSize || 'N/A'}${imageLine}\n\n💳 Payment Status: Paid\nPayment ID: ${response.paymentId}\nOrder ID: ${response.orderId}\n\nCustomer Details:\nName: ${payload.name}\nPhone: ${payload.phone}\nDoor No: ${payload.doorNo}\nStreet: ${payload.street}\nCity: ${payload.city}\nPincode: ${payload.pincode}\nState: ${payload.state}\nAddress: ${fullAddress}\nNotes: ${payload.notes || 'N/A'}`
            const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(whatsappMessage)}`

            const isOpened = openWhatsAppWithFallback(whatsappLink)

            if (!isOpened) {
              setManualWhatsAppLink(whatsappLink)
              showError('Unable to open WhatsApp automatically. Click the button below to open in a new tab')
              return
            }
            
            if (onSubmit) {
              onSubmit(payload)
            }

            onClose()
            setFormValues(initialFormState)
            setErrors(initialErrorState)
          } catch (error) {
            console.error('Error saving paid order:', error)
            showError('Payment successful, but failed to save order. Please contact support')
          }
        },
        onFailure: (error) => {
          console.error('Payment failed:', error)
          showError(error.message || 'Payment failed. Please try again')
        },
      })
    } catch (error) {
      console.error('Payment initiation error:', error)
      showError(error.message || 'Failed to initiate payment. Please try again')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center"
      onClick={onClose}
    >
      <BrandedNotification message={errorMessage} />
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-5 shadow-2xl md:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Buy now customer details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 shrink-0">
          <h2 className="font-display text-2xl text-white">Buy Now</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Confirm your details to place order for {resolvedProductName || 'this product'}
            {' '}
            (Rs. {formattedPrice}, Size: {resolvedSize || 'N/A'}).
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1">
            <div>
            <input
              id="customerName"
              name="name"
              type="text"
              value={formValues.name}
              onChange={handleInputChange}
              disabled={isProcessing}
              className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                errors.name ? 'border-red-400' : 'border-white/15 focus:border-white/35'
              } ${isProcessing ? 'opacity-50' : ''}`}
              placeholder="Name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
            <input
              id="customerPhone"
              name="phone"
              type="tel"
              value={formValues.phone}
              onChange={handleInputChange}
              disabled={isProcessing}
              className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                errors.phone ? 'border-red-400' : 'border-white/15 focus:border-white/35'
              } ${isProcessing ? 'opacity-50' : ''}`}
              placeholder="Phone"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div>
            <input
              id="customerDoorNo"
              name="doorNo"
              type="text"
              value={formValues.doorNo}
              onChange={handleInputChange}
              disabled={isProcessing}
              className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                errors.doorNo ? 'border-red-400' : 'border-white/15 focus:border-white/35'
              } ${isProcessing ? 'opacity-50' : ''}`}
              placeholder="Door No"
            />
            {errors.doorNo && <p className="mt-1 text-xs text-red-600">{errors.doorNo}</p>}
            </div>

            <div>
            <input
              id="customerStreet"
              name="street"
              type="text"
              value={formValues.street}
              onChange={handleInputChange}
              disabled={isProcessing}
              className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                errors.street ? 'border-red-400' : 'border-white/15 focus:border-white/35'
              } ${isProcessing ? 'opacity-50' : ''}`}
              placeholder="Street Name"
            />
            {errors.street && <p className="mt-1 text-xs text-red-600">{errors.street}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
              <input
                id="customerCity"
                name="city"
                type="text"
                value={formValues.city}
                onChange={handleInputChange}
                disabled={isProcessing}
                className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                  errors.city ? 'border-red-400' : 'border-white/15 focus:border-white/35'
                } ${isProcessing ? 'opacity-50' : ''}`}
                placeholder="City"
              />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
              </div>

              <div>
              <input
                id="customerPincode"
                name="pincode"
                type="text"
                value={formValues.pincode}
                onChange={handleInputChange}
                disabled={isProcessing}
                className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                  errors.pincode ? 'border-red-400' : 'border-white/15 focus:border-white/35'
                } ${isProcessing ? 'opacity-50' : ''}`}
                placeholder="Pincode"
              />
              {errors.pincode && <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>}
              </div>
            </div>

            <div>
              <input
                id="customerState"
                name="state"
                type="text"
                value={formValues.state}
                onChange={handleInputChange}
                disabled={isProcessing}
                className={`mt-1.5 w-full rounded-xl border bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 ${
                  errors.state ? 'border-red-400' : 'border-white/15 focus:border-white/35'
                } ${isProcessing ? 'opacity-50' : ''}`}
                placeholder="State"
              />
              {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
            </div>

            <div>
            <label htmlFor="customerNotes" className="text-sm font-semibold text-white">
              Notes (Optional)
            </label>
            <textarea
              id="customerNotes"
              name="notes"
              rows={2}
              value={formValues.notes}
              onChange={handleInputChange}
              disabled={isProcessing}
              className={`mt-1.5 w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/35 ${
                isProcessing ? 'opacity-50' : ''
              }`}
              placeholder="Any special requests"
            />
            </div>

            {manualWhatsAppLink && (
              <a
                href={manualWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1EBE5D]"
              >
                Open WhatsApp in New Tab
              </a>
            )}
          </div>

          <div className="mt-3 shrink-0 flex flex-col gap-2 border-t border-white/10 bg-[#0b0b0b] pt-3">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1EBE5D] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Send on WhatsApp'}
              </button>
            </div>

            <button
              type="button"
              onClick={handlePaymentClick}
              disabled={isProcessing}
              className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? 'Processing Payment...' : 'Pay Now with Razorpay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default QuickShopModal
