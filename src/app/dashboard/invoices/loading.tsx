// Skeleton loading state for the invoices page
export default function InvoicesLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="h-7 w-24 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-zinc-100 rounded" />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="h-9 w-28 bg-zinc-200 rounded-lg hidden sm:block" />
          <div className="h-9 w-36 bg-zinc-200 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="hidden sm:block bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-6 bg-zinc-50 border-b border-zinc-100 px-6 py-3">
          {[60, 80, 64, 56, 56, 52].map((w, i) => (
            <div key={i} className="h-2.5 bg-zinc-200 rounded shrink-0" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-zinc-50 last:border-0">
            <div className="h-4 w-16 bg-zinc-100 rounded shrink-0" />
            <div className="h-4 w-32 bg-zinc-200 rounded flex-1" />
            <div className="h-4 w-20 bg-zinc-100 rounded shrink-0" />
            <div className="h-4 w-20 bg-zinc-100 rounded shrink-0" />
            <div className="h-4 w-16 bg-zinc-200 rounded shrink-0" />
            <div className="h-5 w-16 bg-zinc-100 rounded-full shrink-0" />
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-zinc-100 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-zinc-200 rounded" />
                <div className="h-3 w-24 bg-zinc-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-zinc-100 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 bg-zinc-100 rounded" />
              <div className="h-5 w-20 bg-zinc-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
