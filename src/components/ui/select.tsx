import * as RadixSelect from '@radix-ui/react-select'
import { cn } from '../../lib/utils'

export function SelectRoot({ children, ...props }: RadixSelect.SelectProps) {
  return <RadixSelect.Root {...props}>{children}</RadixSelect.Root>
}

export function SelectTrigger({ className, ...props }: RadixSelect.SelectTriggerProps) {
  return (
    <RadixSelect.Trigger
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none',
        className
      )}
      {...props}
    />
  )
}

export const SelectValue = RadixSelect.Value
export const SelectContent = RadixSelect.Content
export const SelectItem = RadixSelect.Item
export const SelectGroup = RadixSelect.Group
export const SelectViewport = RadixSelect.Viewport
export const Select = SelectRoot
