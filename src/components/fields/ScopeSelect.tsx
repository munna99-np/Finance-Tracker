import { Select, SelectTrigger, SelectValue } from '../ui/select'
import * as RadixSelect from '@radix-ui/react-select'

type Props = {
  value?: 'personal' | 'work'
  onValueChange?: (v: 'personal' | 'work') => void
}

export default function ScopeSelect({ value, onValueChange }: Props) {
  return (
    <Select value={value} onValueChange={onValueChange as any}>
      <SelectTrigger>
        <SelectValue placeholder="Scope" />
      </SelectTrigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="rounded-md border bg-white shadow">
          <RadixSelect.Viewport className="p-1">
            <RadixSelect.Item value="personal" className="px-2 py-1 text-sm rounded hover:bg-muted">Personal</RadixSelect.Item>
            <RadixSelect.Item value="work" className="px-2 py-1 text-sm rounded hover:bg-muted">Work</RadixSelect.Item>
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </Select>
  )
}

