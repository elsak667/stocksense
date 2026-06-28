import { useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { getQuote, getKlines, runAnalysisStream, getAnalysisHistory } from "@/lib/api"
import type { AnalysisDetail, AnalysisListItem } from "@/lib/api"
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

  const closes = klines.map((k) => k.close)
  const ma = (n: number) => closes.map((_, i) => {
    if (i < n - 1) return undefined
    let s = 0
    for (let j = i - n + 1; j <= i; j++) s += closes[j]
    return +(s / n).toFixed(2)
  })
  const volColors = klines.map((k) => (k.close >= k.open ? "#22c55e" : "#ef4444"))

  const klineOption = {
    tooltip: { trigger: "axis" as const, axisPointer: { type: "cross" as const } },
    xAxis: { type: "category" as const, data: klines.map((k) => k.date), axisLabel: { fontSize: 11 } },
    yAxis: [
      { type: "value" as const, scale: true, splitLine: { lineStyle: { color: "#f1f5f9" } } },
      { type: "value" as const, scale: true, name: "成交量", splitLine: { show: false } },
    ],
    series: [
      {
        type: "candlestick" as const,
        data: klines.map((k) => [k.open, k.close, k.low, k.high]),
        itemStyle: { color: "#ef4444", color0: "#22c55e", borderColor: "#ef4444", borderColor0: "#22c55e" },
      },
      { type: "line" as const, name: "MA5", data: ma(5), smooth: true, symbol: "none", lineStyle: { width: 1, color: "#f59e0b" } },
      { type: "line" as const, name: "MA10", data: ma(10), smooth: true, symbol: "none", lineStyle: { width: 1, color: "#3b82f6" } },
      { type: "line" as const, name: "MA20", data: ma(20), smooth: true, symbol: "none", lineStyle: { width: 1, color: "#8b5cf6" } },
      {
        type: "bar" as const,
        yAxisIndex: 1,
        data: klines.map((k, i) => ({ value: k.volume, itemStyle: { color: volColors[i] } })),
      },
    ],
    dataZoom: [{ type: "inside" as const }],
    grid: { left: 60, right: 60, top: 30, bottom: 40 },
    legend: { show: true, top: 0, right: 0, icon: "roundRect", itemWidth: 12, itemHeight: 2 },
  }

  const runAnalysis = useCallback(async () => {
    if (!code) return
    setAnalyzing(true)
    setAnalysisLog([])
    setAnalysisResult(null)
    try {
      await runAnalysisStream(code, (e: Record<string, unknown>) => {
        if (e.type === "stage") {
          setAnalysisLog((p) => [...p, `[${e.stage}] ${e.status === "start" ? "开始" : "完成"}`])
        } else if (e.type === "agent_start") {
          setAnalysisLog((p) => [...p, `分析师 ${e.name} 分析中...`])
        } else if (e.type === "agent_done") {
          setAnalysisLog((p) => [...p, `分析师 ${e.name} → ${e.badge}`])
        } else if (e.type === "complete" && e.result) {
          setAnalysisResult(e.result as Record<string, unknown>)
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

      {/* 左 K线 + 右分析 */}
      <main className="max-w-6xl mx-auto p-6 flex gap-6">
        {/* 左侧：K线 */}
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardContent className="p-2">
              <ReactECharts option={klineOption} style={{ height: 500 }} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：分析面板 */}
        <div className="w-[420px] shrink-0 space-y-4">
          {quote && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>开 {quote.open.toFixed(2)}</div>
              <div>高 {quote.high.toFixed(2)}</div>
              <div>低 {quote.low.toFixed(2)}</div>
              <div>昨收 {quote.prev_close.toFixed(2)}</div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={runAnalysis} disabled={analyzing} className="flex-1">
              {analyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
              {analyzing ? "分析中..." : "开始分析"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>历史</Button>
          </div>

          {analysisLog.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">分析进度</CardTitle></CardHeader>
              <CardContent className="text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
                {analysisLog.map((l, i) => <p key={i}>{l}</p>)}
              </CardContent>
            </Card>
          )}

          {decision && (
            <Card className={decision.action === "BUY" ? "border-red-300" : decision.action === "SELL" ? "border-green-300" : ""}>
              <CardHeader><CardTitle className="text-sm">决策: {decision.action} (信心 {decision.confidence}%)</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <p>{decision.reason}</p>
                {decision.target_price && <p>目标价: {decision.target_price}</p>}
                {decision.stop_loss && <p>止损价: {decision.stop_loss}</p>}
                {decision.position_pct != null && <p>仓位: {decision.position_pct}%</p>}
              </CardContent>
            </Card>
          )}

          {agents && Object.keys(agents).length > 0 && (
            <div className="space-y-2">
              {Object.entries(agents).map(([key, a]) => (
                <Card key={key}>
                  <CardHeader><CardTitle className="text-xs">{a.name} — {a.badge}</CardTitle></CardHeader>
                  <CardContent className="text-xs">{a.summary}</CardContent>
                </Card>
              ))}
            </div>
          )}

          {debate && (debate.bull || debate.bear) && (
            <div className="space-y-2">
              {debate.bull && (
                <Card className="border-red-200">
                  <CardHeader><CardTitle className="text-xs text-red-500">看多</CardTitle></CardHeader>
                  <CardContent className="text-xs whitespace-pre-wrap">{debate.bull}</CardContent>
                </Card>
              )}
              {debate.bear && (
                <Card className="border-green-200">
                  <CardHeader><CardTitle className="text-xs text-green-600">看空</CardTitle></CardHeader>
                  <CardContent className="text-xs whitespace-pre-wrap">{debate.bear}</CardContent>
                </Card>
              )}
            </div>
          )}

          {risk && (
            <Card>
              <CardHeader><CardTitle className="text-xs">风控 — {risk.risk_level}</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                {risk.key_risks?.map((r, i) => <p key={i}>• {r}</p>)}
                <p>{risk.summary}</p>
              </CardContent>
            </Card>
          )}

          {showHistory && history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">历史分析</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                {history.map((h: AnalysisListItem) => (
                  <div key={h.id} className="flex justify-between border-b pb-1">
                    <span>{h.stock_name}</span>
                    <span>{h.decision?.action ?? "?"} {h.decision?.confidence ?? 0}%</span>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
