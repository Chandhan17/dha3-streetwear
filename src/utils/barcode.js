const L_CODES = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const G_CODES = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
const R_CODES = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

function calculateChecksum(first12) {
  const digits = String(first12).padStart(12, '0').slice(0, 12).split('').map(Number)
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}

export function normalizeEan13(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 12)}${calculateChecksum(digits.slice(0, 12))}`
  }
  const base = (digits || '890').padStart(12, '0').slice(-12)
  return `${base}${calculateChecksum(base)}`
}

export function ean13Bars(value) {
  const code = normalizeEan13(value)
  const first = Number(code[0])
  const parity = PARITY[first]
  let bits = '101'
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(code[index])
    bits += parity[index - 1] === 'L' ? L_CODES[digit] : G_CODES[digit]
  }
  bits += '01010'
  for (let index = 7; index <= 12; index += 1) bits += R_CODES[Number(code[index])]
  bits += '101'
  return { code, bits }
}

export function barcodeSvg(value, { width = 320, height = 120 } = {}) {
  const { code, bits } = ean13Bars(value)
  const barHeight = height - 30
  const moduleWidth = width / bits.length
  const bars = bits.split('').map((bit, index) => bit === '1'
    ? `<rect x="${(index * moduleWidth).toFixed(3)}" y="4" width="${Math.max(moduleWidth, 0.8).toFixed(3)}" height="${barHeight}" />`
    : '').join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcode ${code}"><rect width="100%" height="100%" fill="white"/>${bars}<text x="50%" y="${height - 6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="2">${code}</text></svg>`
}
