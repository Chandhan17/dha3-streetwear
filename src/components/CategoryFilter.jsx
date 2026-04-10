function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}) {
  const filterOptions = ['All', ...categories]

  return (
    <section className="luxury-panel p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-white md:text-2xl">Categories</h3>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          {selectedCategory === 'All' ? 'All Products' : selectedCategory}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterOptions.map((option) => {
          const isActive = selectedCategory === option

          return (
            <button
              type="button"
              key={option}
              onClick={() => onSelectCategory(option)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition duration-300 ${
                isActive
                  ? 'border-obsidian bg-obsidian text-white shadow-soft'
                  : 'border-white/10 bg-white/5 text-white/75 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default CategoryFilter