import { Link, NavLink } from 'react-router-dom'
import clientConfig from '../config'

function Navbar({ adminMode = false, onLogout, isLoggingOut = false }) {
  const navLinkClass = ({ isActive }) =>
    `rounded-full px-2 py-1 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
      isActive
        ? 'bg-white text-black shadow-soft'
        : 'text-white/85 hover:bg-white/10 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-black/95 text-white backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap md:px-6 md:py-4">
        <Link to="/" className="inline-flex items-center gap-3">
          <img
            src={clientConfig.logoPath}
            alt={clientConfig.shopName}
            className="h-11 w-11 rounded-full border border-white/25 object-cover shadow-soft md:h-12 md:w-12"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          <div className="leading-tight">
            <p className="font-display text-sm tracking-wide text-white sm:text-lg md:text-xl">
              {clientConfig.shopName}
            </p>
            <p className="hidden text-[0.62rem] uppercase tracking-[0.18em] text-white/60 md:block">
              {clientConfig.tagline}
            </p>
          </div>
        </Link>

        <nav className="flex w-full flex-wrap items-center justify-between gap-2 overflow-x-auto sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-2 md:gap-3">
          <a
            href={clientConfig.instagramLink}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-full border border-white/30 px-2 py-1 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10 sm:w-auto sm:px-4 sm:py-2"
          >
            Instagram
          </a>

          <NavLink to="/" end className={navLinkClass}>
            Shop
          </NavLink>

          {!adminMode && (
            <NavLink to="/login" className={navLinkClass}>
              Admin
            </NavLink>
          )}

          {adminMode && (
            <>
              <NavLink to="/admin" className={navLinkClass}>
                Dashboard
              </NavLink>
              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                className="rounded-full border border-white/30 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-2 sm:text-sm"
              >
                {isLoggingOut ? 'Signing Out...' : 'Logout'}
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navbar