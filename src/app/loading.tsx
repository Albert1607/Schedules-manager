import { Loader2 } from 'lucide-react'

export default function RootLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-background animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    </div>
  )
}
