function Loader({ label = 'Loading data...' }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#c19a6b]/30 border-t-[#c19a6b]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{label}</p>
      </div>
    </div>
  )
}

export default Loader
