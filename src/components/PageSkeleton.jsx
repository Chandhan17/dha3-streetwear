function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black px-4 pt-24 md:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        <div className="h-10 w-52 animate-pulse rounded bg-white/10" />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PageSkeleton
