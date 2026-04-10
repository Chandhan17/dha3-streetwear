import { motion as Motion } from 'framer-motion'
import { Link } from 'react-router-dom'

function LookbookSection({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <section className="w-full bg-[#0b0b0b] py-16 text-white md:py-20">
      <div className="container-section space-y-8">
        <Motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
            Lookbook
          </p>
          <h2 className="heading-lg text-4xl text-white md:text-6xl">Editorial Frames</h2>
        </Motion.div>

        <div className="grid auto-rows-[200px] grid-cols-2 gap-4 md:auto-rows-[240px] md:grid-cols-4 md:gap-5">
          {items.map((item, index) => {
            const spanClass = index === 0
              ? 'col-span-2 row-span-2 md:col-span-2 md:row-span-2'
              : index === 3
                ? 'col-span-2 row-span-2 md:col-span-2 md:row-span-2'
                : 'col-span-1 row-span-1'

            const cardContent = (
              <>
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                <div className="relative flex h-full items-end p-4 md:p-5">
                  <div className="space-y-1.5">
                    <p className="w-fit border border-white/25 bg-black/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/85">
                      {item.category}
                    </p>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white md:text-base">
                      {item.title}
                    </h3>
                    {item.href ? (
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                        View Product
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                        Explore Collection
                      </span>
                    )}
                  </div>
                </div>
              </>
            )

            return (
              <Motion.article
                key={`${item.title}-${index}`}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.58, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={`${spanClass} h-full`}
              >
                {item.href ? (
                  <Link
                    to={item.href}
                    className="group surface-elevated relative isolate block h-full overflow-hidden border border-white/15 bg-black"
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <a
                    href="#shop"
                    className="group surface-elevated relative isolate block h-full overflow-hidden border border-white/15 bg-black"
                  >
                    {cardContent}
                  </a>
                )}
              </Motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default LookbookSection
