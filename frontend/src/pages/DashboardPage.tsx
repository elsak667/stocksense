import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDashboard, addToWatchlist, removeFromWatchlist, searchStocks } from "@/lib/api"
import type { WatchlistQuote, SearchResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react"

export default function DashboardPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [addCode, setAddCode] = useState("")

  const { data: watchlist = [], isLoading } = useQuery({
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
      setAddCode("")
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: number) => removeFromWatchlist(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<WatchlistQuote[]>(["dashboard"], (old) => old?.filter((w) => w.id !== id))
    },
  })

  const doSearch = async () => {
    if (!searchQ.trim()) return
    const results = await searchStocks(searchQ)
    setSearchResults(results)
  }

  const pctColor = (v: number | null) => {
    if (v == null) return ""
    return v > 0 ? "text-red-500" : v < 0 ? "text-green-600" : ""
  }

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
        {/* 搜索 */}
        <div className="flex gap-2">
          <Input placeholder="搜索股票代码/名称" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
          <Button onClick={doSearch}><Search className="w-4 h-4" /></Button>
        </div>
        {searchResults.length > 0 && (
          <Card>
            <CardContent className="p-2">
              {searchResults.map((s) => (
                <div key={s.code} className="flex items-center justify-between px-3 py-2 hover:bg-accent rounded cursor-pointer" onClick={() => nav(`/stock/${s.code}`)}>
                  <span>{s.name} ({s.code})</span>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); addMut.mutate(s.code) }}><Plus className="w-3 h-3" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 添加自选 */}
        <div className="flex gap-2">
          <Input placeholder="输入股票代码加入自选" value={addCode} onChange={(e) => setAddCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCode.trim() && addMut.mutate(addCode.trim())} />
          <Button onClick={() => addCode.trim() && addMut.mutate(addCode.trim())} disabled={addMut.isPending}>添加自选</Button>
        </div>

        {/* 自选股列表 */}
        <h2 className="text-lg font-semibold">自选股</h2>
        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : watchlist.length === 0 ? (
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
