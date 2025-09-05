export function formatCurrency(value: number, currency?: string, locale?: string) {
  try {
    const cur = currency || (typeof localStorage !== 'undefined' ? localStorage.getItem('app_currency') || 'INR' : 'INR')
    const loc = locale || (typeof localStorage !== 'undefined' ? localStorage.getItem('app_locale') || 'en-IN' : 'en-IN')
    return new Intl.NumberFormat(loc, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(value)
  } catch {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
  }
}

export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}
