function EmptyState({ title = 'Nothing here yet', description = 'Try changing filters or adding new data.' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] px-6 py-14 text-center shadow-soft">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">{description}</p>
    </div>
  )
}

export default EmptyState
