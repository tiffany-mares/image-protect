import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

interface Prediction {
  index: number
  label: string
  confidence: number
}

interface ProtectResult {
  original_url: string
  protected_url: string
  job_id: string
  predictions: {
    original: Prediction
    protected: Prediction
  }
}

export function ProtectTool() {
  const [file, setFile] = useState<File | null>(null)
  const [epsilon, setEpsilon] = useState<number>(0.02)
  const [result, setResult] = useState<ProtectResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setResult(null)
    setError(null)
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("epsilon", String(epsilon))

      const apiUrl = import.meta.env.VITE_API_URL as string
      const response = await fetch(`${apiUrl}/protect`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Server error ${response.status}: ${text}`)
      }

      const data: ProtectResult = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  function formatConfidence(confidence: number) {
    return (confidence * 100).toFixed(1)
  }

  function formatBadge(pred: Prediction) {
    return `${pred.label} (${pred.index}) — ${formatConfidence(pred.confidence)}%`
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* File upload zone */}
      <Card
        className="cursor-pointer border-dashed hover:bg-muted/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="flex items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">
            {file ? file.name : "Click to select an image"}
          </p>
        </CardContent>
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Epsilon slider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Perturbation strength (ε): <span className="font-mono">{epsilon.toFixed(3)}</span>
        </label>
        <Slider
          min={0.005}
          max={0.04}
          step={0.005}
          value={[epsilon]}
          onValueChange={([val]) => setEpsilon(val)}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0.005 (subtle)</span>
          <span>0.040 (strong)</span>
        </div>
      </div>

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="w-full"
      >
        {loading ? "Protecting…" : "Protect Image"}
      </Button>

      {/* Error state */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Result panel */}
      {result && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Original</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <img
                src={result.original_url}
                alt="Original"
                className="w-full rounded"
              />
              <Badge variant="secondary" className="w-full justify-center text-center">
                {formatBadge(result.predictions.original)}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Protected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <img
                src={result.protected_url}
                alt="Protected"
                className="w-full rounded"
              />
              <Badge variant="secondary" className="w-full justify-center text-center">
                {formatBadge(result.predictions.protected)}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
