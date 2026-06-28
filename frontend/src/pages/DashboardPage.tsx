import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDashboard, addToWatchlist, removeFromWatchlist, searchStocks } from "@/lib/api"
import type { WatchlistQuote } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Plus, Trash2, TrendingUp, TrendingDown, Check } from "lucide-react"

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
  const pctColor = (v: number | null) => (v == null ? "" : v > 0 ? "text-red-500" : v < 0 ? "text-green-600" : "")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">StockSense</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => nav("/screener")}>选股</Button>
          <Button variant="outline" size="sm" onClick={() => nav("/history")}>历史</Button>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("token"); nav("/login") }}>退出</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="relative max-w-md" ref={dropRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜索股票名称/代码，点击 + 加入自选" value={sq} onChange={(e) => setSq(e.target.value)} className="pl-9" />
          {showDrop && sr.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-lg">
              {sr.map((s) => (
                <div key={s.code} className="flex items-center px-4 py-2 hover:bg-accent">
                  <button className="flex-1 text-left" onClick={() => { nav(`/stock/${s.code}`); setShowDrop(false); setSq("") }}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">{s.code}</span>
                  </button>
                  {inWatch.has(s.code) ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Button variant="ghost" size="icon" onClick={() => addMut.mutate(s.code)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <h2 className="text-lg font-semibold">自选股</h2>
        {watchlist.length === 0 ? (
          <p className="text-muted-foreground">暂无自选股，搜索并添加</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {watchlist.map((w) => (
              <Card key={w.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav(`/stock/${w.stock_code}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{w.stock_name}</p>
                      <p className="text-xs text-muted-foreground">{w.stock_code} · {w.market}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeMut.mutate(w.id) }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-xl font-bold">{w.price?.toFixed(2) ?? "--"}</span>
                    {w.change_pct != null && (
                      <span className={`text-sm flex items-center ${pctColor(w.change_pct)}`}>
                        {w.change_pct > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : w.change_pct < 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> : null}
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
