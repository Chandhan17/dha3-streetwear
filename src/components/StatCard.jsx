import { motion as Motion } from 'framer-motion'

function StatCard({ title, value, icon, hint }) {
  return (
    <Motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#c19a6b]/30 bg-[#c19a6b]/15 text-[#f0ddc4]">
          {icon}
        </div>
      </div>
    </Motion.article>
  )
}

export default StatCard
