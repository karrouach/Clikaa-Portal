'use client'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface GreetingHeaderProps {
  name: string
  subtitle?: string
}

export function GreetingHeader({ name, subtitle }: GreetingHeaderProps) {
  const firstName = name.split(' ')[0]
  return (
    <div className="mb-4 md:mb-6">
      <h1 className="text-xl md:text-2xl font-semibold text-black tracking-tight">
        {getGreeting()}, {firstName} 👋
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      )}
    </div>
  )
}
