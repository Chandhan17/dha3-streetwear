export async function shareProductLink({ productId, productName = 'Product' }) {
  const normalizedProductId = String(productId || '').trim()

  if (!normalizedProductId) {
    throw new Error('Product not found')
  }

  const productUrl = `${window.location.origin}/product/${normalizedProductId}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: String(productName || 'Product').trim() || 'Product',
        url: productUrl,
      })

      return { copied: false, aborted: false }
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { copied: false, aborted: true }
      }

      throw error
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(productUrl)
    return { copied: true, aborted: false }
  }

  throw new Error('Unable to share this product')
}
