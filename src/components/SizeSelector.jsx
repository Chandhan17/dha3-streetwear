import { memo } from 'react'

function SizeSelector({ sizes, selectedSize, onSelectSize, hasError = false, isShaking = false }) {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
        Available Sizes
      </p>

      <div className={`flex flex-wrap gap-2 ${hasError && isShaking ? 'size-shake' : ''}`}>
        {sizes.map((size) => {
          const isActive = selectedSize === size

          return (
            <button
              key={size}
              type="button"
              onClick={() => onSelectSize(size)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-obsidian bg-obsidian text-white shadow-soft'
                  : hasError
                    ? 'border-red-500 bg-red-500/10 text-red-200 hover:border-red-400'
                    : 'border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {size}
            </button>
          )
        })}
      </div>

      {hasError && (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-300">
          Select a size to continue
        </p>
      )}
    </section>
  )
}

export default memo(SizeSelector)