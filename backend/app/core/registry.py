"""Plugin Registry — 5 个扩展点统一模式.

加新东西 = 新建一个文件 + 一行装饰器注册. 其他代码不动.
"""

from __future__ import annotations

from typing import Any, Callable




class Registry:
    """简单的 name -> class 注册表."""

    def __init__(self, kind: str) -> None:
        self.kind = kind
        self._items: dict[str, type] = {}

    def register(self, name: str, version: str = "1.0") -> Callable[[type], type]:
        def decorate(cls: type) -> type:
            cls._plugin_name = name  # type: ignore[attr-defined]
            cls._plugin_version = version  # type: ignore[attr-defined]
            self._items[name] = cls
            return cls

        return decorate

    def get(self, name: str) -> type:
        if name not in self._items:
            raise KeyError(f"[{self.kind}] 插件未注册: {name}. 已注册: {list(self._items)}")
        return self._items[name]

    def all(self) -> list[str]:
        return list(self._items.keys())


# 5 个扩展点 — 加新的分析师/数据源/LLM/通知/渲染都注册到这里
agent_registry = Registry("agent")
datasource_registry = Registry("datasource")
llm_registry = Registry("llm")
notifier_registry = Registry("notifier")
renderer_registry = Registry("renderer")