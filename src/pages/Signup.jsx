import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { signupUser } from '../services/authService'

function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail || !password.trim()) {
      setStatus({
        type: 'error',
        message: 'Please fill name, email, and password.',
      })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      await signupUser({
        name: trimmedName,
        email: trimmedEmail,
        password,
      })

      navigate('/', { replace: true })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Signup failed. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-7xl place-items-center px-4 py-8 md:px-8">
        <section className="luxury-panel w-full max-w-md p-6 md:p-8">
          <div className="mb-6 text-center">
            <p className="chip mx-auto w-fit">Create Account</p>
            <h1 className="mt-4 font-display text-3xl text-white">Join DHA THREE</h1>
            <p className="mt-2 text-sm text-white/65">
              Sign up to save orders and shop faster.
            </p>
          </div>

          {status.message && (
            <div
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label htmlFor="name" className="text-sm font-semibold text-obsidian">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="email" className="text-sm font-semibold text-obsidian">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="password" className="text-sm font-semibold text-obsidian">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-obsidian"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-obsidian px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-white/65">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-white underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default Signup
