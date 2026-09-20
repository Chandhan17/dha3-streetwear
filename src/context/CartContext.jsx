/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CART_STORAGE_KEY = 'dhaThreeStreetwearCart'
const CartContext = createContext(null)

function readStoredCart() {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!rawValue) return []
    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) return []
    return parsedValue
      .map((item) => ({
        cartItemId: String(item.cartItemId || item.id || '').trim(),
        productId: String(item.productId || item.id || '').trim(),
        name: String(item.name || '').trim(),
        price: Number(item.price || 0),
        imageUrl: String(item.imageUrl || '').trim(),
        category: String(item.category || '').trim(),
        selectedSize: String(item.selectedSize || 'N/A').trim() || 'N/A',
        quantity: Math.min(1, Math.max(1, Number(item.quantity || 1))),
      }))
      .filter((item) => Boolean(item.cartItemId) && Boolean(item.productId) && Boolean(item.name))
  } catch {
    return []
  }
}

function buildCartItemId(productId, selectedSize) {
  return `${productId}::${selectedSize || 'N/A'}`
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart)

  useEffect(() => {
    try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)) } catch { /* Ignore storage failures. */ }
  }, [items])

  const addToCart = (product, options = {}) => {
    const productId = String(product?.id || '').trim()
    const productName = String(product?.name || 'Product').trim() || 'Product'
    const selectedSize = String(options.selectedSize || 'N/A').trim() || 'N/A'
    const requestedQuantity = Math.max(1, Number(options.quantity || 1))
    const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0
    const cartItemId = buildCartItemId(productId, selectedSize)
    const availableStock = Number(product?.stock)
    const sizeStockSource = product?.sizeStock && typeof product.sizeStock === 'object' ? product.sizeStock : {}
    const hasTrackedSize = hasSizes && Object.prototype.hasOwnProperty.call(sizeStockSource, selectedSize)
    const availableSizeStock = hasTrackedSize ? Number(sizeStockSource[selectedSize]) : (hasSizes ? 1 : Number.POSITIVE_INFINITY)

    if (!productId) return null
    if (hasSizes && selectedSize === 'N/A') return null
    if ((hasSizes && availableSizeStock <= 0) || (!hasSizes && Number.isFinite(availableStock) && availableStock <= 0)) return null

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.cartItemId === cartItemId)
      const currentQuantity = existingItem?.quantity || 0
      const maxQuantity = hasSizes && Number.isFinite(availableSizeStock)
        ? availableSizeStock
        : Number.isFinite(availableStock)
          ? availableStock
          : Number.POSITIVE_INFINITY
      const requestedTotal = currentQuantity + requestedQuantity
      const cappedQuantity = Math.min(requestedTotal, maxQuantity, hasSizes ? 1 : Number.POSITIVE_INFINITY)

      if (cappedQuantity <= 0) return currentItems

      if (existingItem) {
        return currentItems.map((item) => item.cartItemId === cartItemId ? { ...item, quantity: cappedQuantity } : item)
      }

      return [
        ...currentItems,
        {
          cartItemId,
          productId,
          name: productName,
          price: Number(product?.effectivePrice ?? product?.price ?? 0),
          imageUrl: String(product?.imageUrl || product?.image || product?.images?.[0] || '').trim(),
          category: String(product?.category || '').trim(),
          selectedSize,
          quantity: Math.min(requestedQuantity, maxQuantity, hasSizes ? 1 : Number.POSITIVE_INFINITY),
        },
      ]
    })

    return cartItemId
  }

  const removeFromCart = (cartItemId) => {
    const normalizedCartItemId = String(cartItemId || '').trim()
    if (!normalizedCartItemId) return
    setItems((currentItems) => currentItems.filter((item) => item.cartItemId !== normalizedCartItemId))
  }

  const updateQuantity = (cartItemId, quantity) => {
    const normalizedCartItemId = String(cartItemId || '').trim()
    const nextQuantity = Math.max(1, Number(quantity || 0))
    if (!normalizedCartItemId) return
    setItems((currentItems) => currentItems.map((item) => item.cartItemId === normalizedCartItemId ? { ...item, quantity: item.selectedSize !== 'N/A' ? 1 : nextQuantity } : item))
  }

  const clearCart = () => setItems([])
  const cartCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items])
  const cartTotal = useMemo(() => items.reduce((total, item) => total + item.price * item.quantity, 0), [items])
  const value = useMemo(() => ({ items, cartCount, cartTotal, addToCart, removeFromCart, updateQuantity, clearCart }), [cartCount, cartTotal, items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
