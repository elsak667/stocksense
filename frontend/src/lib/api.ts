import axios from "axios"

const api = axios.create({ baseURL: "/api" })

api.interceptors.request.use((c) => {
  const t = localStorage.getItem("token")
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(e)
  },
)

// ===== Types =====
export interface User {
  id: number
  username: string
  is_admin: boolean
}

export interface WatchlistItem {
  id: number
  stock_code: string
  stock_name: string
  market: string
  note: string | null
  added_at: string
}

export interface WatchlistQuote {
  id: number
  stock_code: string
  stock_name: string
  market: string
  note: string | null
  price: number | null
  change_pct: number | null
}

export interface Quote {
  code: string
  name: string
  market: string
  price: number
  change: number
  change_pct: number
  open: number
  high: number
  low: number
  prev_close: number
  volume: number
  amount: number
  timestamp: string
}

export interface Kline {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
  change_pct: number
}

export interface SearchResult {
  code: string
  name: string
  market: string
}

export interface ScreenerResult {
  code: string
  name: string
  price: number | null
  change_pct: number | null
  pe: number | null
  pb: number | null
  vol_ratio: number | null
  mcap: number | null
  volume: number | null
}

export interface AnalysisListItem {
  id: number
  created_at: string
  stock_code: string
  stock_name: string
  decision: {
    action?: string
    confidence?: number
    reason?: string
  }
}

export interface AnalysisDetail {
  id: number
  stock_code: string
  stock_name: string
  analysis_date: string | null
  elapsed_seconds: number
  created_at: string
  quote: Record<string, unknown>
  agents: Record<string, unknown>
  debate: { bull?: string; bear?: string }
  risk: Record<string, unknown>
  decision: {
    action?: string
    confidence?: number
    reason?: string
    target_price?: number | null
    stop_loss?: number | null
    position_pct?: number
  }
}

export interface SSEEvent {
  type: string
  stage?: string
  status?: string
  name?: string
  badge?: string
  summary?: string
  data?: unknown
  result?: Record<string, unknown>
  detail?: string
}

// ===== Auth =====
export async function login(username: string, password: string) {
  const { data } = await api.post<{ token: string; is_admin: boolean }>("/auth/login", { username, password })
  return data
}

export async function getMe() {
  const { data } = await api.get<User>("/auth/me")
  return data
}

// ===== Watchlist =====
export async function getWatchlist() {
  const { data } = await api.get<WatchlistItem[]>("/watchlist")
  return data
}

export async function addToWatchlist(stock_code: string, note?: string) {
  const { data } = await api.post<WatchlistItem>("/watchlist", { stock_code, note })
  return data
}

export async function removeFromWatchlist(id: number) {
  await api.delete(`/watchlist/${id}`)
}

// ===== Dashboard =====
export async function getDashboard() {
  const { data } = await api.get<WatchlistQuote[]>("/watchlist/quotes")
  return data
}

// ===== Quotes =====
export async function getQuote(code: string) {
  const { data } = await api.get<Quote>(`/quotes/${code}`)
  return data
}

export async function getKlines(code: string, days = 120) {
  const { data } = await api.get<Kline[]>(`/klines/${code}`, { params: { days } })
  return data
}

// ===== Analysis =====
export async function runAnalysisStream(
  stockCode: string,
  onEvent: (e: SSEEvent) => void,
  opts?: { llm_provider?: string; debate_rounds?: number },
): Promise<void> {
  const token = localStorage.getItem("token")
  const resp = await fetch(`/api/analysis/${stockCode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(opts ?? { debate_rounds: 2 }),
  })
  if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`)
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n\n")
    buf = lines.pop()!
    for (const line of lines) {
      const m = line.match(/^data: (.+)$/s)
      if (m) onEvent(JSON.parse(m[1]))
    }
  }
}

export async function getAnalysisHistory(stockCode: string, limit = 10) {
  const { data } = await api.get<AnalysisListItem[]>(`/analysis/history/${stockCode}`, { params: { limit } })
  return data
}

export async function getAnalysisList(limit = 50) {
  const { data } = await api.get<AnalysisListItem[]>("/analysis/list", { params: { limit } })
  return data
}

export async function getAnalysisById(id: number) {
  const { data } = await api.get<AnalysisDetail>(`/analysis/detail/${id}`)
  return data
}

// ===== Stocks =====
export async function searchStocks(q: string) {
  const { data } = await api.get<SearchResult[]>("/stocks/search", { params: { q } })
  return Array.isArray(data) ? data : []
}

export async function screenerStocks(params: {
  pe_min?: number; pe_max?: number
  pb_min?: number; pb_max?: number
  price_min?: number; price_max?: number
  change_min?: number; change_max?: number
  volume_min?: number
  limit?: number
}) {
  const { data } = await api.get<ScreenerResult[]>("/stocks/screener", { params })
  return data
}
