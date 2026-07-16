import { ProtectTool } from "@/components/ProtectTool"
import "./index.css"

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-8">Image Protect</h1>
        <ProtectTool />
      </div>
    </main>
  )
}

export default App
