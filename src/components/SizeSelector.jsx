import { memo } from 'react'

function SizeSelector({ sizes, selectedSize, onSelectSize, hasError = false, isShaking = false, sizeStock = {} }) {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          Available Sizes
        </p>
        <p className="text-[11px] font-medium text-white/40">
          1 unit available per size
        </p>
      </div>

      <div className={`flex flex-wrap gap-2 ${hasError && isShaking ? 'size-shake' : ''}`}>
        {sizes.map((size) => {
          const isActive = selectedSize === size
          const hasTrackedStock = Object.prototype.hasOwnProperty.call(sizeStock || {}, size)
          const isAvailable = !hasTrackedStock || Number(sizeStock[size]) > 0
          const isDisabled = !isAvailable

          return (
            <button
              key={size}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectSize(size)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isDisabled
                  ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-white/25 line-through'
                  : isActive
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