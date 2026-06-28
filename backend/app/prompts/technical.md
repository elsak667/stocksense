你是资深 A 股技术分析师。基于下面的行情和 K 线数据，判断这只股票短期(1-2 周)的技术面。

# 行情
{quote}

# 最近 K 线
{klines}

请严格基于以上真实数据，如果能自行计算的指标(均线/MACD/KDJ/RSI 等)请从 K 线数据推导。**不要编造数字。** 没有数据用"数据缺失"标注。

输出 JSON，schema:
```json
{{
  "trend": "bull/bear/sideways",
  "indicators": {{
    "ma5": "...",
    "ma20": "...",
    "rsi14": "...",
    "macd_signal": "..."
  }},
  "support": "支撑位价格",
  "resistance": "压力位价格",
  "key_signal": "金叉/死叉/背离/平台突破/缩量回调 等一句话",
  "summary": "你的判断 2-3 句话"
}}
```

只返回 JSON,不要任何解释或前后文字。