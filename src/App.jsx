import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PageSkeleton from './components/PageSkeleton'
import ProtectedRoute from './components/ProtectedRoute'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Admin = lazy(() => import('./pages/Admin'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const POS = lazy(() => import('./pages/POS'))
const Inventory = lazy(() => import('./pages/Inventory'))
const POSBills = lazy(() => import('./pages/POSBills'))
const ProductImport = lazy(() => import('./pages/ProductImport'))
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const ProductDetails = lazy(() => import('./pages/ProductDetails'))
const CartPage = lazy(() => import('./pages/CartPage'))

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/category/:categoryName" element={<CategoryPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/admin/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/admin/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/admin/pos/bills" element={<ProtectedRoute><POSBills /></ProtectedRoute>} />
        <Route path="/admin/products/import" element={<ProtectedRoute><ProductImport /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  )
}

export default App
