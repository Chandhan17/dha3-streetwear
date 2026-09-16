import clientConfig from '../config'

const API_URL = String(import.meta.env.VITE_API_URL || '').trim()
const apiUrl = () => { if (!API_URL) throw new Error('Missing VITE_API_URL environment variable'); return API_URL }

async function post(path, body) {
  const endpoint = `${apiUrl()}${path}`
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) throw new Error(data.error || `Request failed: ${response.statusText}`)
    return data
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`Network request failed for ${endpoint}. Check API URL, TLS certificate, CORS, and backend availability.`)
    throw error
  }
}

export async function initiateInventoryAwarePayment({ items = [], userId = 'guest', customerDetails = {}, productName, customerName, customerPhone, customerEmail = '', productImage = '/logo.png', onSuccess, onFailure }) {
  try {
    if (!customerName || !customerPhone) throw new Error('Customer name and phone are required')
    const normalizedItems = items.map((item) => ({ productId: String(item?.productId || '').trim(), quantity: Math.max(1, Number(item?.quantity || 1)), selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A' })).filter((item) => item.productId)
    if (!normalizedItems.length) throw new Error('Product details are required to create payment order')

    const orderData = await post('/api/create-order', { items: normalizedItems, userId, customerDetails, currency: 'INR' })
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
      notes: { productName },
      theme: { color: '#000000' },
      handler: async (response) => {
        try {
          await post('/api/verify-payment', { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature })
          const completed = await post('/api/online/complete-order', { orderId: response.razorpay_order_id, orderStatus: 'processing' })
          onSuccess?.({ paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, amount: Number(orderData.totalAmount || 0), orderDocumentId: completed.orderDocumentId || '' })
        } catch (error) { console.error('Online payment completion failed:', error); onFailure?.(error) }
      },
      modal: { ondismiss: () => onFailure?.(new Error('Payment modal closed')) },
    }
    new window.Razorpay(options).open()
  } catch (error) { console.error('Online payment initiation failed:', error); onFailure?.(error) }
}
