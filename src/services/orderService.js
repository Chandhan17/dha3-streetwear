/**
 * Order Service for Firestore Integration
 * Handles order creation, retrieval, and status updates
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'

const ORDERS_COLLECTION = 'orders'

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
    const ordersCollection = collection(db, ORDERS_COLLECTION)

    const docData = {
      ...orderData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending', // Order status: pending, processing, completed, cancelled
    }

    const docRef = await addDoc(ordersCollection, docData)

    return {
      id: docRef.id,
      ...docData,
    }
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
    const ordersCollection = collection(db, ORDERS_COLLECTION)
    const q = query(ordersCollection, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
    }))
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
  try {
    const ordersCollection = collection(db, ORDERS_COLLECTION)
    const q = query(
      ordersCollection,
      where('paymentStatus', '==', paymentStatus),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
    }))
  } catch (error) {
    console.error('Error fetching orders by payment status:', error)
    throw error
  }
}

/**
 * Get orders by order status
 * @param {string} orderStatus - "pending", "processing", "completed", "cancelled"
 * @returns {Promise<Array>}
 */
export const getOrdersByOrderStatus = async (orderStatus) => {
  try {
    const ordersCollection = collection(db, ORDERS_COLLECTION)
    const q = query(
      ordersCollection,
      where('status', '==', orderStatus),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
    }))
  } catch (error) {
    console.error('Error fetching orders by order status:', error)
    throw error
  }
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status: "pending", "processing", "completed", "cancelled"
 * @returns {Promise<void>}
 */
export const updateOrderStatus = async (orderId, status) => {
  try {
    const orderDoc = doc(db, ORDERS_COLLECTION, orderId)
    await updateDoc(orderDoc, {
      status,
      updatedAt: serverTimestamp(),
    })
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
  try {
    const orderDoc = doc(db, ORDERS_COLLECTION, orderId)
    await updateDoc(orderDoc, {
      paymentStatus,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating payment status:', error)
    throw error
  }
}

/**
 * Get a single order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>}
 */
export const getOrderById = async (orderId) => {
  try {
    const snapshot = await getDocs(query(collection(db, ORDERS_COLLECTION), where('__name__', '==', orderId)))

    if (snapshot.empty) {
      throw new Error('Order not found')
    }

    const docSnapshot = snapshot.docs[0]
    return {
      id: docSnapshot.id,
      ...docSnapshot.data(),
      createdAt: docSnapshot.data().createdAt?.toDate?.() || new Date(),
      updatedAt: docSnapshot.data().updatedAt?.toDate?.() || new Date(),
    }
  } catch (error) {
    console.error('Error fetching order:', error)
    throw error
  }
}

/**
 * Delete an order
 * @param {string} orderId - Order ID
 * @returns {Promise<void>}
 */
export const deleteOrder = async (orderId) => {
  try {
    const orderDoc = doc(db, ORDERS_COLLECTION, orderId)
    await deleteDoc(orderDoc)
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
  try {
    const ordersCollection = collection(db, ORDERS_COLLECTION)
    const q = query(ordersCollection, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      }))
      callback(orders)
    })

    return unsubscribe
  } catch (error) {
    console.error('Error subscribing to orders:', error)
    throw error
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
  try {
    const ordersCollection = collection(db, ORDERS_COLLECTION)

    // Use a single indexed stream and filter client-side to avoid composite index requirements.
    const q = query(ordersCollection, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allOrders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
        }))

        const filteredOrders = allOrders.filter((order) => {
          const paymentMatch =
            !filters?.paymentStatus || order.paymentStatus === filters.paymentStatus
          const statusMatch = !filters?.orderStatus || order.status === filters.orderStatus
          return paymentMatch && statusMatch
        })

        callback(filteredOrders)
      },
      (error) => {
        console.error('Error subscribing to filtered orders:', error)
        if (errorCallback) {
          errorCallback(error)
        }
      },
    )

    return unsubscribe
  } catch (error) {
    console.error('Error setting up filtered orders subscription:', error)
    if (errorCallback) {
      errorCallback(error)
    }
    throw error
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
