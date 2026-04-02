import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clientConfig from '../config'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import AdminOrders from '../components/AdminOrders'
import { logoutAdmin } from '../services/authService'
import { uploadImage } from '../services/uploadService'
import {
  createProduct,
  editProduct,
  fetchProducts,
  removeProduct,
} from '../services/productService'

const fallbackCategories = ['Shirts', 'T-Shirts', 'Jeans', 'Shoes', 'Accessories']
const adminCategories =
  Array.isArray(clientConfig.productCategories) && clientConfig.productCategories.length
    ? clientConfig.productCategories
    : fallbackCategories

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

function Admin() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('products')
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [activeCardImageIndex, setActiveCardImageIndex] = useState({})

  const [images, setImages] = useState([])
  const [formValues, setFormValues] = useState(getInitialFormState())
  const [editingProduct, setEditingProduct] = useState(null)
  const [retainedExistingImages, setRetainedExistingImages] = useState([])
  const [fileInputKey, setFileInputKey] = useState(Date.now())

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

  const existingProductImages = retainedExistingImages

  const loadProducts = async () => {
    setIsLoading(true)

    try {
      const productList = await fetchProducts()
      setProducts(productList)
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Unable to fetch products.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const resetForm = () => {
    setFormValues(getInitialFormState())
    setImages([])
    setRetainedExistingImages([])
    setEditingProduct(null)
    setFileInputKey(Date.now())
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

  const handleSizeChartImageChange = (event) => {
    const file = event.target.files?.[0] || null

    setFormValues((previousValues) => ({
      ...previousValues,
      sizeChartImageFile: file,
    }))
  }

  const validateForm = () => {
    // New products require an image; edit mode can reuse existing media.
    if (!formValues.name.trim() || !formValues.price) {
      setStatus({ type: 'error', message: 'Product name and price are required.' })
      return false
    }

    if (!formValues.category) {
      setStatus({ type: 'error', message: 'Please select a product category.' })
      return false
    }

    if (Number(formValues.price) <= 0) {
      setStatus({ type: 'error', message: 'Price must be greater than zero.' })
      return false
    }

    if (!editingProduct && images.length === 0) {
      setStatus({ type: 'error', message: 'Please upload at least one product image.' })
      return false
    }

    if (editingProduct && images.length === 0 && existingProductImages.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please keep at least one existing image or upload a new one.',
      })
      return false
    }

    return true
  }

  const addProduct = async () => {
    if (images.length === 0) {
      alert('Select at least one image')
      return
    }

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

    alert('Product Added')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setIsUploadingImages(images.length > 0 || Boolean(formValues.sizeChartImageFile))
    setStatus({ type: '', message: '' })

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
          currentImages: existingProductImages,
          currentImageUrl: editingProduct.imageUrl || editingProduct.image,
        })
        setStatus({ type: 'success', message: 'Product updated successfully.' })
        alert('Product updated successfully.')
      } else {
        await addProduct()
        setStatus({ type: 'success', message: 'Product added successfully.' })
      }

      resetForm()
      await loadProducts()
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Failed to save product.',
      })
      alert(error.message || 'Failed to save product. Please try again.')
    } finally {
      setIsUploadingImages(false)
      setIsSaving(false)
    }
  }

  const startEditing = (product) => {
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
    setStatus({ type: '', message: '' })
    setFileInputKey(Date.now())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (productId) => {
    const shouldDelete = window.confirm('Delete this product from store?')

    if (!shouldDelete) {
      return
    }

    setDeletingId(productId)

    try {
      await removeProduct(productId)
      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId),
      )
      setActiveCardImageIndex((previousIndexes) => {
        const nextIndexes = { ...previousIndexes }
        delete nextIndexes[productId]
        return nextIndexes
      })
      setStatus({ type: 'success', message: 'Product deleted successfully.' })
      alert('Product deleted successfully.')

      if (editingProduct?.id === productId) {
        resetForm()
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Failed to delete product.',
      })
      alert('Failed to delete product. Please try again.')
    } finally {
      setDeletingId('')
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await logoutAdmin()
      navigate('/login', { replace: true })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Failed to logout. Please try again.',
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar
        adminMode
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 pb-14 pt-6 md:px-8 md:pt-10">
        {/* Admin Tabs */}
        <div className="flex border-b border-black/10">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'products'
                ? 'border-b-2 border-obsidian text-obsidian'
                : 'text-black/60 hover:text-obsidian'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'orders'
                ? 'border-b-2 border-obsidian text-obsidian'
                : 'text-black/60 hover:text-obsidian'
            }`}
          >
            Orders
          </button>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <>
        <section className="luxury-panel p-6 md:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="chip w-fit">Admin Dashboard</p>
              <h1 className="mt-3 font-display text-3xl text-obsidian md:text-4xl">
                Product Management
              </h1>
            </div>
            <button
              type="button"
              onClick={loadProducts}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/70 transition hover:bg-black/5"
            >
              Refresh List
            </button>
          </div>

          {status.message && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 text-left">
              <label htmlFor="name" className="text-sm font-semibold text-obsidian">
                Product Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formValues.name}
                onChange={handleInputChange}
                placeholder="Classic Black Shirt"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="price" className="text-sm font-semibold text-obsidian">
                Price (INR)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="1"
                value={formValues.price}
                onChange={handleInputChange}
                placeholder="1999"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label
                htmlFor="category"
                className="text-sm font-semibold text-obsidian"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formValues.category}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              >
                {adminCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-left md:col-span-2">
              <label
                htmlFor="sizesInput"
                className="text-sm font-semibold text-obsidian"
              >
                Sizes (comma separated)
              </label>
              <input
                id="sizesInput"
                name="sizesInput"
                type="text"
                value={formValues.sizesInput}
                onChange={handleInputChange}
                placeholder="S,M,L,XL"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left md:col-span-2">
              <label
                htmlFor="description"
                className="text-sm font-semibold text-obsidian"
              >
                Product Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formValues.description}
                onChange={handleInputChange}
                placeholder="Describe this product for customers"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left md:col-span-2">
              <label
                htmlFor="sizeChartText"
                className="text-sm font-semibold text-obsidian"
              >
                Size Chart (Text)
              </label>
              <textarea
                id="sizeChartText"
                name="sizeChartText"
                rows={4}
                value={formValues.sizeChartText}
                onChange={handleInputChange}
                placeholder="Example: S - Chest 38, M - Chest 40, L - Chest 42"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left md:col-span-2">
              <label htmlFor="image" className="text-sm font-semibold text-obsidian">
                Product Images {editingProduct ? '(Optional for updates)' : ''}
              </label>
              <input
                key={fileInputKey}
                id="image"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-obsidian file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />

              {images.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-black/65">
                    {images.length} image{images.length > 1 ? 's' : ''} selected
                  </p>
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="rounded-full border border-black/15 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-black/70 transition hover:bg-black/5"
                  >
                    Clear Selected
                  </button>
                </div>
              )}

              {isSaving && isUploadingImages && (
                <p className="mt-2 text-xs font-semibold text-black/65">
                  Uploading images to Cloudinary...
                </p>
              )}

              {selectedImagePreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {selectedImagePreviews.map((previewUrl, index) => {
                    const imageFile = images[index]

                    return (
                      <div key={previewUrl} className="relative">
                        <img
                          src={previewUrl}
                          alt="Selected product preview"
                          className="aspect-square w-full rounded-lg border border-black/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedImage(imageFile)}
                          className="absolute right-1 top-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white"
                          aria-label="Remove selected image"
                        >
                          x
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {editingProduct && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/50">
                    Current Uploaded Images
                  </p>

                  {existingProductImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {existingProductImages.map((imageUrl, index) => (
                        <div key={`${imageUrl}-${index}`} className="relative">
                          <img
                            src={imageUrl}
                            alt="Current product"
                            className="aspect-square w-full rounded-lg border border-black/10 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(index)}
                            className="absolute right-1 top-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white"
                            aria-label="Remove existing image"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-black/50">
                      No existing images. Upload at least one new image before saving.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 text-left md:col-span-2">
              <label
                htmlFor="sizeChartImage"
                className="text-sm font-semibold text-obsidian"
              >
                Size Chart Image (Optional)
              </label>
              <input
                key={`${fileInputKey}-size-chart`}
                id="sizeChartImage"
                type="file"
                accept="image/*"
                onChange={handleSizeChartImageChange}
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-obsidian file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />

              {formValues.sizeChartImage && !formValues.sizeChartImageFile && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-black/65">
                  <a
                    href={formValues.sizeChartImage}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    View current size chart image
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setFormValues((previousValues) => ({
                        ...previousValues,
                        sizeChartImage: '',
                      }))
                    }
                    className="rounded-full border border-black/15 px-3 py-1 font-semibold uppercase tracking-[0.12em] text-[0.62rem] text-black/70 transition hover:bg-black/5"
                  >
                    Remove Current Image
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-obsidian px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? editingProduct
                    ? 'Updating...'
                    : 'Adding...'
                  : editingProduct
                    ? 'Update Product'
                    : 'Add Product'}
              </button>

              {editingProduct && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-black/15 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black/70 transition hover:bg-black/5"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl text-obsidian md:text-3xl">
            All Products
          </h2>

          {isLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="luxury-panel h-72 animate-pulse rounded-2xl bg-white/70"
                />
              ))}
            </div>
          )}

          {!isLoading && products.length === 0 && (
            <div className="luxury-panel px-4 py-10 text-center text-black/65">
              No products available. Add your first item above.
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const productImages = getProductImages(product)
                const requestedImageIndex = activeCardImageIndex[product.id] || 0
                const activeImageIndex =
                  requestedImageIndex >= 0 && requestedImageIndex < productImages.length
                    ? requestedImageIndex
                    : 0
                const activeImage = productImages[activeImageIndex] || ''

                return (
                  <article
                    key={product.id}
                    className="luxury-panel overflow-hidden rounded-2xl"
                  >
                    <div className="aspect-[4/3] bg-black/5">
                      {activeImage ? (
                        <img
                          src={activeImage}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-black/45">
                          No image available
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      {productImages.length > 1 && (
                        <div className="space-y-2">
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {productImages.map((imageUrl, index) => (
                              <button
                                key={`${product.id}-thumb-${index}`}
                                type="button"
                                onClick={() =>
                                  setActiveCardImageIndex((previousIndexes) => ({
                                    ...previousIndexes,
                                    [product.id]: index,
                                  }))
                                }
                                aria-label={`Preview image ${index + 1} for ${product.name}`}
                                className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border transition ${
                                  activeImageIndex === index
                                    ? 'border-obsidian ring-1 ring-obsidian/25'
                                    : 'border-black/10'
                                }`}
                              >
                                <img
                                  src={imageUrl}
                                  alt={`${product.name} thumbnail ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-black/45">
                            {productImages.length} images
                          </p>
                        </div>
                      )}

                      <h3 className="line-clamp-1 text-lg font-semibold text-obsidian">
                        {product.name}
                      </h3>
                      <p className="chip w-fit border-black/10 bg-black/5 text-[0.62rem] text-black/70">
                        {product.category || 'Uncategorized'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(product.sizes) && product.sizes.length > 0 ? (
                          product.sizes.map((size) => (
                            <span
                              key={`${product.id}-${size}`}
                              className="rounded-full border border-black/15 bg-white px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-black/70"
                            >
                              {size}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-black/45">No sizes</span>
                        )}
                      </div>
                      <p className="text-base font-bold text-accent">Rs. {product.price}</p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(product)}
                          className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-black/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {deletingId === product.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
          </>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="rounded-xl border border-black/10 bg-white p-6 md:p-8">
            <AdminOrders />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default Admin