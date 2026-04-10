import { useEffect, useRef } from 'react'

function BrandStrip() {
  const scrollContainer = useRef(null)

  const brands = [
    'STREETWEAR',
    'MINIMAL',
    'BOLD',
    'URBAN',
    'ICONIC',
    'PREMIUM',
    'HERITAGE',
    'CULTURE',
  ]

  useEffect(() => {
    const container = scrollContainer.current
    if (!container) return

    let scrollPos = 0
    const scrollSpeed = 1

    const scroll = () => {
      scrollPos += scrollSpeed
      if (scrollPos >= container.scrollWidth / 2) {
        scrollPos = 0
      }
      container.scrollLeft = scrollPos
    }

    const interval = setInterval(scroll, 30)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="w-full overflow-hidden border-y border-white/10 bg-black py-4">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div
          ref={scrollContainer}
          className="flex gap-8 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-10 lg:gap-12"
          style={{ scrollBehavior: 'smooth' }}
        >
          {[...brands, ...brands].map((brand, index) => (
            <span
              key={`${brand}-${index}`}
              className="inline-block flex-shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75 transition hover:text-white"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BrandStrip
