import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { screenerStocks } from "@/lib/api"
import type { ScreenerResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Filter, ArrowUpDown } from "lucide-react"

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
    if (peMin) f.pe_min = +peMin; if (peMax) f.pe_max = +peMax
    if (pbMin) f.pb_min = +pbMin; if (pbMax) f.pb_max = +pbMax
    if (priceMin) f.price_min = +priceMin; if (priceMax) f.price_max = +priceMax
    setFilters(f)
  }

  const pctColor = (v: number | null) => (v == null ? "" : v > 0 ? "text-emerald-400" : "text-rose-400")
  const fmtMcap = (v: number | null) => {
    if (v == null) return "--"
    if (v >= 1e12) return (v / 1e12).toFixed(1) + "万亿"
    if (v >= 1e8) return (v / 1e8).toFixed(1) + "亿"
    return v.toFixed(0)
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(222 84% 4.9%) 0%, hsl(222 80% 7%) 100%)" }}>
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4" style={{ background: "hsl(222 84% 4.9% / 0.8)" }}>
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold tracking-tight">选股器</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-primary" />筛选条件</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1.5 block">市盈率 PE 最低</label><Input type="number" value={peMin} onChange={(e) => setPeMin(e.target.value)} className="border-white/10 bg-white/5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">市盈率 PE 最高</label><Input type="number" value={peMax} onChange={(e) => setPeMax(e.target.value)} className="border-white/10 bg-white/5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">市净率 PB 最低</label><Input type="number" value={pbMin} onChange={(e) => setPbMin(e.target.value)} className="border-white/10 bg-white/5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">市净率 PB 最高</label><Input type="number" value={pbMax} onChange={(e) => setPbMax(e.target.value)} className="border-white/10 bg-white/5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">价格最低</label><Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="border-white/10 bg-white/5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block">价格最高</label><Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="border-white/10 bg-white/5" /></div>
            </div>
            <Button className="mt-4 glow-primary" onClick={applyFilter}><ArrowUpDown className="w-4 h-4 mr-1.5" />执行筛选</Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">加载中（首次需等待约 60 秒）...</p>
        ) : results.length > 0 ? (
          <Card className="border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.03]">
                    <th className="text-left p-3 text-muted-foreground font-medium">代码</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">名称</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">价格</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">涨跌幅</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">PE</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">PB</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">量比</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">总市值</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: ScreenerResult) => (
                    <tr key={r.code} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors" onClick={() => nav(`/stock/${r.code}`)}>
                      <td className="p-3 text-muted-foreground">{r.code}</td>
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="text-right p-3 font-medium tracking-tight">{r.price?.toFixed(2) ?? "--"}</td>
                      <td className={`text-right p-3 font-medium ${pctColor(r.change_pct)}`}>{r.change_pct != null ? `${r.change_pct > 0 ? "+" : ""}${r.change_pct.toFixed(2)}%` : "--"}</td>
                      <td className="text-right p-3 text-muted-foreground">{r.pe?.toFixed(1) ?? "--"}</td>
                      <td className="text-right p-3 text-muted-foreground">{r.pb?.toFixed(2) ?? "--"}</td>
                      <td className="text-right p-3 text-muted-foreground">{r.vol_ratio?.toFixed(2) ?? "--"}</td>
                      <td className="text-right p-3 text-muted-foreground">{fmtMcap(r.mcap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : Object.keys(filters).length > 0 ? (
          <p className="text-center text-muted-foreground py-8">无匹配结果</p>
        ) : null}
      </main>
    </div>
  )
}
