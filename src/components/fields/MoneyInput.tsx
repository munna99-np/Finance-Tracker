import { useState, useEffect } from 'react'
import { Input } from '../ui/input'
import { parseMoney } from '../../lib/format'

type Props = {
  value?: number
  onChange?: (value: number | undefined) => void
  placeholder?: string
}

export default function MoneyInput({ value, onChange, placeholder }: Props) {
  const [display, setDisplay] = useState<string>(value?.toString() ?? '')

  useEffect(() => {
    setDisplay(value?.toString() ?? '')
  }, [value])

  return (
    <Input
      inputMode="decimal"
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const v = e.target.value
        setDisplay(v)
        const parsed = parseMoney(v)
        if (onChange) onChange(parsed ?? undefined)
      }}
    />
  )
}

