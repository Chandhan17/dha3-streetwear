/**
 * Payment Service for Razorpay Integration
 * Handles order creation, payment processing, and verification
 */

import clientConfig from '../config'

const API_URL = String(import.meta.env.VITE_API_URL || '').trim()

function getApiUrl() {
  if (!API_URL) {
    throw new Error('Missing VITE_API_URL environment variable')
  }

  return API_URL
}

/**
 * Create a Razorpay order from the backend using server-side product pricing.
 * @param {Object} payload - Order creation payload
 * @returns {Promise<{orderId: string, amount: number, currency: string}>}
 */
export const createOrder = async (payload) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to create order')
    }

    return data
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
  }
}

/**
 * Verify payment with Razorpay signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay payment signature
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyPayment = async (orderId, paymentId, signature) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to verify payment: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Payment verification failed')
    }

    return data
  } catch (error) {
    console.error('Error verifying payment:', error)
    throw error
  }
}

/**
 * Store verified order details in backend datastore.
 * @param {Object} payload - Store order payload
 * @returns {Promise<{success: boolean, orderDocumentId?: string}>}
 */
export const storeVerifiedOrder = async (payload) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/store-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to store order: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to store order')
    }

    return data
  } catch (error) {
    console.error('Error storing verified order:', error)
    throw error
  }
}

/**
 * Open Razorpay checkout and handle payment
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in INR
 * @param {string} options.productName - Product name
 * @param {string} options.customerName - Customer name
 * @param {string} options.customerPhone - Customer phone
 * @param {string} options.customerEmail - Customer email (optional)
 * @param {string} options.productImage - Product image URL
 * @param {Object} options.onSuccess - Success callback handler
 * @param {Object} options.onFailure - Failure callback handler
 * @returns {Promise<void>}
 */
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
  onSuccess,
  onFailure,
}) => {
  try {
    if (!customerName || !customerPhone) {
      throw new Error('Customer name and phone are required')
    }

    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({
            productId: String(item?.productId || '').trim(),
            quantity: Math.max(1, Number(item?.quantity || 1)),
            selectedSize: String(item?.selectedSize || 'N/A').trim() || 'N/A',
          }))
          .filter((item) => Boolean(item.productId))
      : []

    if (!productId && normalizedItems.length === 0) {
      throw new Error('Product details are required to create payment order')
    }

    // Step 1: Create order on backend using server-priced products.
    const orderData = await createOrder({
      productId,
      quantity,
      items: normalizedItems,
      userId,
      customerDetails,
      currency: 'INR',
    })
    const { orderId, amount: orderAmount, totalAmount } = orderData

    // Step 2: Check if Razorpay is loaded
    if (!window.Razorpay) {
      throw new Error('Razorpay script not loaded. Please refresh the page.')
    }

    // Step 3: Configure Razorpay options
    const razorpayOptions = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: orderAmount, // Amount already in paise from backend
      currency: 'INR',
      name: clientConfig.brandName,
      description: productName,
      image: productImage,
      order_id: orderId,

      handler: async (response) => {
        try {
          // Step 4: Verify payment on backend
          const verificationResult = await verifyPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature,
          )

          if (verificationResult.success) {
            const storeOrderResult = await storeVerifiedOrder({
              orderId: response.razorpay_order_id,
              orderStatus: 'processing',
            })

            // Payment verified successfully
            if (typeof onSuccess === 'function') {
              onSuccess({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount: Number(totalAmount || 0),
                orderDocumentId: storeOrderResult.orderDocumentId || '',
              })
            }
          }
        } catch (error) {
          console.error('Payment verification failed:', error)
          if (typeof onFailure === 'function') {
            onFailure(error)
          }
        }
      },

      prefill: {
        name: customerName,
        contact: customerPhone,
        email: customerEmail,
      },

      notes: {
        productName,
      },

      theme: {
        color: '#000000',
      },

      modal: {
        ondismiss: () => {
          if (typeof onFailure === 'function') {
            onFailure(new Error('Payment modal closed'))
          }
        },
      },
    }

    // Step 5: Open Razorpay checkout
    const razorpayInstance = new window.Razorpay(razorpayOptions)
    razorpayInstance.open()
  } catch (error) {
    console.error('Payment initiation error:', error)
    if (typeof onFailure === 'function') {
      onFailure(error)
    }
  }
}

/**
 * Store order details after successful payment
 * @param {Object} orderData - Order data to store
 * @returns {Promise<{success: boolean}>}
 */
export const storeOrderData = async (orderData) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/store-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      throw new Error(`Failed to store order: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error storing order:', error)
    throw error
  }
}

export default {
  createOrder,
  verifyPayment,
  storeVerifiedOrder,
  initiatePayment,
  storeOrderData,
}
