// Skeleton loading state for the invoices page
export default function InvoicesLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="h-9 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg hidden sm:block" />
          <div className="h-9 w-36 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-6 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 py-3">
          {[60, 80, 64, 56, 56, 52].map((w, i) => (
            <div key={i} className="h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded shrink-0" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
            <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded shrink-0" />
            <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded flex-1" />
            <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded shrink-0" />
            <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded shrink-0" />
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded shrink-0" />
            <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full shrink-0" />
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1A1A1A] border border-zinc-100 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
                <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
              <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
