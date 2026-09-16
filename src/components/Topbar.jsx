import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button'

function Topbar({
  title,
  onLogout,
  onOpenMobileSidebar,
  isLoggingOut = false,
}) {
  const initials = useMemo(() => 'AD', [])

  return (
    <header className="sticky top-0 z-[70] border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 text-white/75 transition hover:border-white/30 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Control Center</p>
            <h1 className="text-lg font-semibold text-white md:text-xl">{title}</h1>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#c19a6b]/40 bg-[#c19a6b]/15 text-xs font-semibold tracking-[0.12em] text-[#f0ddc4]">
            {initials}
          </div>

          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/20 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 transition duration-300 hover:border-white/35 hover:bg-white/10 hover:text-white"
          >
            Back to Shop
          </Link>

          <Button
            variant="danger"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="h-10 px-4 py-0"
          >
            {isLoggingOut ? 'Logging Out' : 'Logout'}
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Topbar
