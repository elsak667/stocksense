"""健康检查路由."""

from fastapi import APIRouter

from app.deps import CurrentUser

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/api/protected")
async def protected(user: CurrentUser):
    """测试 JWT 是否生效."""
    return {"ok": True, "user": user.username}