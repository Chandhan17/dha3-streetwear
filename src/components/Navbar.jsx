import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import clientConfig from '../config'
import { useCart } from '../context/CartContext'

function Navbar({
  adminMode = false,
  onLogout,
  isLoggingOut = false,
  overlay = false,
  searchQuery = '',
  onSearchChange,
}) {
  const { cartCount } = useCart()
  const { pathname } = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      setIsScrolled(currentScrollY > 10)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    // Close mobile menu on route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMenuOpen(false)
  }, [pathname])

  const handleBrandClick = () => {
    if (typeof onSearchChange === 'function') {
      onSearchChange('')
    }

    setIsMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navLinks = [
    { label: 'Shop', href: '/#shop' },
    { label: 'New', href: '/?view=new#shop' },
    { label: 'Collections', href: '/#shop' },
    { label: 'Sale', href: '/?view=sale#shop' },
  ]

  const wrapperClass = overlay
    ? 'absolute inset-x-0 top-0 z-[70] bg-white'
    : 'fixed inset-x-0 top-0 z-[70] bg-white'

  const shellClass = 'w-full translate-y-0'

  const barClass = `transition-all duration-300 ${
    isScrolled || overlay
      ? 'border border-black/15 bg-white/95 text-black backdrop-blur-xl'
      : 'border border-black/10 bg-white/90 text-black backdrop-blur-lg'
  }`

  return (
    <header className={wrapperClass}>
      <div className={`${shellClass} transform transition-transform duration-300`}>
        <div className={`surface-elevated relative ${barClass}`}>
          <div className="flex items-center justify-between px-4 py-3 md:py-3.5">
            <Link to="/" onClick={handleBrandClick} className="inline-flex flex-shrink-0 items-center gap-3">
              <img
                src={clientConfig.logoPath}
                alt={clientConfig.brandName}
                className="h-8 w-8 rounded-full border border-black/20 object-cover md:h-9 md:w-9"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div className="leading-none">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-black sm:text-xs">
                  {clientConfig.brandName}
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/75 transition hover:text-black hover:tracking-[0.24em]"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <nav className="flex items-center gap-1.5 md:gap-2">
              {typeof onSearchChange === 'function' ? (
                <div className="relative hidden md:block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/45">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search products"
                    className="h-8 w-44 rounded-full border border-black/15 bg-white px-3 pl-9 text-xs text-black outline-none transition focus:border-black/35"
                  />
                </div>
              ) : (
                <button type="button" aria-label="Search" className="interactive-lift grid h-8 w-8 place-items-center text-black/70 transition hover:text-black">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}

              <Link to="/cart" className="interactive-lift relative grid h-8 w-8 place-items-center text-black/80 transition hover:text-black" aria-label="Cart">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-0.5 text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {!adminMode && (
                <NavLink to="/login" className="interactive-lift hidden md:grid h-8 w-8 place-items-center text-black/70 transition hover:text-black" aria-label="Admin">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em]">A</span>
                </NavLink>
              )}

              {adminMode && (
                <>
                  <NavLink to="/admin" className="interactive-lift grid h-8 w-8 place-items-center text-black/70 transition hover:text-black" aria-label="Dashboard">
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em]">D</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={isLoggingOut}
                    aria-label="Logout"
                    className="interactive-lift grid h-8 w-8 place-items-center text-black/70 transition hover:text-black disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Out</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                className="interactive-lift grid h-8 w-8 place-items-center text-black/70 transition hover:text-black md:hidden"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </nav>
          </div>

          <div
            className={`overflow-hidden border-t border-black/10 px-4 transition-all duration-300 md:hidden ${
              isMenuOpen ? 'max-h-72 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'
            }`}
          >
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <a
                  key={`mobile-${link.label}`}
                  href={link.href}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/75 transition hover:text-black"
                >
                  {link.label}
                </a>
              ))}

              {!adminMode && (
                <NavLink
                  to="/login"
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/75 transition hover:text-black"
                >
                  Admin Login
                </NavLink>
              )}

              {adminMode && (
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className="w-fit border border-black/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar