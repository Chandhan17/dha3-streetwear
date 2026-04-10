import { motion as Motion } from 'framer-motion'

const variantClasses = {
  primary: 'border border-[#c19a6b] bg-[#c19a6b] text-black hover:bg-[#d4b184] hover:border-[#d4b184]',
  secondary: 'border border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10',
  ghost: 'border border-transparent bg-transparent text-white/80 hover:bg-white/10 hover:text-white',
  danger: 'border border-red-500/40 bg-red-500/15 text-red-100 hover:bg-red-500/25 hover:border-red-500/60',
}

function Button({ type = 'button', variant = 'secondary', className = '', disabled = false, children, ...rest }) {
  return (
    <Motion.button
      type={type}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant] || variantClasses.secondary} ${className}`}
      {...rest}
    >
      {children}
    </Motion.button>
  )
}

export default Button
