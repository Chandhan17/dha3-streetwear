import clientConfig from '../config'

const API_URL = String(import.meta.env.VITE_API_URL || '').trim()

function getApiUrl() {
  if (!API_URL) throw new Error('Missing VITE_API_URL environment variable')
  return API_URL
}

function createReservationToken() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  } catch { /* Ignore crypto access failures. */ }
  return 'checkout_' + Date.now() + '_' + Math.random().toString(36).slice(2)
}

async function post(path, body) {
  const endpoint = `${getApiUrl()}${path}`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) throw new Error(data.error || data.message || `Request failed: ${response.statusText}`)
    return data
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`Network request failed for ${endpoint}. Check API URL, TLS certificate, CORS, and backend availability.`)
    throw error
  }
}

export const createOrder = async (payload) => post('/api/create-order', payload)
export const verifyPayment = async (orderId, paymentId, signature) => post('/api/verify-payment', { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature })
export const storeVerifiedOrder = async (payload) => post('/api/store-order', payload)

export const validateOnlineStock = async (items) => {
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ({
        productId: String(item?.productId || '').trim(),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A',
      })).filter((item) => item.productId)
    : []
  if (!normalizedItems.length) throw new Error('Product details are required')
  return post('/api/online/check-stock', { items: normalizedItems })
}

export const releaseOnlineReservations = async (reservationToken, reservationKeys) => {
  if (!reservationToken || !Array.isArray(reservationKeys) || reservationKeys.length === 0) return { success: true }
  return post('/api/online/release-reservations', { reservationToken, reservationKeys })
}

export const confirmOnlineReservation = async (orderId) => {
  if (!orderId) throw new Error('orderId is required')
  return post('/api/online/confirm-reservation', { orderId })
}

export const initiatePayment = async ({
  productId,
  quantity = 1,
  items = [],
  userId = 'guest',
  customerDetails = {},
  productName,
  customerName,
  customerPhone,
  customerEmail = '',
  productImage = '/logo.png',
  discountPercent = 0,
  onSuccess,
  onFailure,
}) => {
  const reservationToken = createReservationToken()
  let reservationKeys = []
  let paymentModalOpened = false

  const releaseCurrentReservations = async () => {
    if (!reservationKeys.length) return
    try {
      await releaseOnlineReservations(reservationToken, reservationKeys)
    } catch (releaseError) {
      console.error('Checkout reservation release failed:', releaseError)
    }
  }

  try {
    if (!customerName || !customerPhone) throw new Error('Customer name and phone are required')

    const normalizedItems = Array.isArray(items)
      ? items.map((item) => ({ productId: String(item?.productId || '').trim(), quantity: Math.max(1, Number(item?.quantity || 1)), selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A' })).filter((item) => item.productId)
      : []

    const finalItems = normalizedItems.length > 0
      ? normalizedItems
      : productId
        ? [{ productId: String(productId).trim(), quantity: Math.max(1, Number(quantity || 1)), selectedSize: 'N/A' }]
        : []

    if (!finalItems.length) throw new Error('Product details are required to create payment order')
    await validateOnlineStock(finalItems)

    const orderData = await post('/api/online/create-payment-order', {
      items: finalItems,
      userId,
      customerDetails,
      currency: 'INR',
      discountPercent: Number(discountPercent || 0),
      reservationToken,
    })
    reservationKeys = Array.isArray(orderData.reservationKeys) ? orderData.reservationKeys : []

    if (!window.Razorpay) throw new Error('Razorpay script not loaded. Please refresh the page.')

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: clientConfig.brandName,
      description: productName,
      image: productImage,
      order_id: orderData.orderId,
      prefill: { name: customerName, contact: customerPhone, email: customerEmail },
      notes: { productName, discountPercent: String(orderData.discountPercent || 0) },
      theme: { color: '#000000' },
      handler: async (response) => {
        try {
          await verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
          await confirmOnlineReservation(response.razorpay_order_id)
          const completed = await post('/api/online/complete-order', { orderId: response.razorpay_order_id, orderStatus: 'processing' })
          onSuccess?.({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            amount: Number(orderData.totalAmount || 0),
            baseSubtotal: Number(orderData.baseSubtotal || orderData.subtotal || 0),
            subtotal: Number(orderData.subtotal || 0),
            discountPercent: Number(orderData.discountPercent || 0),
            productDiscountAmount: Number(orderData.productDiscountAmount || 0),
            orderDiscountAmount: Number(orderData.orderDiscountAmount || 0),
            discountAmount: Number(orderData.discountAmount || 0),
            products: Array.isArray(orderData.products) ? orderData.products : [],
            orderDocumentId: completed.orderDocumentId || '',
          })
        } catch (error) {
          console.error('Online payment completion failed:', error)
          onFailure?.(error)
        }
      },
      modal: {
        ondismiss: async () => {
          await releaseCurrentReservations()
          onFailure?.(new Error('Payment modal closed'))
        },
      },
    }

    paymentModalOpened = true
    new window.Razorpay(options).open()
  } catch (error) {
    if (!paymentModalOpened) await releaseCurrentReservations()
    console.error('Online payment initiation failed:', error)
    onFailure?.(error)
  }
}

export const storeOrderData = async (orderData) => post('/api/store-order', orderData)

export default { createOrder, verifyPayment, storeVerifiedOrder, validateOnlineStock, initiatePayment, releaseOnlineReservations, confirmOnlineReservation, storeOrderData }
