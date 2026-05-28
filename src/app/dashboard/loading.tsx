import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-fade-in">
      <div className="glass-card p-6 flex flex-col items-center gap-4 border-none shadow-none bg-transparent">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Sedang menyiapkan halaman...</p>
      </div>
    </div>
  )
}
