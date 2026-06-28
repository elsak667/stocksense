"""agents package — import 各分析师以触发 registry 注册."""

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.agents.debate import run_debate
from app.agents.fundamental import FundamentalAgent
from app.agents.manager import ManagerAgent
from app.agents.pipeline import run_analysis
from app.agents.risk import RiskAgent
from app.agents.sentiment import SentimentAgent
from app.agents.technical import TechnicalAgent

__all__ = [
    "AgentContext",
    "AgentResult",
    "BaseAgent",
    "TechnicalAgent",
    "FundamentalAgent",
    "SentimentAgent",
    "RiskAgent",
    "ManagerAgent",
    "run_debate",
    "run_analysis",
]