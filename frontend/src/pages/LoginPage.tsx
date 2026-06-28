import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

export default function LoginPage() {
  const nav = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token } = await login(username, password)
      localStorage.setItem("token", token)
      nav("/")
    } catch {
      setError("用户名或密码错误")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(222 84% 4.9%) 0%, hsl(222 80% 7%) 100%)" }}>
      <Card className="w-full max-w-sm border-white/5 bg-white/[0.02]">
        <CardHeader className="items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3"><TrendingUp className="w-6 h-6 text-primary" /></div>
          <h1 className="text-xl font-bold tracking-tight"><span className="text-primary">Stock</span>Sense</h1>
          <p className="text-sm text-muted-foreground mt-1">A 股智能分析平台</p>
        </CardHeader>
        <CardContent className="pb-8 px-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} className="border-white/10 bg-white/5" />
            <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} className="border-white/10 bg-white/5" />
            {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
