import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getAnalysisList, getAnalysisById } from "@/lib/api"
import type { AnalysisDetail } from "@/lib/api"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ChevronRight } from "lucide-react"

export default function AnalysisHistoryPage() {
  const nav = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: list = [] } = useQuery({ queryKey: ["analysisList"], queryFn: () => getAnalysisList() })
  const { data: detail } = useQuery({
    queryKey: ["analysisDetail", selectedId],
    queryFn: () => getAnalysisById(selectedId!),
    enabled: !!selectedId,
  })

  const actionColor = (a?: string) => {
    if (a === "BUY") return "text-red-500"
    if (a === "SELL") return "text-green-600"
    return "text-yellow-600"
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold">分析历史</h1>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* List */}
          <div className="md:col-span-1 space-y-2">
            {list.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无分析记录</p>
            ) : (
              list.map((item) => (
                <Card
                  key={item.id}
                  className={`cursor-pointer hover:shadow-sm ${selectedId === item.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.stock_name} ({item.stock_code})</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${actionColor(item.decision?.action)}`}>
                        {item.decision?.action ?? "?"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Detail */}
          <div className="md:col-span-2">
            {!detail ? (
              <p className="text-muted-foreground">选择左侧记录查看详情</p>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {detail.stock_name} ({detail.stock_code}) —
                      <span className={actionColor(detail.decision?.action)}> {detail.decision?.action ?? "?"}</span>
                      <span className="text-muted-foreground ml-2">信心度 {detail.decision?.confidence ?? 0}%</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p>{detail.decision?.reason}</p>
                    <p className="text-xs text-muted-foreground">耗时 {detail.elapsed_seconds}s · {new Date(detail.created_at).toLocaleString()}</p>
                  </CardContent>
                </Card>

                {/* Agents */}
                {detail.agents && Object.keys(detail.agents).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(detail.agents).map(([key, a]: [string, any]) => (
                      <Card key={key}>
                        <CardHeader className="p-3 pb-1"><CardTitle className="text-xs">{a.name} — {a.badge}</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1 text-xs">{a.summary}</CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Debate */}
                {detail.debate && (detail.debate.bull || detail.debate.bear) && (
                  <div className="grid grid-cols-2 gap-2">
                    {detail.debate.bull && (
                      <Card className="border-red-200">
                        <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-red-500">看多</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1 text-xs whitespace-pre-wrap">{detail.debate.bull}</CardContent>
                      </Card>
                    )}
                    {detail.debate.bear && (
                      <Card className="border-green-200">
                        <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-green-600">看空</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1 text-xs whitespace-pre-wrap">{detail.debate.bear}</CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Risk */}
                {detail.risk && (
                  <Card>
                    <CardHeader className="p-3 pb-1"><CardTitle className="text-xs">风控 — {(detail.risk as any).risk_level}</CardTitle></CardHeader>
                    <CardContent className="p-3 pt-1 text-xs">{(detail.risk as any).summary}</CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
