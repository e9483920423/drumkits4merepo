import { Suspense } from "react"
import AsciiWaveBackground from "@/components/ascii-wave-background"

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <Suspense fallback={<div className="min-h-screen w-full bg-black" />}>
        <AsciiWaveBackground />
      </Suspense>
      <div className="relative z-10 flex min-h-screen items-center justify-center"></div>
    </main>
  )
}
