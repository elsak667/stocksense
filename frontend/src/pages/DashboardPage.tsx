import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDashboard, addToWatchlist, removeFromWatchlist, searchStocks } from "@/lib/api"
import type { WatchlistQuote } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Check, SlidersHorizontal, History, LogOut } from "lucide-react"

export default function DashboardPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [sq, setSq] = useState("")
  const [sr, setSr] = useState<{ code: string; name: string }[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const { data: watchlist = [] } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })

  const addMut = useMutation({
    mutationFn: (code: string) => addToWatchlist(code),
    onSuccess: (newItem) => {
      qc.setQueryData<WatchlistQuote[]>(["dashboard"], (old) =>
        old ? [...old, { id: newItem.id, stock_code: newItem.stock_code, stock_name: newItem.stock_name, market: newItem.market, note: newItem.note, price: null, change_pct: null }] : old,
      )
      setSq("")
      setShowDrop(false)
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: number) => removeFromWatchlist(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<WatchlistQuote[]>(["dashboard"], (old) => old?.filter((w) => w.id !== id))
    },
  })

  useEffect(() => {
    if (sq.length < 1) { setSr([]); return }
    const timer = setTimeout(async () => {
      try { const r = await searchStocks(sq); setSr(r.slice(0, 8)); setShowDrop(true) } catch { /* */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [sq])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const inWatch = new Set(watchlist.map((w) => w.stock_code))
  const pctColor = (v: number | null) => (v == null ? "" : v > 0 ? "text-emerald-400" : "text-rose-400")

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(222 84% 4.9%) 0%, hsl(222 80% 7%) 100%)" }}>
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between" style={{ background: "hsl(222 84% 4.9% / 0.8)" }}>
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-primary">Stock</span>Sense
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav("/screener")}><SlidersHorizontal className="w-4 h-4 mr-1.5" />选股</Button>
          <Button variant="ghost" size="sm" onClick={() => nav("/history")}><History className="w-4 h-4 mr-1.5" />记录</Button>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("token"); nav("/login") }}><LogOut className="w-4 h-4 mr-1.5" />退出</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="relative max-w-md" ref={dropRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input placeholder="搜索股票名称或代码" value={sq} onChange={(e) => setSq(e.target.value)} className="pl-9 border-white/10 focus:border-primary/50 bg-white/5" />
          {showDrop && sr.length > 0 && (
            <div className="absolute z-20 top-full mt-1.5 w-full rounded-lg border border-white/10 bg-card shadow-xl overflow-hidden">
              {sr.map((s) => (
                <div key={s.code} className="flex items-center px-4 py-2.5 hover:bg-white/5 transition-colors">
                  <button className="flex-1 text-left" onClick={() => { nav(`/stock/${s.code}`); setShowDrop(false); setSq("") }}>
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{s.code}</span>
                  </button>
                  {inWatch.has(s.code) ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => addMut.mutate(s.code)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">自选股</h2>
          <span className="text-xs text-muted-foreground">{watchlist.length} 只</span>
        </div>

        {watchlist.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">暂无自选股，搜索并添加</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {watchlist.map((w) => (
              <Card key={w.id} className="cursor-pointer hover:border-white/20 transition-all duration-200 border-white/5 bg-white/[0.03]" onClick={() => nav(`/stock/${w.stock_code}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{w.stock_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{w.stock_code}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 -mr-1 -mt-1 text-muted-foreground hover:text-rose-400" onClick={(e) => { e.stopPropagation(); removeMut.mutate(w.id) }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-xl font-bold tracking-tight">{w.price?.toFixed(2) ?? "--"}</span>
                    {w.change_pct != null && (
                      <span className={`text-sm font-medium flex items-center ${pctColor(w.change_pct)}`}>
                        {w.change_pct > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                        {w.change_pct > 0 ? "+" : ""}{w.change_pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
