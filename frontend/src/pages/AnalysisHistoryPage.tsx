import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getAnalysisList, getAnalysisById } from "@/lib/api"
import type { AnalysisDetail, AnalysisListItem } from "@/lib/api"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function AnalysisHistoryPage() {
  const nav = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: list = [] } = useQuery({ queryKey: ["analysisList"], queryFn: () => getAnalysisList() })
  const { data: detail } = useQuery({
    queryKey: ["analysisDetail", selectedId],
    queryFn: () => getAnalysisById(selectedId!),
    enabled: !!selectedId,
  })

  const decisionBadge = (action?: string, confidence?: number) => {
    const a = action || "?"
    const isBuy = a === "BUY" || a === "买入"
    const isSell = a === "SELL" || a === "卖出"
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuy ? "bg-rose-500/20 text-rose-400" : isSell ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-muted-foreground"}`}>
        {isBuy ? "买入" : isSell ? "卖出" : a} {confidence ?? 0}%
      </span>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(222 84% 4.9%) 0%, hsl(222 80% 7%) 100%)" }}>
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4" style={{ background: "hsl(222 84% 4.9% / 0.8)" }}>
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold tracking-tight">分析历史</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-2">
            {list.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">暂无分析记录</p>
            ) : (
              list.map((item: AnalysisListItem) => (
                <Card key={item.id} className={`cursor-pointer transition-all border-white/5 bg-white/[0.02] ${selectedId === item.id ? "ring-1 ring-primary border-primary/30" : "hover:border-white/20"}`} onClick={() => setSelectedId(item.id)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.stock_name} <span className="text-muted-foreground font-normal">{item.stock_code}</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(item.created_at).toLocaleString("zh-CN")}</p>
                    </div>
                    {decisionBadge(item.decision?.action, item.decision?.confidence)}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            {detail ? (
              <>
                <Card className="border-white/5 bg-white/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-3">
                      {detail.stock_name} <span className="text-muted-foreground font-normal">{detail.stock_code}</span>
                      {decisionBadge(detail.decision?.action, detail.decision?.confidence)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <p className="text-foreground/80 leading-relaxed">{detail.decision?.reason}</p>
                    <p className="text-xs text-muted-foreground">耗时 {detail.elapsed_seconds}s · {new Date(detail.created_at).toLocaleString("zh-CN")}</p>
                  </CardContent>
                </Card>

                {detail.agents && Object.keys(detail.agents).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(detail.agents).map(([key, a]) => {
                      const agent = a as { name?: string; badge?: string; summary?: string }
                      return (
                        <Card key={key} className="border-white/5 bg-white/[0.02]">
                          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs"><span className="text-primary">{agent.name}</span><span className="text-muted-foreground ml-1.5">{agent.badge}</span></CardTitle></CardHeader>
                          <CardContent className="p-3 pt-1 text-xs text-muted-foreground">{agent.summary}</CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {detail.debate && (detail.debate.bull || detail.debate.bear) && (
                  <div className="grid grid-cols-2 gap-2">
                    {detail.debate.bull && (
                      <Card className="border-l-2 border-l-rose-400/40 bg-white/[0.02]">
                        <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-rose-400">看多</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground whitespace-pre-wrap">{detail.debate.bull}</CardContent>
                      </Card>
                    )}
                    {detail.debate.bear && (
                      <Card className="border-l-2 border-l-emerald-400/40 bg-white/[0.02]">
                        <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-emerald-400">看空</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1 text-xs text-muted-foreground whitespace-pre-wrap">{detail.debate.bear}</CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {detail.risk && (
                  <Card className="border-white/5 bg-white/[0.02]">
                    <CardHeader className="p-3 pb-1"><CardTitle className="text-xs flex items-center gap-2">风控 <span className={`px-2 py-0.5 rounded text-xs ${(detail.risk as any).risk_level === "高" || (detail.risk as any).risk_level === "high" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>{(detail.risk as any).risk_level}</span></CardTitle></CardHeader>
                    <CardContent className="p-3 pt-1 text-xs text-muted-foreground">{(detail.risk as any).summary}</CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground text-sm">选择左侧记录查看详情</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
