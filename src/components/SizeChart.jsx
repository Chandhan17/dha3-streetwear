const clothingChart = {
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  chest: ['36', '38', '40', '42', '44', '46'],
  length: ['25', '26', '27', '28', '29', '30'],
}

const shoesChart = {
  sizes: ['6', '7', '8', '9', '10'],
  uk: ['6', '7', '8', '9', '10'],
  footLength: ['24.5', '25.4', '26.2', '27.1', '27.9'],
}

function SizeChart({ category = '' }) {
  const isShoesCategory = String(category).toLowerCase().includes('shoe')

  return (
    <section className="luxury-panel p-5 md:p-6">
      <h2 className="font-display text-2xl text-white md:text-3xl">Size Chart</h2>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0b0b]">
        {!isShoesCategory && (
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-black/[0.04] text-black/70">
                <th className="border border-black/10 px-3 py-2">Size</th>
                {clothingChart.sizes.map((size) => (
                  <th key={size} className="border border-black/10 px-3 py-2 text-center">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black/10 px-3 py-2 font-semibold text-black/70">
                  Chest
                </td>
                {clothingChart.chest.map((value) => (
                  <td key={value} className="border border-black/10 px-3 py-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-black/10 px-3 py-2 font-semibold text-black/70">
                  Length
                </td>
                {clothingChart.length.map((value) => (
                  <td key={value} className="border border-black/10 px-3 py-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}

        {isShoesCategory && (
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-black/[0.04] text-black/70">
                <th className="border border-black/10 px-3 py-2">Size</th>
                {shoesChart.sizes.map((size) => (
                  <th key={size} className="border border-black/10 px-3 py-2 text-center">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black/10 px-3 py-2 font-semibold text-black/70">
                  UK
                </td>
                {shoesChart.uk.map((value) => (
                  <td key={value} className="border border-black/10 px-3 py-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-black/10 px-3 py-2 font-semibold text-black/70">
                  Foot Length (cm)
                </td>
                {shoesChart.footLength.map((value) => (
                  <td key={value} className="border border-black/10 px-3 py-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

export default SizeChart