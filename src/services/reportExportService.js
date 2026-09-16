import * as XLSX from 'xlsx'

function safeSheetName(name) {
  return String(name || 'Report').replace(/[\\/?*:[\]]/g, '').slice(0, 31) || 'Report'
}

export function downloadExcelReport({ filename, sheetName, rows = [], columns = [] }) {
  const data = rows.map((row) => {
    const output = {}
    columns.forEach(({ key, label }) => { output[label] = row?.[key] ?? '' })
    return output
  })
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName))
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function downloadSingleRowExcelReport({ filename, sheetName, rows, columns }) {
  downloadExcelReport({ filename, sheetName, rows, columns })
}
