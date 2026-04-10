import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import clientConfig from '../config'
import AdminLayout from '../components/AdminLayout'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import Input from '../components/Input'
import Loader from '../components/Loader'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'
import Table from '../components/Table'
import {
  deleteUserProfile,
  getCurrentAdmin,
  logoutAdmin,
  updateAdminPasswordSecure,
  updateAdminProfile,
} from '../services/authService'
import { deleteOrder, getOrders, updateOrderStatus } from '../services/orderService'
import { uploadImage } from '../services/uploadService'
import { createProduct, editProduct, fetchProducts, removeProduct } from '../services/productService'

const fallbackCategories = ['Shirts', 'T-Shirts', 'Jeans', 'Shoes', 'Accessories']
const adminCategories =
  Array.isArray(clientConfig.productCategories) && clientConfig.productCategories.length
    ? clientConfig.productCategories
    : fallbackCategories

const pageSize = 8

const getInitialFormState = () => ({
  name: '',
  price: '',
  category: adminCategories[0],
  sizesInput: '',
  description: '',
  sizeChartText: '',
  sizeChartImage: '',
  sizeChartImageFile: null,
})

function parseSizesInput(sizesInput) {
  return [...new Set(
    String(sizesInput || '')
      .split(',')
      .map((size) => size.trim())
      .filter((size) => Boolean(size)),
  )]
}

function getProductImages(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
  }

  const fallbackImage = product.imageUrl || product.image || ''
  return fallbackImage ? [fallbackImage] : []
}

