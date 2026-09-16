import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AdminLayout({ activeKey, onChangeKey, title, query, onQueryChange, onLogout, isLoggingOut = false, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const menuItems = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l9-9 9 9" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 21V9h6v12" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: 'pos', label: 'POS Billing', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h4M15 13h2" strokeLinecap="round" /></svg> },
    { key: 'posBills', label: 'POS Bill Book', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" strokeLinecap="round" /></svg> },
    { key: 'inventory', label: 'Inventory', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16v13H4z" /><path d="M8 7V4h8v3M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: 'products', label: 'Products', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: 'orders', label: 'Orders', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7h13M8 12h13M8 17h13M3 7h.01M3 12h.01M3 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: 'analytics', label: 'Reports & Analytics', icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 17l4-6 4 3 4-8" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  ], [])

  const routeMap = {
    dashboard: '/admin/dashboard',
    pos: '/admin/pos',
    posBills: '/admin/pos/bills',
    inventory: '/admin/inventory',
    products: '/admin/products',
    orders: '/admin/orders',
    analytics: '/admin/reports',
  }

  const handleMenuChange = (key) => {
    const destination = routeMap[key]
    if (destination) {
      navigate(destination)
      return
    }
    onChangeKey?.(key)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Sidebar items={menuItems} activeKey={activeKey} onChange={handleMenuChange} collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className={`min-h-screen transition-all duration-300 ${collapsed ? 'md:pl-[84px]' : 'md:pl-[248px]'}`}>
        <Topbar title={title} query={query} onQueryChange={onQueryChange} onLogout={onLogout} onOpenMobileSidebar={() => setMobileOpen(true)} isLoggingOut={isLoggingOut} />
        <Motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="p-4 md:p-6">{children}</Motion.main>
      </div>
    </div>
  )
}

export default AdminLayout
