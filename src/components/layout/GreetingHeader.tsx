'use client'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface GreetingHeaderProps {
  name: string
}

export function GreetingHeader({ name }: GreetingHeaderProps) {
  return (
    <div className="mb-6 md:mb-8">
      <h1 className="text-2xl font-semibold text-black tracking-tight">
        {getGreeting()}, {name} 👋
      </h1>
    </div>
  )
}
