"""认证路由: 登录、当前用户."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    is_admin: bool


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: DbSession):
    from sqlalchemy import select

    q = await db.execute(select(User).where(User.username == body.username))
    user = q.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        from fastapi import HTTPException, status

        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    token = create_access_token(user.id, {"is_admin": user.is_admin})
    return LoginOut(token=token, is_admin=user.is_admin)


@router.get("/me")
async def me(user: CurrentUser):
    return {
        "id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
    }