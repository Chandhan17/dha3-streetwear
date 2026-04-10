const toneClasses = {
  default: 'border-white/15 bg-white/8 text-white/80',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  danger: 'border-red-500/30 bg-red-500/15 text-red-200',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
  accent: 'border-[#c19a6b]/40 bg-[#c19a6b]/15 text-[#f0ddc4]',
}

function Badge({ tone = 'default', className = '', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClasses[tone] || toneClasses.default} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
