import { AnimatePresence, motion as Motion } from 'framer-motion'

function Modal({ open, title, children, onClose, footer = null, maxWidth = 'max-w-3xl' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <Motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className={`w-full ${maxWidth} overflow-hidden rounded-2xl border border-white/15 bg-[#111111] shadow-elevated`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 px-2.5 py-1 text-xs text-white/80 transition hover:border-white/30 hover:text-white"
                  aria-label="Close modal"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[70vh] overflow-auto p-5">{children}</div>

              {footer && <div className="border-t border-white/10 px-5 py-4">{footer}</div>}
            </Motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Modal
