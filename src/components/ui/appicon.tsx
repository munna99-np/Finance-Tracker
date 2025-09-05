import * as React from 'react'

type Props = {
  name: string
  size?: number
  className?: string
  title?: string
  fallback?: React.ReactNode
}

// Renders an image-based icon from public/icons/<name>.svg (or .png)
// Falls back to provided React node if the file is missing.
export function AppIcon({ name, size = 18, className, title, fallback }: Props) {
  const [failed, setFailed] = React.useState(false)
  const srcSvg = `/icons/${name}.svg`
  const srcPng = `/icons/${name}.png`

  if (failed && fallback) return <>{fallback}</>

  return (
    <img
      src={srcSvg}
      onError={(e) => {
        // Try PNG next; if that also fails, use fallback
        const img = e.currentTarget as HTMLImageElement
        if (!img.dataset.triedPng) {
          img.dataset.triedPng = '1'
          img.src = srcPng
        } else {
          setFailed(true)
        }
      }}
      width={size}
      height={size}
      alt={title ?? name}
      className={className}
      title={title}
    />
  )
}

