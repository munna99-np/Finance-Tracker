export function toCsv<T extends Record<string, any>>(rows: T[], headers: string[]): string {
  const header = headers.join(',')
  const escape = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = rows.map((r) => headers.map((h) => escape(r[h])).join(','))
  return [header, ...lines].join('\n')
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

