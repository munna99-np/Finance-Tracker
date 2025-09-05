import { describe, it, expect } from 'vitest'
import { formatCurrency, parseMoney } from './format'

describe('formatCurrency', () => {
  it('formats INR by default', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50')
  })
})

describe('parseMoney', () => {
  it('parses common cases', () => {
    expect(parseMoney('1,234.50')).toBe(1234.5)
    expect(parseMoney('₹ 2,000')).toBe(2000)
    expect(parseMoney('-300')).toBe(-300)
  })
  it('returns null for invalid', () => {
    expect(parseMoney('abc')).toBeNull()
  })
})

