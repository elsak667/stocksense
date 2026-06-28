import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import StockDetailPage from "./pages/StockDetailPage"
import ScreenerPage from "./pages/ScreenerPage"
import AnalysisHistoryPage from "./pages/AnalysisHistoryPage"

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function Protected({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/stock/:code" element={<Protected><StockDetailPage /></Protected>} />
          <Route path="/screener" element={<Protected><ScreenerPage /></Protected>} />
          <Route path="/history" element={<Protected><AnalysisHistoryPage /></Protected>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
