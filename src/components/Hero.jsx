import clientConfig from '../config'

function Hero() {
  const hasVideo = Boolean(clientConfig.heroVideo)

  return (
    <section className="relative isolate min-h-screen w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            className="h-full w-full object-cover"
            src={clientConfig.heroVideo}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={clientConfig.heroImage}
            alt={clientConfig.brandName}
            className="h-full w-full object-contain object-center md:object-cover"
            style={{ objectPosition: clientConfig.heroImagePosition || 'center center' }}
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            decoding="async"
          />
        )}
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1200px] items-center px-4 pt-20 md:px-6 md:pt-24">
        <div className="hero-fade-in max-w-[760px] space-y-5 text-white md:space-y-7">
          <p className="w-fit border border-white/30 bg-black/20 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm">
            New Collection
          </p>
          <h1 className="heading-hero text-[3rem] font-black leading-[0.86] md:text-[5.8rem] lg:text-[7.2rem]">
            ELEVATE
            <br />
            YOUR FIT
          </h1>
          <p className="max-w-md text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80 md:text-xs">
            {clientConfig.brandName}
          </p>
        </div>
      </div>
    </section>
  )
}

export default Hero
