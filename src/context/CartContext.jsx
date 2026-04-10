/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CART_STORAGE_KEY = 'dhaThreeStreetwearCart'

const CartContext = createContext(null)

function readStoredCart() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .map((item) => ({
        cartItemId: String(item.cartItemId || item.id || '').trim(),
        productId: String(item.productId || item.id || '').trim(),
        name: String(item.name || '').trim(),
        price: Number(item.price || 0),
        imageUrl: String(item.imageUrl || '').trim(),
        category: String(item.category || '').trim(),
        selectedSize: String(item.selectedSize || 'N/A').trim() || 'N/A',
        quantity: Math.max(1, Number(item.quantity || 1)),
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
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Ignore storage failures so cart actions still work in memory.
    }
  }, [items])

  const addToCart = (product, options = {}) => {
    const productId = String(product?.id || '').trim()
    const productName = String(product?.name || 'Product').trim() || 'Product'
    const selectedSize = String(options.selectedSize || 'N/A').trim() || 'N/A'
    const quantity = Math.max(1, Number(options.quantity || 1))
    const cartItemId = buildCartItemId(productId, selectedSize)

    if (!productId) {
      return
    }

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.cartItemId === cartItemId)

      if (existingItem) {
        return currentItems.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }

      return [
        ...currentItems,
        {
          cartItemId,
          productId,
          name: productName,
          price: Number(product?.price || 0),
          imageUrl: String(product?.imageUrl || product?.image || product?.images?.[0] || '').trim(),
          category: String(product?.category || '').trim(),
          selectedSize,
          quantity,
        },
      ]
    })

    return cartItemId
  }

  const removeFromCart = (cartItemId) => {
    const normalizedCartItemId = String(cartItemId || '').trim()

    if (!normalizedCartItemId) {
      return
    }

    setItems((currentItems) =>
      currentItems.filter((item) => item.cartItemId !== normalizedCartItemId),
    )
  }

  const updateQuantity = (cartItemId, quantity) => {
    const normalizedCartItemId = String(cartItemId || '').trim()
    const nextQuantity = Math.max(1, Number(quantity || 0))

    if (!normalizedCartItemId) {
      return
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartItemId === normalizedCartItemId ? { ...item, quantity: nextQuantity } : item,
      ),
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const cartCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  )

  const cartTotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items],
  )

  const value = useMemo(
    () => ({
      items,
      cartCount,
      cartTotal,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
    }),
    [cartCount, cartTotal, items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }

  return context
}