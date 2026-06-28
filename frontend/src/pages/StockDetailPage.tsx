import { useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { getQuote, getKlines, runAnalysisStream, getAnalysisHistory } from "@/lib/api"
import type { SSEEvent, AnalysisDetail, AnalysisListItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Play, Loader2 } from "lucide-react"

export default function StockDetailPage() {
  const { code } = useParams<{ code: string }>()
  const nav = useNavigate()
  const [analysisLog, setAnalysisLog] = useState<string[]>([])
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: quote } = useQuery({ queryKey: ["quote", code], queryFn: () => getQuote(code!), enabled: !!code })
  const { data: klines = [] } = useQuery({ queryKey: ["klines", code], queryFn: () => getKlines(code!), enabled: !!code })
  const { data: history = [] } = useQuery({
    queryKey: ["analysisHistory", code],
    queryFn: () => getAnalysisHistory(code!),
    enabled: !!code && showHistory,
  })

  const pctColor = (v?: number) => {
    if (v == null) return ""
    return v > 0 ? "text-red-500" : v < 0 ? "text-green-600" : ""
  }

  const klineOption = {
    tooltip: { trigger: "axis" as const, axisPointer: { type: "cross" as const } },
    xAxis: { type: "category" as const, data: klines.map((k) => k.date) },
    yAxis: [{ type: "value" as const, scale: true }, { type: "value" as const, scale: true, name: "成交量" }],
    series: [
      {
        type: "candlestick" as const,
        data: klines.map((k) => [k.open, k.close, k.low, k.high]),
        itemStyle: { color: "#ef4444", color0: "#22c55e", borderColor: "#ef4444", borderColor0: "#22c55e" },
      },
      {
        type: "bar" as const,
        yAxisIndex: 1,
        data: klines.map((k) => k.volume),
        itemStyle: { color: "#94a3b8" },
      },
    ],
    dataZoom: [{ type: "inside" as const }],
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
  }

  const runAnalysis = useCallback(async () => {
    if (!code) return
    setAnalyzing(true)
    setAnalysisLog([])
    setAnalysisResult(null)
    try {
      await runAnalysisStream(code, (e: SSEEvent) => {
        if (e.type === "stage") {
          setAnalysisLog((p) => [...p, `[${e.stage}] ${e.status === "start" ? "开始" : "完成"}`])
        } else if (e.type === "agent_start") {
          setAnalysisLog((p) => [...p, `分析师 ${e.name} 分析中...`])
        } else if (e.type === "agent_done") {
          setAnalysisLog((p) => [...p, `分析师 ${e.name} → ${e.badge}`])
        } else if (e.type === "complete" && e.result) {
          setAnalysisResult(e.result)
        } else if (e.type === "error") {
          setAnalysisLog((p) => [...p, `错误: ${e.detail}`])
        }
      })
    } catch (err) {
      setAnalysisLog((p) => [...p, `分析失败: ${err}`])
    } finally {
      setAnalyzing(false)
    }
  }, [code])

  const decision = analysisResult?.decision as AnalysisDetail["decision"] | undefined
  const agents = analysisResult?.agents as Record<string, { name?: string; badge?: string; summary?: string }> | undefined
  const debate = analysisResult?.debate as { bull?: string; bear?: string } | undefined
  const risk = analysisResult?.risk as { risk_level?: string; key_risks?: string[]; summary?: string } | undefined

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold">{quote?.name ?? code} ({code})</h1>
        {quote && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-2xl font-bold">{quote.price.toFixed(2)}</span>
            <span className={`text-lg ${pctColor(quote.change_pct)}`}>
              {quote.change_pct > 0 ? "+" : ""}{quote.change_pct.toFixed(2)}%
            </span>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Quote info */}
        {quote && (
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>开 {quote.open.toFixed(2)}</div>
            <div>高 {quote.high.toFixed(2)}</div>
            <div>低 {quote.low.toFixed(2)}</div>
            <div>昨收 {quote.prev_close.toFixed(2)}</div>
          </div>
        )}

        {/* K-line chart */}
        <Card>
          <CardContent className="p-2">
            <ReactECharts option={klineOption} style={{ height: 400 }} />
          </CardContent>
        </Card>

        {/* Analysis controls */}
        <div className="flex gap-3">
          <Button onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            {analyzing ? "分析中..." : "开始分析"}
          </Button>
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
            历史分析
          </Button>
        </div>

        {/* Analysis log */}
        {analysisLog.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">分析进度</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm font-mono">
              {analysisLog.map((l, i) => <p key={i}>{l}</p>)}
            </CardContent>
          </Card>
        )}

        {/* Decision result */}
        {decision && (
          <Card className={decision.action === "BUY" ? "border-red-300" : decision.action === "SELL" ? "border-green-300" : ""}>
            <CardHeader><CardTitle className="text-base">决策: {decision.action} (信心度 {decision.confidence}%)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{decision.reason}</p>
              {decision.target_price && <p>目标价: {decision.target_price}</p>}
              {decision.stop_loss && <p>止损价: {decision.stop_loss}</p>}
              {decision.position_pct != null && <p>建议仓位: {decision.position_pct}%</p>}
            </CardContent>
          </Card>
        )}

        {/* Agent details */}
        {agents && Object.keys(agents).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(agents).map(([key, a]) => (
              <Card key={key}>
                <CardHeader><CardTitle className="text-sm">{a.name} — {a.badge}</CardTitle></CardHeader>
                <CardContent className="text-xs">{a.summary}</CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Debate */}
        {debate && (debate.bull || debate.bear) && (
          <div className="grid grid-cols-2 gap-3">
            {debate.bull && (
              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-sm text-red-500">看多</CardTitle></CardHeader>
                <CardContent className="text-xs whitespace-pre-wrap">{debate.bull}</CardContent>
              </Card>
            )}
            {debate.bear && (
              <Card className="border-green-200">
                <CardHeader><CardTitle className="text-sm text-green-600">看空</CardTitle></CardHeader>
                <CardContent className="text-xs whitespace-pre-wrap">{debate.bear}</CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Risk */}
        {risk && (
          <Card>
            <CardHeader><CardTitle className="text-sm">风控 — {risk.risk_level}</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              {risk.key_risks?.map((r, i) => <p key={i}>• {r}</p>)}
              <p>{risk.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">历史分析</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.map((h: AnalysisListItem) => (
                <div key={h.id} className="flex justify-between items-center text-sm border-b pb-1">
                  <span>{h.stock_name} ({h.stock_code})</span>
                  <span>{h.decision?.action ?? "?"} {h.decision?.confidence ?? 0}%</span>
                  <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
