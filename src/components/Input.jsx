function Input({ label, className = '', inputClassName = '', error = '', ...props }) {
  return (
    <label className={`block space-y-2 ${className}`}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          {label}
        </span>
      )}
      <input
        className={`w-full rounded-2xl border border-white/15 bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none transition duration-300 focus:border-[#c19a6b]/60 focus:ring-2 focus:ring-[#c19a6b]/20 ${inputClassName}`}
        {...props}
      />
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  )
}

export default Input
