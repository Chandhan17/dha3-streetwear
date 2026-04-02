import { createPortal } from 'react-dom'

function BrandedNotification({ message }) {
  if (!message) {
    return null
  }

  const content = (
    <div className="fixed left-1/2 top-5 z-[9999] flex -translate-x-1/2 transform items-center gap-2 rounded-xl bg-black px-4 py-2 text-white shadow-lg">
      {message}
    </div>
  )

  if (typeof document === 'undefined') {
    return content
  }

  return createPortal(content, document.body)
}

export default BrandedNotification
