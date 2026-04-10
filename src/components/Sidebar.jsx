import { motion as Motion } from 'framer-motion'

function Sidebar({ items, activeKey, onChange, collapsed, onToggle, mobileOpen, onCloseMobile }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseMobile}
      />

      <Motion.aside
        animate={{ width: collapsed ? 84 : 248 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed left-0 top-0 z-[90] h-screen border-r border-white/10 bg-[#0a0a0a] p-3 shadow-elevated md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#111111] px-3 py-3">
            <div className={`${collapsed ? 'hidden' : 'block'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">Admin Panel</p>
              <p className="text-sm font-semibold text-white">DHA THREE</p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/15 text-white/80 transition hover:border-white/30 hover:text-white"
              aria-label="Toggle sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1.5">
            {items.map((item) => {
              const isActive = activeKey === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onChange(item.key)
                    onCloseMobile()
                  }}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-300 ${
                    isActive
                      ? 'border border-[#c19a6b]/40 bg-[#c19a6b]/15 text-[#f0ddc4]'
                      : 'border border-transparent text-white/70 hover:border-white/15 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                    {item.icon}
                  </span>
                  <span className={`${collapsed ? 'hidden' : 'inline'} text-xs font-semibold uppercase tracking-[0.16em]`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </Motion.aside>
    </>
  )
}

export default Sidebar