function getFileSignature(file) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function mergeImageFiles(currentFiles, incomingFiles) {
  const nextFiles = [...currentFiles]
  const existingSignatures = new Set(currentFiles.map(getFileSignature))

  incomingFiles.forEach((file) => {
    const signature = getFileSignature(file)

    if (!existingSignatures.has(signature)) {
      existingSignatures.add(signature)
      nextFiles.push(file)
    }
  })

  return nextFiles
}

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(Number(value || 0))}`
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN')
}

function getOrderStatusTone(status) {
  if (status === 'completed' || status === 'delivered') {
    return 'success'
  }

  if (status === 'processing' || status === 'shipped') {
    return 'info'
  }

  if (status === 'cancelled') {
    return 'danger'
  }

  return 'warning'
}

function Admin() {
  const navigate = useNavigate()

  const [activeSection, setActiveSection] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState({ type: '', message: '' })

  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [viewMode, setViewMode] = useState('grid')
  const [productCategoryFilter, setProductCategoryFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [activeCardImageIndex, setActiveCardImageIndex] = useState({})

  const [showProductModal, setShowProductModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)

  const [images, setImages] = useState([])
  const [retainedExistingImages, setRetainedExistingImages] = useState([])
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [formValues, setFormValues] = useState(getInitialFormState())

  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderSort, setOrderSort] = useState('newest')
  const [deletingOrderId, setDeletingOrderId] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [bulkOrderStatus, setBulkOrderStatus] = useState('')
  const [isBulkUpdatingOrders, setIsBulkUpdatingOrders] = useState(false)
  const [isBulkDeletingOrders, setIsBulkDeletingOrders] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState('')

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    currentPassword: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const selectedImagePreviews = useMemo(
    () => images.map((file) => URL.createObjectURL(file)),
    [images],
  )

  useEffect(
    () => () => {
      selectedImagePreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl))
    },
    [selectedImagePreviews],
  )

  const pushToast = (type, message) => {
    setToast({ type, message })
  }

  useEffect(() => {
    if (!toast.message) {
      return
    }

    const timer = window.setTimeout(() => {
      setToast({ type: '', message: '' })
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [toast])

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true)

    try {
      const productList = await fetchProducts({ forceRefresh: true })
      setProducts(productList)
    } catch (error) {
      pushToast('error', error.message || 'Unable to fetch products.')
    } finally {
      setIsLoadingProducts(false)
    }
  }, [])

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true)

    try {
      const orderList = await getOrders()
      setOrders(orderList)
    } catch (error) {
      pushToast('error', error.message || 'Unable to fetch orders.')
    } finally {
      setIsLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
    loadOrders()
  }, [loadOrders, loadProducts])

  useEffect(() => {
    const adminUser = getCurrentAdmin()

    setProfileForm((current) => ({
      ...current,
      displayName: adminUser?.displayName || 'Admin',
      email: adminUser?.email || '',
    }))
  }, [])

  const resetForm = () => {
    setFormValues(getInitialFormState())
    setImages([])
    setRetainedExistingImages([])
    setEditingProduct(null)
    setFileInputKey(Date.now())
  }

  const validateForm = () => {
    if (!formValues.name.trim() || !formValues.price) {
      pushToast('error', 'Product name and price are required.')
      return false
    }

    if (!editingProduct && images.length === 0) {
      pushToast('error', 'Please upload at least one product image.')
      return false
    }

    if (editingProduct && images.length === 0 && retainedExistingImages.length === 0) {
      pushToast('error', 'Please keep at least one image before saving.')
      return false
    }

    return true
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }))
  }

  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || [])

    if (selectedFiles.length === 0) {
      return
    }

    setImages((currentFiles) => mergeImageFiles(currentFiles, selectedFiles))
    event.target.value = ''
  }

  const handleSizeChartImageChange = (event) => {
    const file = event.target.files?.[0] || null

    setFormValues((previousValues) => ({
      ...previousValues,
      sizeChartImageFile: file,
    }))
  }

  const handleRemoveSelectedImage = (fileToRemove) => {
    const signatureToRemove = getFileSignature(fileToRemove)

    setImages((currentFiles) =>
      currentFiles.filter((file) => getFileSignature(file) !== signatureToRemove),
    )
  }

  const handleRemoveExistingImage = (indexToRemove) => {
    setRetainedExistingImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove),
    )
  }

  const handleOpenCreate = () => {
    resetForm()
    setShowProductModal(true)
  }

  const handleOpenEdit = (product) => {
    setEditingProduct(product)
    setFormValues({
      name: product.name,
      price: String(product.price),
      category: product.category || adminCategories[0],
      sizesInput: Array.isArray(product.sizes) ? product.sizes.join(',') : '',
      description: product.description || '',
      sizeChartText: product.sizeChartText || '',
      sizeChartImage: product.sizeChartImage || '',
      sizeChartImageFile: null,
    })
    setRetainedExistingImages(getProductImages(product))
    setImages([])
    setShowProductModal(true)
    setFileInputKey(Date.now())
  }

  const handleSubmitProduct = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setIsUploadingImages(images.length > 0 || Boolean(formValues.sizeChartImageFile))

    try {
      if (editingProduct) {
        const sizeChartImageUrl = formValues.sizeChartImageFile
          ? await uploadImage(formValues.sizeChartImageFile)
          : formValues.sizeChartImage

        await editProduct(editingProduct.id, {
          name: formValues.name,
          price: formValues.price,
          category: formValues.category,
          sizes: parseSizesInput(formValues.sizesInput),
          description: formValues.description,
          sizeChartText: formValues.sizeChartText,
          sizeChartImage: sizeChartImageUrl,
          imageFiles: images,
          currentImages: retainedExistingImages,
          currentImageUrl: editingProduct.imageUrl || editingProduct.image,
        })

        pushToast('success', 'Product updated successfully.')
      } else {
        const sizeChartImageUrl = formValues.sizeChartImageFile
          ? await uploadImage(formValues.sizeChartImageFile)
          : formValues.sizeChartImage

        await createProduct({
          name: formValues.name,
          price: formValues.price,
          category: formValues.category,
          sizes: parseSizesInput(formValues.sizesInput),
          description: formValues.description,
          sizeChartText: formValues.sizeChartText,
          sizeChartImage: sizeChartImageUrl,
          imageFiles: images,
        })

        pushToast('success', 'Product added successfully.')
      }

      setShowProductModal(false)
      resetForm()
      await loadProducts()
    } catch (error) {
      pushToast('error', error.message || 'Failed to save product.')
    } finally {
      setIsSaving(false)
      setIsUploadingImages(false)
    }
  }

  const handleDelete = async (productId) => {
    setDeletingProductId(productId)

    try {
      await removeProduct(productId)
      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId),
      )
      setSelectedProductIds((current) => current.filter((id) => id !== productId))
      pushToast('success', 'Product deleted successfully.')
    } catch (error) {
      pushToast('error', error.message || 'Failed to delete product.')
    } finally {
      setShowDeleteModal(false)
      setDeletingProductId('')
    }
  }

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) {
      return
    }

    try {
      await Promise.all(selectedProductIds.map((id) => removeProduct(id)))
      setProducts((currentProducts) =>
        currentProducts.filter((product) => !selectedProductIds.includes(product.id)),
      )
      setSelectedProductIds([])
      pushToast('success', 'Selected products deleted.')
    } catch {
      pushToast('error', 'Failed to bulk delete products.')
    }
  }

  const handleCopyProductLink = async (productId) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/product/${productId}`)
      pushToast('success', 'Product link copied.')
    } catch {
      pushToast('error', 'Unable to copy product link.')
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await logoutAdmin()
      navigate('/login', { replace: true })
    } catch (error) {
      pushToast('error', error.message || 'Failed to logout.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)

    try {
      await updateAdminProfile(profileForm)

      const adminUser = getCurrentAdmin()
      setProfileForm((current) => ({
        ...current,
        displayName: adminUser?.displayName || current.displayName,
        email: adminUser?.email || current.email,
        currentPassword: '',
      }))

      pushToast('success', 'Profile updated successfully.')
    } catch (error) {
      pushToast('error', error.message || 'Failed to update profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    setIsSavingPassword(true)

    try {
      await updateAdminPasswordSecure(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '' })
      pushToast('success', 'Password updated successfully.')
    } catch (error) {
      pushToast('error', error.message || 'Failed to update password.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const name = String(product.name || '').toLowerCase()
      const category = String(product.category || '').toLowerCase()

      const matchesQuery =
        !normalizedQuery || name.includes(normalizedQuery) || category.includes(normalizedQuery)
      const matchesCategory =
        productCategoryFilter === 'all' || String(product.category || '').trim() === productCategoryFilter

      return matchesQuery && matchesCategory
    })
  }, [products, query, productCategoryFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage])

  const selectedProductsCount = selectedProductIds.length

  const metrics = useMemo(() => {
    const totalProducts = products.length
    const totalOrders = orders.length

    const usersMap = new Map()
    orders.forEach((order) => {
      const key = `${String(order.customerName || '').trim()}-${String(order.customerPhone || '').trim()}`
      if (!usersMap.has(key) && (order.customerName || order.customerPhone)) {
        usersMap.set(key, order)
      }
    })

    const totalUsers = usersMap.size
    const revenue = orders.reduce((sum, order) => {
      if (order.paymentStatus === 'paid') {
        return sum + Number(order.productPrice || 0)
      }
      return sum
    }, 0)

    return {
      totalProducts,
      totalOrders,
      totalUsers,
      revenue,
    }
  }, [products, orders])

  const chartData = useMemo(() => {
    const days = []
    const now = new Date()

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - offset)
      const key = date.toISOString().slice(0, 10)
      days.push({ key, label: date.toLocaleDateString('en-IN', { weekday: 'short' }), total: 0 })
    }

    const map = new Map(days.map((item) => [item.key, item]))

    orders.forEach((order) => {
      const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)
      const key = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toISOString().slice(0, 10)
      const existing = map.get(key)

      if (existing) {
        existing.total += Number(order.productPrice || 0)
      }
    })

    return days
  }, [orders])

  const maxChartValue = Math.max(1, ...chartData.map((item) => item.total))

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const result = orders.filter((order) => {
      const statusMatch = orderStatusFilter === 'all' || String(order.status || '').toLowerCase() === orderStatusFilter
      const target = `${order.customerName || ''} ${order.customerPhone || ''} ${order.productName || ''}`.toLowerCase()
      const queryMatch = !normalizedQuery || target.includes(normalizedQuery)

      return statusMatch && queryMatch
    })

    return [...result].sort((a, b) => {
      const left = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
      const right = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
      return orderSort === 'newest' ? right - left : left - right
    })
  }, [orders, orderStatusFilter, orderSort, query])

  const filteredOrderIds = useMemo(
    () => filteredOrders.map((order) => order.id),
    [filteredOrders],
  )

  const allVisibleOrdersSelected =
    filteredOrderIds.length > 0 && filteredOrderIds.every((id) => selectedOrderIds.includes(id))

  useEffect(() => {
    setSelectedOrderIds((currentIds) => currentIds.filter((id) => filteredOrderIds.includes(id)))
  }, [filteredOrderIds])

  const handleToggleOrderSelection = (orderId) => {
    setSelectedOrderIds((currentIds) =>
      currentIds.includes(orderId)
        ? currentIds.filter((id) => id !== orderId)
        : [...currentIds, orderId],
    )
  }

  const handleSelectAllVisibleOrders = (checked) => {
    if (checked) {
      setSelectedOrderIds(filteredOrderIds)
      return
    }

    setSelectedOrderIds([])
  }

  const handleBulkOrderStatusUpdate = async () => {
    if (!bulkOrderStatus || selectedOrderIds.length === 0) {
      return
    }

    setIsBulkUpdatingOrders(true)

    try {
      await Promise.all(selectedOrderIds.map((orderId) => updateOrderStatus(orderId, bulkOrderStatus)))

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          selectedOrderIds.includes(order.id) ? { ...order, status: bulkOrderStatus } : order,
        ),
      )

      setSelectedOrderIds([])
      setBulkOrderStatus('')
      pushToast('success', 'Selected orders updated.')
    } catch {
      pushToast('error', 'Failed to update selected orders.')
    } finally {
      setIsBulkUpdatingOrders(false)
    }
  }

  const handleBulkDeleteOrders = async () => {
    if (selectedOrderIds.length === 0) {
      return
    }

    setIsBulkDeletingOrders(true)

    try {
      await Promise.all(selectedOrderIds.map((orderId) => deleteOrder(orderId)))
      setOrders((currentOrders) =>
        currentOrders.filter((order) => !selectedOrderIds.includes(order.id)),
      )
      setSelectedOrderIds([])
      pushToast('success', 'Selected orders deleted.')
    } catch {
      pushToast('error', 'Failed to delete selected orders.')
    } finally {
      setIsBulkDeletingOrders(false)
    }
  }

  const users = useMemo(() => {
    const map = new Map()

    orders.forEach((order) => {
      const name = String(order.customerName || '').trim()
      const phone = String(order.customerPhone || '').trim()
      const key = `${name}-${phone}`

      if (!map.has(key) && (name || phone)) {
        map.set(key, {
          id: key,
          userId: String(order.userId || '').trim(),
          phone: phone,
          name: name || 'Guest',
          email: order.customerEmail || '-',
          role: 'Customer',
        })
      }
    })

    return [...map.values()]
  }, [orders])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return users
    }

    return users.filter((user) => {
      const target = `${user.name || ''} ${user.email || ''} ${user.role || ''} ${user.phone || ''}`.toLowerCase()
      return target.includes(normalizedQuery)
    })
  }, [query, users])

  const handleDeleteUser = async (user) => {
    const userKey = String(user?.id || '').trim()

    if (!userKey) {
      pushToast('error', 'Invalid user record.')
      return
    }

    if (!window.confirm(`Delete user ${user.name || 'this user'} from dashboard?`)) {
      return
    }

    setDeletingUserId(userKey)

    try {
      const linkedOrders = orders.filter((order) => {
        const orderKey = `${String(order.customerName || '').trim()}-${String(order.customerPhone || '').trim()}`
        return orderKey === userKey
      })

      if (linkedOrders.length > 0) {
        await Promise.all(linkedOrders.map((order) => deleteOrder(order.id)))
        setOrders((currentOrders) => {
          const linkedOrderIds = new Set(linkedOrders.map((order) => order.id))
          return currentOrders.filter((order) => !linkedOrderIds.has(order.id))
        })
      }

      if (user.userId) {
        await deleteUserProfile(user.userId)
      }

      pushToast('success', 'User deleted successfully.')
    } catch {
      pushToast('error', 'Failed to delete user.')
    } finally {
      setDeletingUserId('')
    }
  }

  const sectionTitle = {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    users: 'Users',
    analytics: 'Analytics',
    settings: 'Settings',
  }[activeSection]

  return (
    <>
      <AdminLayout
        activeKey={activeSection}
        onChangeKey={setActiveSection}
        title={sectionTitle}
        query={query}
        onQueryChange={setQuery}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      >
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Products"
                value={metrics.totalProducts}
                hint="Live inventory"
                icon={<span className="text-sm">P</span>}
              />
              <StatCard
                title="Total Orders"
                value={metrics.totalOrders}
                hint="Across all channels"
                icon={<span className="text-sm">O</span>}
              />
              <StatCard
                title="Total Users"
                value={metrics.totalUsers}
                hint="Unique shoppers"
                icon={<span className="text-sm">U</span>}
              />
              <StatCard
                title="Revenue"
                value={formatCurrency(metrics.revenue)}
                hint="Paid orders"
                icon={<span className="text-sm">R</span>}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft lg:col-span-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Sales Trend</h3>
                <div className="mt-5 flex h-52 items-end gap-3">
                  {chartData.map((item) => {
                    const ratio = item.total / maxChartValue
                    const height = Math.max(10, Math.round(ratio * 150))

                    return (
                      <div key={item.key} className="flex-1 space-y-2 text-center">
                        <div className="relative mx-auto h-40 w-full max-w-[48px] rounded-xl bg-white/[0.04]">
                          <div
                            className="absolute bottom-0 left-0 right-0 mx-auto w-full rounded-xl bg-gradient-to-t from-[#c19a6b] to-[#ecd7b8]"
                            style={{ height }}
                          />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{item.label}</p>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft lg:col-span-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Recent Orders</h3>
                <div className="mt-4 space-y-3">
                  {recentOrders.length === 0 && (
                    <p className="text-sm text-white/55">No orders yet.</p>
                  )}
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-white/10 bg-[#0f0f0f] px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-white">{order.customerName || 'Customer'}</p>
                      <p className="text-xs text-white/55">{order.productName || 'Product'} • {formatCurrency(order.productPrice)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeSection === 'products' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={handleOpenCreate}>Add Product</Button>
                <Button variant="secondary" onClick={loadProducts}>Refresh</Button>
                <Button
                  variant="danger"
                  disabled={selectedProductsCount === 0}
                  onClick={handleBulkDeleteProducts}
                >
                  Bulk Delete ({selectedProductsCount})
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={productCategoryFilter}
                  onChange={(event) => setProductCategoryFilter(event.target.value)}
                  className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/80"
                >
                  <option value="all">All Categories</option>
                  {adminCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <div className="rounded-2xl border border-white/15 bg-[#0f0f0f] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      viewMode === 'grid' ? 'bg-[#c19a6b] text-black' : 'text-white/65'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      viewMode === 'table' ? 'bg-[#c19a6b] text-black' : 'text-white/65'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {isLoadingProducts && <Loader label="Loading products" />}

            {!isLoadingProducts && filteredProducts.length === 0 && (
              <EmptyState
                title="No products found"
                description="Try changing your search query or category filter."
              />
            )}

            {!isLoadingProducts && filteredProducts.length > 0 && viewMode === 'grid' && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pagedProducts.map((product) => {
                  const productImages = getProductImages(product)
                  const activeImageIndex = activeCardImageIndex[product.id] || 0
                  const activeImage = productImages[activeImageIndex] || ''
                  const inStock = Array.isArray(product.sizes) && product.sizes.length > 0

                  return (
                    <article key={product.id} className="rounded-2xl border border-white/10 bg-[#111111] p-3 shadow-soft">
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-black/40">
                        {activeImage ? (
                          <img src={activeImage} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-white/45">No image</div>
                        )}
                      </div>

                      {productImages.length > 1 && (
                        <div className="mt-2 flex gap-1.5 overflow-auto pb-1">
                          {productImages.map((imageUrl, index) => (
                            <button
                              key={`${product.id}-${index}`}
                              type="button"
                              onClick={() => setActiveCardImageIndex((current) => ({ ...current, [product.id]: index }))}
                              className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg border ${
                                index === activeImageIndex ? 'border-[#c19a6b]' : 'border-white/15'
                              }`}
                            >
                              <img src={imageUrl} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-1 text-sm font-semibold text-white">{product.name}</h3>
                          <Badge tone={inStock ? 'success' : 'danger'}>{inStock ? 'In Stock' : 'Out of Stock'}</Badge>
                        </div>

                        <p className="text-xs text-white/60">{product.category || 'Uncategorized'}</p>
                        <p className="text-sm font-semibold text-[#f0ddc4]">{formatCurrency(product.price)}</p>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button variant="secondary" onClick={() => handleOpenEdit(product)}>Edit</Button>
                          <Button variant="danger" onClick={() => { setDeletingProductId(product.id); setShowDeleteModal(true) }}>Delete</Button>
                          <Button variant="ghost" className="col-span-2" onClick={() => handleCopyProductLink(product.id)}>
                            Copy Product Link
                          </Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {!isLoadingProducts && filteredProducts.length > 0 && viewMode === 'table' && (
              <Table
                columns={[
                  { key: 'select', label: '' },
                  { key: 'product', label: 'Product' },
                  { key: 'price', label: 'Price' },
                  { key: 'category', label: 'Category' },
                  { key: 'stock', label: 'Stock' },
                  { key: 'actions', label: 'Actions' },
                ]}
              >
                {pagedProducts.map((product) => {
                  const inStock = Array.isArray(product.sizes) && product.sizes.length > 0

                  return (
                    <tr key={product.id} className="border-b border-white/8">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedProductIds((current) => [...current, product.id])
                            } else {
                              setSelectedProductIds((current) => current.filter((id) => id !== product.id))
                            }
                          }}
                          className="h-4 w-4 rounded border-white/25 bg-transparent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getProductImages(product)[0] || ''}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                          />
                          <span className="text-sm font-medium text-white">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#f0ddc4]">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-3 text-sm text-white/70">{product.category || 'Uncategorized'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={inStock ? 'success' : 'danger'}>{inStock ? 'In stock' : 'Out of stock'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" className="px-3 py-2" onClick={() => handleOpenEdit(product)}>
                            Edit
                          </Button>
                          <Button variant="danger" className="px-3 py-2" onClick={() => { setDeletingProductId(product.id); setShowDeleteModal(true) }}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </Table>
            )}

            {!isLoadingProducts && filteredProducts.length > pageSize && (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111111] px-4 py-3">
                <p className="text-xs text-white/60">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>
                    Previous
                  </Button>
                  <Button variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft md:grid-cols-3">
              <select
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
                className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/80"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Shipped</option>
                <option value="completed">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={orderSort}
                onChange={(event) => setOrderSort(event.target.value)}
                className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/80"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              <Button variant="secondary" onClick={loadOrders}>Refresh Orders</Button>
            </div>

            {filteredOrders.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allVisibleOrdersSelected}
                    onChange={(event) => handleSelectAllVisibleOrders(event.target.checked)}
                    className="h-4 w-4 rounded border-white/25 bg-transparent"
                    aria-label="Select all visible orders"
                  />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    Selected: {selectedOrderIds.length}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkOrderStatus}
                    onChange={(event) => setBulkOrderStatus(event.target.value)}
                    className="rounded-2xl border border-white/15 bg-[#0f0f0f] px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/80"
                    disabled={selectedOrderIds.length === 0 || isBulkUpdatingOrders || isBulkDeletingOrders}
                  >
                    <option value="">Set status...</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Shipped</option>
                    <option value="completed">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <Button
                    variant="secondary"
                    disabled={!bulkOrderStatus || selectedOrderIds.length === 0 || isBulkUpdatingOrders || isBulkDeletingOrders}
                    onClick={handleBulkOrderStatusUpdate}
                  >
                    {isBulkUpdatingOrders ? 'Applying...' : 'Apply Status'}
                  </Button>

                  <Button
                    variant="danger"
                    disabled={selectedOrderIds.length === 0 || isBulkUpdatingOrders || isBulkDeletingOrders}
                    onClick={handleBulkDeleteOrders}
                  >
                    {isBulkDeletingOrders ? 'Deleting...' : 'Delete Selected'}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => setSelectedOrderIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {isLoadingOrders && <Loader label="Loading orders" />}

            {!isLoadingOrders && filteredOrders.length === 0 && (
              <EmptyState title="No orders found" description="Orders matching this filter will appear here." />
            )}

            {!isLoadingOrders && filteredOrders.length > 0 && (
              <Table
                columns={[
                  { key: 'select', label: '' },
                  { key: 'id', label: 'Order ID' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'products', label: 'Products' },
                  { key: 'total', label: 'Total' },
                  { key: 'status', label: 'Status' },
                  { key: 'date', label: 'Date' },
                  { key: 'actions', label: 'Actions' },
                ]}
              >
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-white/8">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => handleToggleOrderSelection(order.id)}
                        className="h-4 w-4 rounded border-white/25 bg-transparent"
                        aria-label={`Select order ${order.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">{order.id?.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{order.customerName || 'Customer'}</p>
                      <p className="text-xs text-white/50">{order.customerPhone || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">1 item</td>
                    <td className="px-4 py-3 text-sm text-[#f0ddc4]">{formatCurrency(order.productPrice)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={getOrderStatusTone(order.status)}>{order.status || 'pending'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={order.status || 'pending'}
                          onChange={async (event) => {
                            const nextStatus = event.target.value
                            try {
                              await updateOrderStatus(order.id, nextStatus)
                              setOrders((currentOrders) =>
                                currentOrders.map((item) =>
                                  item.id === order.id ? { ...item, status: nextStatus } : item,
                                ),
                              )
                              pushToast('success', 'Order status updated.')
                            } catch {
                              pushToast('error', 'Failed to update order status.')
                            }
                          }}
                          className="rounded-xl border border-white/15 bg-[#0f0f0f] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-white/75"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Shipped</option>
                          <option value="completed">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <Button
                          variant="danger"
                          className="px-3 py-2"
                          disabled={deletingOrderId === order.id}
                          onClick={async () => {
                            setDeletingOrderId(order.id)
                            try {
                              await deleteOrder(order.id)
                              setOrders((currentOrders) => currentOrders.filter((item) => item.id !== order.id))
                              pushToast('success', 'Order deleted.')
                            } catch {
                              pushToast('error', 'Failed to delete order.')
                            } finally {
                              setDeletingOrderId('')
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}

        {activeSection === 'users' && (
          <div className="space-y-4">
            {filteredUsers.length === 0 && (
              <EmptyState
                title={users.length === 0 ? 'No user data yet' : 'No users match your search'}
                description={users.length === 0 ? 'Users are auto-listed from order history.' : 'Try a different search keyword.'}
              />
            )}

            {filteredUsers.length > 0 && (
              <Table
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'role', label: 'Role' },
                  { key: 'actions', label: 'Actions' },
                ]}
              >
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/8">
                    <td className="px-4 py-3 text-sm text-white">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{user.email}</td>
                    <td className="px-4 py-3"><Badge tone="accent">{user.role}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => pushToast('success', 'Promote action queued (UI preview).')}>
                          Promote
                        </Button>
                        <Button variant="danger" disabled={deletingUserId === user.id} onClick={() => handleDeleteUser(user)}>
                          {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}

        {activeSection === 'analytics' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Orders Per Day</h3>
              <div className="mt-5 space-y-2">
                {chartData.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{item.label}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/8">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#c19a6b] to-[#ecd7b8]"
                        style={{ width: `${Math.max(5, (item.total / maxChartValue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Revenue Summary</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Paid Revenue</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(metrics.revenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Total Orders</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{metrics.totalOrders}</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Admin Profile</h3>
              <div className="mt-4 space-y-3">
                <Input
                  label="Display Name"
                  value={profileForm.displayName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                />
                <Input
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
                <Input
                  label="Current Password (for email change)"
                  type="password"
                  value={profileForm.currentPassword}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                />
                <Button variant="primary" onClick={handleSaveProfile} disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-soft">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Security</h3>
              <div className="mt-4 space-y-3">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                />
                <Button variant="secondary" onClick={handleSavePassword} disabled={isSavingPassword}>
                  {isSavingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </section>
          </div>
        )}
      </AdminLayout>

      <Modal
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false)
          resetForm()
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSubmitProduct} className="grid gap-4 md:grid-cols-2">
          <Input
            label="Name"
            name="name"
            value={formValues.name}
            onChange={handleInputChange}
            placeholder="Classic Black Shirt"
            required
          />

          <Input
            label="Price (INR)"
            name="price"
            type="number"
            min="1"
            value={formValues.price}
            onChange={handleInputChange}
            placeholder="1999"
            required
          />

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Category</span>
            <select
              name="category"
              value={formValues.category}
              onChange={handleInputChange}
              className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none transition duration-300 focus:border-[#c19a6b]/60"
            >
              {adminCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <Input
            label="Stock (Preview Field)"
            placeholder="Auto-managed by product sizes"
            disabled
          />

          <Input
            className="md:col-span-2"
            label="Sizes (comma separated)"
            name="sizesInput"
            value={formValues.sizesInput}
            onChange={handleInputChange}
            placeholder="S,M,L,XL"
          />

          <label className="space-y-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Description</span>
            <textarea
              name="description"
              rows={4}
              value={formValues.description}
              onChange={handleInputChange}
              className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none transition duration-300 focus:border-[#c19a6b]/60"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Product Images {editingProduct ? '(Optional for updates)' : ''}
            </span>
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-2.5 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#c19a6b] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.12em] file:text-black"
            />

            {isSaving && isUploadingImages && (
              <p className="text-xs text-white/60">Uploading images...</p>
            )}

            {selectedImagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {selectedImagePreviews.map((previewUrl, index) => {
                  const imageFile = images[index]

                  return (
                    <div key={previewUrl} className="relative">
                      <img
                        src={previewUrl}
                        alt="Selected product preview"
                        className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedImage(imageFile)}
                        className="absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-white"
                        aria-label="Remove selected image"
                      >
                        x
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {editingProduct && retainedExistingImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {retainedExistingImages.map((imageUrl, index) => (
                  <div key={`${imageUrl}-${index}`} className="relative">
                    <img
                      src={imageUrl}
                      alt="Current product"
                      className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-white"
                      aria-label="Remove existing image"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Size Chart (Text)</span>
            <textarea
              name="sizeChartText"
              rows={3}
              value={formValues.sizeChartText}
              onChange={handleInputChange}
              className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none transition duration-300 focus:border-[#c19a6b]/60"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Size Chart Image</span>
            <input
              key={`${fileInputKey}-size-chart`}
              type="file"
              accept="image/*"
              onChange={handleSizeChartImageChange}
              className="w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-2.5 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[#c19a6b] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.12em] file:text-black"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowProductModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeletingProductId('')
        }}
        title="Confirm Delete"
        maxWidth="max-w-lg"
        footer={(
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => handleDelete(deletingProductId)}
              disabled={!deletingProductId}
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false)
                setDeletingProductId('')
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      >
        <p className="text-sm text-white/70">This action cannot be undone. Delete selected product?</p>
      </Modal>

      <AnimatePresence>
        {toast.message && (
          <Motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={`fixed bottom-5 right-5 z-[160] rounded-2xl border px-4 py-3 text-sm shadow-elevated ${
              toast.type === 'error'
                ? 'border-red-500/35 bg-red-500/15 text-red-100'
                : 'border-[#c19a6b]/40 bg-[#c19a6b]/15 text-[#f0ddc4]'
            }`}
          >
            {toast.message}
          </Motion.div>
        )}
      </AnimatePresence>

    </>
  )
}

export default Admin
