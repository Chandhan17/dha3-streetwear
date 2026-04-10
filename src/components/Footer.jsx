import clientConfig from '../config'

function Footer() {
  const currentYear = new Date().getFullYear()
  const sanitizedPhone = String(clientConfig.phone || '').replace(/\D/g, '')
  const sanitizedWhatsapp = String(clientConfig.whatsapp || clientConfig.whatsappNumber || '').replace(
    /\D/g,
    '',
  )
  const hasPhone = Boolean(sanitizedPhone)
  const hasWhatsapp = Boolean(sanitizedWhatsapp)

  return (
    <footer className="mt-14 border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr] md:px-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={clientConfig.logoPath}
              alt={clientConfig.brandName}
              className="h-12 w-12 rounded-full border border-white/25 object-cover"
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
            <div>
              <p className="font-display text-2xl">{clientConfig.brandName}</p>
              <p className="text-sm text-white/70">{clientConfig.tagline}</p>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-white/75">
            {clientConfig.address}
          </p>
        </div>

        <div className="space-y-3 text-sm text-white/80 md:justify-self-end md:text-right">
          <p>
            Call:{' '}
            {hasPhone ? (
              <a href={`tel:${sanitizedPhone}`} className="text-white hover:text-accent">
                {clientConfig.phone}
              </a>
            ) : (
              <span className="text-white/60">Not configured</span>
            )}
          </p>
          <p>
            WhatsApp:{' '}
            {hasWhatsapp ? (
              <a
                href={`https://wa.me/${sanitizedWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-[#25D366]"
              >
                {clientConfig.whatsapp || clientConfig.whatsappNumber}
              </a>
            ) : (
              <span className="text-white/60">Not configured</span>
            )}
          </p>
          <p>
            Instagram:{' '}
            <a
              href={clientConfig.instagramLink}
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-accent"
            >
              dha3.streetwear
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/55">
        Copyright {currentYear} {clientConfig.brandName}. All rights reserved.
      </div>
    </footer>
  )
}

export default Footer