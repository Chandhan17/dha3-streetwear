import { useEffect, useState } from 'react'
import {
  deleteOrder,
  getOrders,
  subscribeToOrdersByFilter,
  updateOrderStatus,
} from '../services/orderService'

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'processing', label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
]

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-orange-100 text-orange-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
]

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function Orders() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')
  const [filterOrderStatus, setFilterOrderStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [bulkStatus, setBulkStatus] = useState('')
  const [isUpdating, setIsUpdating] = useState('')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState('')
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [error, setError] = useState('')

  // Load orders
  useEffect(() => {
    setIsLoading(true)
    setError('')

    try {
      let unsubscribe
      let loadingTimeout

      // Timeout fallback - ensure loading state clears after 10 seconds
      loadingTimeout = setTimeout(() => {
        setIsLoading(false)
      }, 10000)

      if (filterPaymentStatus || filterOrderStatus) {
        unsubscribe = subscribeToOrdersByFilter(
          {
            paymentStatus: filterPaymentStatus || undefined,
            orderStatus: filterOrderStatus || undefined,
          },
          (data) => {
            clearTimeout(loadingTimeout)
            setOrders(data)
            setIsLoading(false)
          },
          (error) => {
            clearTimeout(loadingTimeout)
            console.error('Error loading filtered orders:', error)
            setError('Failed to load orders: ' + error.message)
            setIsLoading(false)
          },
        )
      } else {
        getOrders()
          .then((data) => {
            clearTimeout(loadingTimeout)
            setOrders(data)
            setIsLoading(false)
          })
          .catch((err) => {
            clearTimeout(loadingTimeout)
            console.error('Error loading orders:', err)
            setError('Failed to load orders: ' + err.message)
            setIsLoading(false)
          })
      }

      return () => {
        clearTimeout(loadingTimeout)
        if (unsubscribe) {
          unsubscribe()
        }
      }
    } catch (err) {
      console.error('Error setting up orders:', err)
      setError('Failed to load orders: ' + err.message)
      setIsLoading(false)
    }
  }, [filterPaymentStatus, filterOrderStatus])

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerPhone?.includes(searchTerm) ||
      order.productName?.toLowerCase().includes(searchLower)
    )
  })

  const filteredOrderIds = filteredOrders.map((order) => order.id)
  const allVisibleSelected =
    filteredOrderIds.length > 0 && filteredOrderIds.every((id) => selectedOrderIds.includes(id))

  useEffect(() => {
    setSelectedOrderIds((prevIds) => prevIds.filter((id) => filteredOrderIds.includes(id)))
  }, [filteredOrderIds])

  const handleSelectOrder = (orderId) => {
    setSelectedOrderIds((prevIds) =>
      prevIds.includes(orderId)
        ? prevIds.filter((id) => id !== orderId)
        : [...prevIds, orderId],
    )
  }

  const handleSelectAllVisible = (isChecked) => {
    if (isChecked) {
      setSelectedOrderIds(filteredOrderIds)
      return
    }
    setSelectedOrderIds([])
  }

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedOrderIds.length === 0) {
      return
    }

    setIsBulkUpdating(true)
    setError('')

    try {
      await Promise.all(selectedOrderIds.map((orderId) => updateOrderStatus(orderId, bulkStatus)))

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          selectedOrderIds.includes(order.id) ? { ...order, status: bulkStatus } : order,
        ),
      )

      setSelectedOrderIds([])
      setBulkStatus('')
    } catch (err) {
      console.error('Error updating selected orders:', err)
      setError('Failed to update selected orders')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) {
      return
    }

    if (!window.confirm(`Delete ${selectedOrderIds.length} selected order(s)?`)) {
      return
    }

    setIsBulkDeleting(true)
    setError('')

    try {
      await Promise.all(selectedOrderIds.map((orderId) => deleteOrder(orderId)))
      setOrders((prevOrders) => prevOrders.filter((order) => !selectedOrderIds.includes(order.id)))
      setSelectedOrderIds([])
      if (selectedOrderId && selectedOrderIds.includes(selectedOrderId)) {
        setSelectedOrderId(null)
      }
    } catch (err) {
      console.error('Error deleting selected orders:', err)
      setError('Failed to delete selected orders')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleStatusChange = async (orderId, newStatus) => {
    setIsUpdating(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order,
        ),
      )
    } catch (err) {
      console.error('Error updating order status:', err)
      setError('Failed to update order status')
    } finally {
      setIsUpdating('')
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) {
      return
    }

    setIsDeletingId(orderId)
    try {
      await deleteOrder(orderId)
      setOrders((prevOrders) => prevOrders.filter((order) => order.id !== orderId))
    } catch (err) {
      console.error('Error deleting order:', err)
      setError('Failed to delete order')
    } finally {
      setIsDeletingId('')
    }
  }

  const getStatusColor = (statusValue, type = 'order') => {
    const statuses = type === 'payment' ? PAYMENT_STATUSES : ORDER_STATUSES
    return statuses.find((s) => s.value === statusValue)?.color || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (statusValue, type = 'order') => {
    const statuses = type === 'payment' ? PAYMENT_STATUSES : ORDER_STATUSES
    return statuses.find((s) => s.value === statusValue)?.label || statusValue
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-obsidian"></div>
          <p className="text-sm text-black/70">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-black/10 bg-white p-6">
        <h3 className="mb-4 font-semibold text-obsidian">Filters</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-obsidian">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, phone, or product..."
              className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-obsidian"
            />
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-sm font-medium text-obsidian">Payment Status</label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-obsidian"
            >
              <option value="">All Payment Statuses</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status Filter */}
          <div>
            <label className="block text-sm font-medium text-obsidian">Order Status</label>
            <select
              value={filterOrderStatus}
              onChange={(e) => setFilterOrderStatus(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-obsidian"
            >
              <option value="">All Order Statuses</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Orders Count */}
      <div className="text-sm text-black/70">
        Showing <span className="font-semibold">{filteredOrders.length}</span> of{' '}
        <span className="font-semibold">{orders.length}</span> orders
      </div>

      {/* Bulk Actions */}
      {filteredOrders.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-black/70">
              Selected: <span className="font-semibold">{selectedOrderIds.length}</span>
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                disabled={selectedOrderIds.length === 0 || isBulkUpdating || isBulkDeleting}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-obsidian disabled:opacity-50"
              >
                <option value="">Update selected status...</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || selectedOrderIds.length === 0 || isBulkUpdating || isBulkDeleting}
                className="rounded-lg bg-obsidian px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isBulkUpdating ? 'Updating...' : 'Apply'}
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={selectedOrderIds.length === 0 || isBulkUpdating || isBulkDeleting}
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>

              <button
                onClick={() => setSelectedOrderIds([])}
                disabled={selectedOrderIds.length === 0 || isBulkUpdating || isBulkDeleting}
                className="rounded-lg bg-black/5 px-3 py-2 text-sm font-medium text-obsidian transition hover:bg-black/10 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-black/70">No orders found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
          <table className="w-full">
            <thead className="border-b border-black/10 bg-black/2">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                    aria-label="Select all visible orders"
                    className="h-4 w-4 rounded border-black/20"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Customer / Product
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Price / Size
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Order Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-obsidian">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-black/5 hover:bg-black/1 transition"
                >
                  <td className="px-6 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                      aria-label={`Select order ${order.id}`}
                      className="mt-1 h-4 w-4 rounded border-black/20"
                    />
                  </td>

                  {/* Customer / Product */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-obsidian">{order.customerName}</p>
                      <p className="text-xs text-black/60">{order.productName}</p>
                      <p className="text-xs text-black/50">{order.customerPhone}</p>
                    </div>
                  </td>

                  {/* Price / Size */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-obsidian">
                        ₹{new Intl.NumberFormat('en-IN').format(order.productPrice || 0)}
                      </p>
                      <p className="text-xs text-black/60">Size: {order.selectedSize || 'N/A'}</p>
                    </div>
                  </td>

                  {/* Payment Status */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(
                          order.paymentStatus,
                          'payment',
                        )}`}
                      >
                        {getStatusLabel(order.paymentStatus, 'payment')}
                      </span>
                      <p className="text-xs text-black/60">{order.paymentMethod}</p>
                      {order.razorpay_payment_id && (
                        <p className="text-xs text-black/50">ID: {order.razorpay_payment_id.substring(0, 8)}...</p>
                      )}
                    </div>
                  </td>

                  {/* Order Status */}
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      disabled={isUpdating === order.id}
                      className={`rounded-lg border border-black/15 px-2.5 py-1 text-sm font-medium outline-none transition ${getStatusColor(
                        order.status,
                      )} ${isUpdating === order.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-sm text-black/70">
                    {formatDateTime(order.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setSelectedOrderId(selectedOrderId === order.id ? null : order.id)
                        }
                        className="rounded-lg bg-black/5 px-3 py-1.5 text-xs font-medium text-obsidian transition hover:bg-black/10"
                      >
                        {selectedOrderId === order.id ? 'Hide' : 'View'}
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={isDeletingId === order.id}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {isDeletingId === order.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrderId && (
        <div className="rounded-xl border border-black/10 bg-white p-6">
          {(() => {
            const order = filteredOrders.find((o) => o.id === selectedOrderId)
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/10 pb-4">
                  <h3 className="font-semibold text-obsidian">Order Details</h3>
                  <button
                    onClick={() => setSelectedOrderId(null)}
                    className="text-sm text-black/60 hover:text-obsidian"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Order ID</p>
                    <p className="mt-1 font-mono text-sm text-obsidian">{order.id}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Created</p>
                    <p className="mt-1 text-sm text-obsidian">{formatDateTime(order.createdAt)}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Customer Name</p>
                    <p className="mt-1 text-sm text-obsidian">{order.customerName || '-'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Phone</p>
                    <p className="mt-1 text-sm text-obsidian">{order.customerPhone || '-'}</p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-black/60 uppercase">Address</p>
                    <p className="mt-1 text-sm text-obsidian">
                      {order.customerAddress || order.customerDetails?.address || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Product</p>
                    <p className="mt-1 text-sm text-obsidian">{order.productName}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Size</p>
                    <p className="mt-1 text-sm text-obsidian">{order.selectedSize}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Price</p>
                    <p className="mt-1 text-sm font-medium text-obsidian">
                      ₹{new Intl.NumberFormat('en-IN').format(order.productPrice || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-black/60 uppercase">Payment Method</p>
                    <p className="mt-1 text-sm text-obsidian capitalize">{order.paymentMethod}</p>
                  </div>

                  {order.razorpay_payment_id && (
                    <div>
                      <p className="text-xs font-semibold text-black/60 uppercase">
                        Payment ID
                      </p>
                      <p className="mt-1 font-mono text-xs text-obsidian">
                        {order.razorpay_payment_id}
                      </p>
                    </div>
                  )}

                  {order.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-black/60 uppercase">Notes</p>
                      <p className="mt-1 text-sm text-obsidian">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default Orders
