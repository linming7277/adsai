export function toCSV(rows: any[], headers?: string[]): string {
  if (!rows || rows.length === 0) return ''
  const keys = headers && headers.length ? headers : Array.from(new Set(rows.flatMap(r => Object.keys(r || {}))))
  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = [keys.join(',')]
  for (const r of rows) {
    lines.push(keys.map(k => escape((r as any)[k])).join(','))
  }
  return lines.join('\n')
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

