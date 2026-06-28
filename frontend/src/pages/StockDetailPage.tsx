import { useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { getQuote, getKlines, runAnalysisStream, getAnalysisHistory } from "@/lib/api"
import type { AnalysisDetail, AnalysisListItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Play, Loader2, History } from "lucide-react"

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

  const pctColor = (v?: number) => (v == null ? "" : v > 0 ? "text-emerald-400" : "text-rose-400")

  const closes = klines.map((k) => k.close)
  const ma = (n: number) => closes.map((_, i) => {
    if (i < n - 1) return undefined
    let s = 0
    for (let j = i - n + 1; j <= i; j++) s += closes[j]
    return +(s / n).toFixed(2)
  })
  const volColors = klines.map((k) => (k.close >= k.open ? "#34d399" : "#fb7185"))
  const dates = klines.map((k) => k.date)
  const vols = klines.map((k) => k.volume)
  const klineData = klines.map((k) => [k.open, k.close, k.low, k.high])

  const klineOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "cross" as const },
      backgroundColor: "rgba(30,41,59,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    legend: { show: true, top: 0, right: 0, icon: "roundRect", itemWidth: 14, itemHeight: 2, textStyle: { color: "#94a3b8" }, data: ["5日均线", "10日均线", "20日均线"] },
    grid: [
      { left: 55, right: 20, top: 25, bottom: "38%" },
      { left: 55, right: 20, top: "62%", bottom: 30 },
    ],
    xAxis: [
      { type: "category" as const, data: dates, axisLabel: { show: false }, gridIndex: 0 },
      { type: "category" as const, data: dates, axisLabel: { fontSize: 10, color: "#64748b" }, gridIndex: 1, axisLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } } },
    ],
    yAxis: [
      { type: "value" as const, scale: true, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } }, gridIndex: 0, axisLabel: { fontSize: 10, color: "#64748b" } },
      { type: "value" as const, scale: true, splitLine: { show: false }, gridIndex: 1, axisLabel: { fontSize: 9, color: "#64748b" } },
    ],
    series: [
      {
        type: "candlestick" as const, xAxisIndex: 0, yAxisIndex: 0,
        data: klineData,
        itemStyle: { color: "#fb7185", color0: "#34d399", borderColor: "#fb7185", borderColor0: "#34d399" },
      },
      { type: "line" as const, name: "5日均线", xAxisIndex: 0, yAxisIndex: 0, data: ma(5), smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#fbbf24" } },
      { type: "line" as const, name: "10日均线", xAxisIndex: 0, yAxisIndex: 0, data: ma(10), smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#60a5fa" } },
      { type: "line" as const, name: "20日均线", xAxisIndex: 0, yAxisIndex: 0, data: ma(20), smooth: true, symbol: "none", lineStyle: { width: 1.5, color: "#a78bfa" } },
      { type: "bar" as const, xAxisIndex: 1, yAxisIndex: 1, data: vols.map((v, i) => ({ value: v, itemStyle: { color: volColors[i] } })) },
    ],
    dataZoom: [
      { type: "inside" as const },
      { type: "slider" as const, bottom: 2, height: 16, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(30,41,59,0.5)", fillerColor: "rgba(59,130,246,0.15)", handleStyle: { borderColor: "#64748b" }, labelStyle: { fontSize: 10, color: "#94a3b8" }, textStyle: { color: "#94a3b8" } },
    ],
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
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(222 84% 4.9%) 0%, hsl(222 80% 7%) 100%)" }}>
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4" style={{ background: "hsl(222 84% 4.9% / 0.8)" }}>
        <Button variant="ghost" size="icon" onClick={() => nav("/")}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-xl font-bold tracking-tight">{quote?.name ?? code} <span className="text-muted-foreground font-normal">{code}</span></h1>
        {quote && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-2xl font-bold tracking-tight">{quote.price.toFixed(2)}</span>
            <span className={`text-lg font-medium ${pctColor(quote.change_pct)}`}>
              {quote.change_pct > 0 ? "+" : ""}{quote.change_pct.toFixed(2)}%
            </span>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-6 flex gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="p-2">
              <ReactECharts option={klineOption} style={{ height: 560 }} />
            </CardContent>
          </Card>
        </div>

        <div className="w-[420px] shrink-0 space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
          {quote && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white/[0.03] rounded-lg p-3"><span className="text-muted-foreground text-xs">开盘价</span><p className="font-medium mt-0.5">{quote.open.toFixed(2)}</p></div>
              <div className="bg-white/[0.03] rounded-lg p-3"><span className="text-muted-foreground text-xs">最高价</span><p className="font-medium mt-0.5">{quote.high.toFixed(2)}</p></div>
              <div className="bg-white/[0.03] rounded-lg p-3"><span className="text-muted-foreground text-xs">最低价</span><p className="font-medium mt-0.5">{quote.low.toFixed(2)}</p></div>
              <div className="bg-white/[0.03] rounded-lg p-3"><span className="text-muted-foreground text-xs">昨收价</span><p className="font-medium mt-0.5">{quote.prev_close.toFixed(2)}</p></div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={runAnalysis} disabled={analyzing} className="flex-1 glow-primary">
              {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
              {analyzing ? "分析中..." : "开始分析"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="border-white/10"><History className="w-4 h-4 mr-1.5" />历史</Button>
          </div>

          {analysisLog.length > 0 && (
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="py-3"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">分析进度</CardTitle></CardHeader>
              <CardContent className="text-xs font-mono space-y-1 max-h-32 overflow-y-auto text-muted-foreground">
                {analysisLog.map((l, i) => <p key={i}>{l}</p>)}
              </CardContent>
            </Card>
          )}

          {decision && (
            <Card className={`border-l-2 ${decision.action === "BUY" ? "border-l-rose-400" : decision.action === "SELL" ? "border-l-emerald-400" : "border-l-white/10"} bg-white/[0.02]`}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  决策
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${decision.action === "BUY" ? "bg-rose-500/20 text-rose-400" : decision.action === "SELL" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-muted-foreground"}`}>
                    {decision.action === "BUY" ? "买入" : decision.action === "SELL" ? "卖出" : decision.action}
                  </span>
                  <span className="text-muted-foreground font-normal">信心 {decision.confidence}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5 text-muted-foreground">
                <p className="text-foreground/80">{decision.reason}</p>
                {decision.target_price && <p>目标价: <span className="text-emerald-400 font-medium">{decision.target_price}</span></p>}
                {decision.stop_loss && <p>止损价: <span className="text-rose-400 font-medium">{decision.stop_loss}</span></p>}
                {decision.position_pct != null && <p>建议仓位: <span className="text-blue-400 font-medium">{decision.position_pct}%</span></p>}
              </CardContent>
            </Card>
          )}

          {agents && Object.keys(agents).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">分析师观点</p>
              {Object.entries(agents).map(([key, a]) => (
                <Card key={key} className="border-white/5 bg-white/[0.02]">
                  <CardHeader className="py-2.5"><CardTitle className="text-xs"><span className="text-primary">{a.name}</span><span className="text-muted-foreground ml-2">{a.badge}</span></CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground">{a.summary}</CardContent>
                </Card>
              ))}
            </div>
          )}

          {debate && (debate.bull || debate.bear) && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">多空辩论</p>
              {debate.bull && (
                <Card className="border-l-2 border-l-rose-400/40 bg-white/[0.02]">
                  <CardHeader className="py-2.5"><CardTitle className="text-xs text-rose-400">看多</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground whitespace-pre-wrap">{debate.bull}</CardContent>
                </Card>
              )}
              {debate.bear && (
                <Card className="border-l-2 border-l-emerald-400/40 bg-white/[0.02]">
                  <CardHeader className="py-2.5"><CardTitle className="text-xs text-emerald-400">看空</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground whitespace-pre-wrap">{debate.bear}</CardContent>
                </Card>
              )}
            </div>
          )}

          {risk && (
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="py-3"><CardTitle className="text-xs flex items-center gap-2">风险控制<span className={`px-2 py-0.5 rounded text-xs ${risk.risk_level === "高" || risk.risk_level === "high" ? "bg-rose-500/20 text-rose-400" : risk.risk_level === "中" || risk.risk_level === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>{risk.risk_level}</span></CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                {risk.key_risks?.map((r, i) => <p key={i} className="flex items-start gap-2"><span className="text-rose-400 mt-1">•</span>{r}</p>)}
                {risk.summary && <p className="mt-2 text-foreground/60">{risk.summary}</p>}
              </CardContent>
            </Card>
          )}

          {showHistory && history.length > 0 && (
            <Card className="border-white/5 bg-white/[0.02]">
              <CardHeader className="py-3"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">历史分析</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2">
                {history.map((h: AnalysisListItem) => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-foreground/80">{h.stock_name}</p>
                      <p className="text-muted-foreground text-[10px]">{new Date(h.created_at).toLocaleString("zh-CN")}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${h.decision?.action === "买入" || h.decision?.action === "BUY" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>{h.decision?.action ?? "?"} {h.decision?.confidence ?? 0}%</span>
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
