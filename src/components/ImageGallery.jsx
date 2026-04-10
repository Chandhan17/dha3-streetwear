import { useEffect, useMemo, useState } from 'react'

function ImageGallery({
  images,
  productName,
  selectedImage,
  onSelectImage,
}) {
  const [failedPrimaryImage, setFailedPrimaryImage] = useState('')

  const normalizedImages = useMemo(
    () =>
      Array.isArray(images)
        ? images
            .map((image) => String(image || '').trim())
            .filter((image) => Boolean(image))
        : [],
    [images],
  )

  const primaryImage = selectedImage || normalizedImages[0] || ''
  const hasPrimaryImageError = Boolean(primaryImage) && failedPrimaryImage === primaryImage
  const resolvedProductName = String(productName || 'Product').trim() || 'Product'

  useEffect(() => {
    if (!selectedImage && normalizedImages.length > 0) {
      onSelectImage(normalizedImages[0])
    }
  }, [normalizedImages, onSelectImage, selectedImage])

  if (normalizedImages.length === 0) {
    return (
      <div className="luxury-panel grid min-h-[420px] place-items-center text-sm text-white/55">
        Image unavailable
      </div>
    )
  }

  return (
    <section className="md:grid md:grid-cols-[84px_1fr] md:gap-4">
      <div className="order-2 mt-3 flex gap-2 overflow-x-auto pb-1 md:order-1 md:mt-0 md:flex-col md:overflow-visible">
        {normalizedImages.map((image, index) => {
          const isActive = image === primaryImage

          return (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => onSelectImage(image)}
              className={`shrink-0 overflow-hidden rounded-xl border transition duration-300 md:w-full ${
                isActive
                  ? 'scale-[1.02] border-obsidian shadow-soft'
                  : 'border-white/10 hover:border-white/25 hover:shadow-soft'
              }`}
            >
              <img
                src={image}
                alt={`${resolvedProductName} thumbnail ${index + 1}`}
                className="h-20 w-20 object-cover md:h-24 md:w-full"
                loading="lazy"
                sizes="(min-width: 768px) 96px, 80px"
                decoding="async"
              />
            </button>
          )
        })}
      </div>

      <div className="order-1 luxury-panel group overflow-hidden md:order-2">
        <div className="aspect-square bg-black/[0.04]">
          {hasPrimaryImageError ? (
            <div className="grid h-full place-items-center px-4 text-center text-sm text-white/55">
              Unable to load this image. Please select another thumbnail.
            </div>
          ) : (
            <img
              src={primaryImage}
              alt={resolvedProductName}
              onError={() => setFailedPrimaryImage(primaryImage)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 768px) 60vw, 100vw"
              decoding="async"
            />
          )}
        </div>
      </div>
    </section>
  )
}

export default ImageGallery