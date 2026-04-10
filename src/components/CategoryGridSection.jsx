import { motion as Motion } from 'framer-motion'
import { Link } from 'react-router-dom'

function CategoryGridSection({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <Motion.section
      className="w-full bg-black py-16 text-white md:py-20"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="container-section space-y-8">
        <Motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
            Categories
          </p>
          <h2 className="heading-lg text-4xl text-white md:text-6xl">Shop By Edit</h2>
        </Motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item, index) => (
            <Motion.div
              key={item.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, scale: 1.012 }}
              className="h-full"
            >
              <Link
                to={`/category/${encodeURIComponent(item.name)}`}
                className="group surface-elevated relative isolate block min-h-[320px] overflow-hidden border border-white/15 bg-black"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                  loading="lazy"
                  decoding="async"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />

                <div className="relative flex h-full items-end p-5">
                  <div className="space-y-2">
                    <p className="w-fit border border-white/25 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/80">
                      Category
                    </p>
                    <h3 className="text-2xl font-bold uppercase tracking-[0.08em] text-white">
                      {item.name}
                    </h3>
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                      Explore Now
                    </span>
                  </div>
                </div>
              </Link>
            </Motion.div>
          ))}
        </div>
      </div>
    </Motion.section>
  )
}

export default CategoryGridSection
