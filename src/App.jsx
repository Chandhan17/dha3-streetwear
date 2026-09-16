import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PageSkeleton from './components/PageSkeleton'
import ProtectedRoute from './components/ProtectedRoute'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Admin = lazy(() => import('./pages/Admin'))
const POS = lazy(() => import('./pages/POS'))
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
        <Route path="/admin/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  )
}

export default App
