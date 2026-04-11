import { auth } from '../firebase'

const API_URL = String(import.meta.env.VITE_API_URL || '').trim()

function getApiUrl() {
  if (!API_URL) {
    throw new Error('Missing VITE_API_URL environment variable')
  }

  return API_URL
}

async function getAuthHeaders(requireAuth = false) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (!requireAuth) {
    return headers
  }

  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new Error('Authentication required')
  }

  const token = await currentUser.getIdToken()
  headers.Authorization = `Bearer ${token}`
  return headers
}

function normalizeDate(value) {
  if (!value) {
    return new Date()
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate()
  }

  const asDate = new Date(value)
  return Number.isNaN(asDate.getTime()) ? new Date() : asDate
}

function normalizeOrder(order) {
  const products = Array.isArray(order?.products) ? order.products : []
  const firstProduct = products[0] || {}
  const customerDetails = order?.customerDetails && typeof order.customerDetails === 'object'
    ? order.customerDetails
    : {}

  return {
    ...order,
    products,
    status: String(order?.orderStatus || order?.status || 'pending').trim() || 'pending',
    orderStatus: String(order?.orderStatus || order?.status || 'pending').trim() || 'pending',
    customerName: String(order?.customerName || customerDetails?.name || '').trim(),
    customerPhone: String(order?.customerPhone || customerDetails?.phone || '').trim(),
    customerAddress: String(order?.customerAddress || customerDetails?.address || '').trim(),
    productName: String(order?.productName || firstProduct?.name || '').trim(),
    productPrice: Number(order?.productPrice || order?.totalAmount || 0),
    selectedSize: String(order?.selectedSize || firstProduct?.selectedSize || 'N/A').trim() || 'N/A',
    paymentStatus: String(order?.paymentStatus || '').trim(),
    createdAt: normalizeDate(order?.createdAt),
    updatedAt: normalizeDate(order?.updatedAt),
  }
}

/**
 * Create a new order
 * @param {Object} orderData - Order data
 * @param {string} orderData.customerName - Customer name
 * @param {string} orderData.customerPhone - Customer phone
 * @param {string} orderData.customerAddress - Customer address
 * @param {string} orderData.productName - Product name
 * @param {number} orderData.productPrice - Product price in INR
 * @param {string} orderData.productId - Product ID from Firestore
 * @param {string} orderData.selectedSize - Selected size
 * @param {string} orderData.productImage - Product image URL
 * @param {string} orderData.paymentMethod - "razorpay" or "whatsapp"
 * @param {string} orderData.paymentStatus - "paid" or "pending"
 * @param {string} orderData.razorpay_payment_id - Payment ID (if Razorpay)
 * @param {string} orderData.notes - Customer notes
 * @returns {Promise<{id: string, ...orderData}>}
 */
export const createOrder = async (orderData) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/orders`, {
      method: 'POST',
      headers: await getAuthHeaders(false),
      body: JSON.stringify(orderData),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create order')
    }

    return data
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
  }
}

/**
 * Get all orders
 * @returns {Promise<Array>}
 */
export const getOrders = async () => {
  try {
    const response = await fetch(`${getApiUrl()}/api/admin/orders`, {
      method: 'GET',
      headers: await getAuthHeaders(true),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch orders')
    }

    return (Array.isArray(data.orders) ? data.orders : []).map((order) => normalizeOrder(order))
  } catch (error) {
    console.error('Error fetching orders:', error)
    throw error
  }
}

/**
 * Get orders by payment status
 * @param {string} paymentStatus - "paid" or "pending"
 * @returns {Promise<Array>}
 */
export const getOrdersByPaymentStatus = async (paymentStatus) => {
  const orders = await getOrders()
  return orders.filter((order) => String(order.paymentStatus || '') === String(paymentStatus || ''))
}

/**
 * Get orders by order status
 * @param {string} orderStatus - "pending", "processing", "completed", "cancelled"
 * @returns {Promise<Array>}
 */
export const getOrdersByOrderStatus = async (orderStatus) => {
  const orders = await getOrders()
  return orders.filter((order) => String(order.status || '') === String(orderStatus || ''))
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status: "pending", "processing", "completed", "cancelled"
 * @returns {Promise<void>}
 */
export const updateOrderStatus = async (orderId, status) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/admin/order/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      headers: await getAuthHeaders(true),
      body: JSON.stringify({
        orderStatus: status,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update order status')
    }
  } catch (error) {
    console.error('Error updating order status:', error)
    throw error
  }
}

/**
 * Update payment status
 * @param {string} orderId - Order ID
 * @param {string} paymentStatus - "paid" or "pending"
 * @returns {Promise<void>}
 */
export const updatePaymentStatus = async (orderId, paymentStatus) => {
  const orders = await getOrders()
  const targetOrder = orders.find((order) => order.id === orderId)

  if (!targetOrder) {
    throw new Error('Order not found')
  }

  if (String(targetOrder.paymentStatus || '') !== String(paymentStatus || '')) {
    throw new Error('Payment status can only be changed by payment verification endpoints')
  }
}

/**
 * Get a single order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>}
 */
export const getOrderById = async (orderId) => {
  const orders = await getOrders()
  const target = orders.find((order) => order.id === orderId)

  if (!target) {
    throw new Error('Order not found')
  }

  return target
}

/**
 * Delete an order
 * @param {string} orderId - Order ID
 * @returns {Promise<void>}
 */
export const deleteOrder = async (orderId) => {
  try {
    const response = await fetch(`${getApiUrl()}/api/admin/order/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(true),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to delete order')
    }
  } catch (error) {
    console.error('Error deleting order:', error)
    throw error
  }
}

/**
 * Listen to real-time order updates
 * @param {Function} callback - Callback function that receives orders array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToOrders = (callback) => {
  let cancelled = false

  const executeFetch = async () => {
    try {
      const orders = await getOrders()
      if (!cancelled) {
        callback(orders)
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Error subscribing to orders:', error)
      }
    }
  }

  void executeFetch()
  const timer = window.setInterval(executeFetch, 15000)

  return () => {
    cancelled = true
    window.clearInterval(timer)
  }
}

/**
 * Listen to orders by filter
 * @param {Object} filters - Filter criteria
 * @param {Function} callback - Callback function
 * @param {Function} errorCallback - Error callback function
 * @returns {Function} Unsubscribe function
 */
export const subscribeToOrdersByFilter = (filters, callback, errorCallback) => {
  const unsubscribe = subscribeToOrders((orders) => {
    const filteredOrders = orders.filter((order) => {
      const paymentMatch = !filters?.paymentStatus || String(order.paymentStatus || '') === String(filters.paymentStatus)
      const statusMatch = !filters?.orderStatus || String(order.status || '') === String(filters.orderStatus)
      return paymentMatch && statusMatch
    })

    callback(filteredOrders)
  })

  return () => {
    try {
      unsubscribe()
    } catch (error) {
      if (errorCallback) {
        errorCallback(error)
      }
    }
  }
}

export default {
  createOrder,
  getOrders,
  getOrdersByPaymentStatus,
  getOrdersByOrderStatus,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderById,
  deleteOrder,
  subscribeToOrders,
  subscribeToOrdersByFilter,
}
