// Skeleton loading state for the dashboard page
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Greeting */}
      <div className="mb-6">
        <div className="h-7 w-52 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
        <div className="h-4 w-80 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[100, 112, 104, 110].map((w, i) => (
          <div key={i} className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg" style={{ width: w }} />
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-2.5 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="w-7 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-1.5" />
            <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        ))}
      </div>

      {/* Activity + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
            <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
            <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-64 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
                  <div className="h-2.5 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-zinc-50 dark:border-zinc-800">
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-2.5 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-zinc-50 dark:border-zinc-800">
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-2.5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
