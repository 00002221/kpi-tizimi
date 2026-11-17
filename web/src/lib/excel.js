// Excel eksport: sheets = [{ name, rows: [{ ustun: qiymat }], widths?: [..] }]
export async function exportXlsx(filename, sheets) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}])
    const keys = Object.keys(s.rows[0] || {})
    ws['!cols'] = keys.map((k) => ({
      wch: Math.min(40, Math.max(k.length, ...s.rows.map((r) => String(r[k] ?? '').length)) + 2),
    }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx')
}
