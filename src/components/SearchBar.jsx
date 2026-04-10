function SearchBar({ value, onChange, totalResults }) {
  return (
    <section className="luxury-panel p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="font-display text-xl text-white md:text-2xl">Search</h3>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          {totalResults} Result{totalResults === 1 ? '' : 's'}
        </p>
      </div>

      <div className="relative mt-3">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>

        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search products..."
          className="w-full rounded-2xl border border-white/15 bg-black/55 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/35 focus:shadow-soft"
        />
      </div>
    </section>
  )
}

export default SearchBar