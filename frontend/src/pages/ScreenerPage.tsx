import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { screenerStocks } from "@/lib/api"
import type { ScreenerResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Filter } from "lucide-react"

export default function ScreenerPage() {
  const nav = useNavigate()
  const [peMin, setPeMin] = useState("")
  const [peMax, setPeMax] = useState("")
  const [pbMin, setPbMin] = useState("")
  const [pbMax, setPbMax] = useState("")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [filters, setFilters] = useState<Record<string, number>>({})

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["screener", filters],
    queryFn: () => screenerStocks(filters),
    enabled: Object.keys(filters).length > 0,
  })

  const applyFilter = () => {
    const f: Record<string, number> = {}
    if (peMin) f.pe_min = +peMin
    if (peMax) f.pe_max = +peMax
    if (pbMin) f.pb_min = +pbMin
    if (pbMax) f.pb_max = +pbMax
    if (priceMin) f.price_min = +priceMin
    if (priceMax) f.price_max = +priceMax
    setFilters(f)
  }

  const pctColor = (v: number | null) => {
    if (v == null) return ""
    return v > 0 ? "text-red-500" : v < 0 ? "text-green-600" : ""
  }

  const fmtMcap = (v: number | null) => {
    if (v == null) return "--"
    if (v >= 1e12) return (v / 1e12).toFixed(1) + "万亿"
    if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿"
    return v.toFixed(0)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold">选股器</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="w-4 h-4" />筛选条件</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground">PE 最小</label><Input type="number" value={peMin} onChange={(e) => setPeMin(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">PE 最大</label><Input type="number" value={peMax} onChange={(e) => setPeMax(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">PB 最小</label><Input type="number" value={pbMin} onChange={(e) => setPbMin(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">PB 最大</label><Input type="number" value={pbMax} onChange={(e) => setPbMax(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">价格最小</label><Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">价格最大</label><Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} /></div>
            </div>
            <Button className="mt-4" onClick={applyFilter}>筛选</Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : results.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3">代码</th>
                    <th className="text-left p-3">名称</th>
                    <th className="text-right p-3">价格</th>
                    <th className="text-right p-3">涨跌幅</th>
                    <th className="text-right p-3">PE</th>
                    <th className="text-right p-3">PB</th>
                    <th className="text-right p-3">量比</th>
                    <th className="text-right p-3">总市值</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: ScreenerResult) => (
                    <tr key={r.code} className="border-b hover:bg-accent cursor-pointer" onClick={() => nav(`/stock/${r.code}`)}>
                      <td className="p-3">{r.code}</td>
                      <td className="p-3">{r.name}</td>
                      <td className="text-right p-3">{r.price?.toFixed(2) ?? "--"}</td>
                      <td className={`text-right p-3 ${pctColor(r.change_pct)}`}>{r.change_pct != null ? `${r.change_pct > 0 ? "+" : ""}${r.change_pct.toFixed(2)}%` : "--"}</td>
                      <td className="text-right p-3">{r.pe?.toFixed(1) ?? "--"}</td>
                      <td className="text-right p-3">{r.pb?.toFixed(2) ?? "--"}</td>
                      <td className="text-right p-3">{r.vol_ratio?.toFixed(2) ?? "--"}</td>
                      <td className="text-right p-3">{fmtMcap(r.mcap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : Object.keys(filters).length > 0 ? (
          <p className="text-muted-foreground">无匹配结果</p>
        ) : null}
      </main>
    </div>
  )
}
