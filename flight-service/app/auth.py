"""
auth.py — Shared JWT Verification Module
─────────────────────────────────────────
Each microservice verifies tokens independently using the shared SECRET_KEY.
This is the zero-trust verification pattern for HS256 JWTs: no network call
to the auth-service is needed on every request — the token is self-contained
and its signature is verified locally.

In production: replace the hard-coded SECRET_KEY with:
    import os
    SECRET_KEY = os.environ["JWT_SECRET_KEY"]
"""

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

# ── Shared Secret ──────────────────────────────────────────────────────────────
# Must be identical to auth-service SECRET_KEY.
SECRET_KEY = "airline-jwt-secret-key-change-in-production"
ALGORITHM = "HS256"

# ── OAuth2 Bearer Scheme ───────────────────────────────────────────────────────
# tokenUrl points at auth-service — Swagger UI will redirect there to issue tokens.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8003/login")


# ── Models ─────────────────────────────────────────────────────────────────────

class CurrentUser(BaseModel):
    """Decoded identity extracted from the JWT payload."""
    username: str
    role: str


# ── Token Verification Dependency ──────────────────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """
    Authentication Dependency
    ─────────────────────────
    Extracts and verifies the JWT from the Authorization: Bearer header.

    Steps:
      1. Extract Bearer token via OAuth2PasswordBearer (raises 401 if missing).
      2. Decode and verify signature + expiry using SECRET_KEY.
      3. Extract `sub` (username) and `role` claims from the payload.
      4. Raise HTTP 401 on any failure: missing token, bad signature, expired.

    JWTError catches: ExpiredSignatureError, JWSSignatureError, JWTClaimsError.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except JWTError:
        # Covers expired tokens, tampered signatures, and malformed tokens
        raise credentials_exception

    return CurrentUser(username=username, role=role)


# ── Role-Based Authorization Dependency ────────────────────────────────────────

def require_roles(allowed_roles: List[str]):
    """
    RBAC Enforcement Factory
    ────────────────────────
    Returns a FastAPI dependency that:
      1. Authenticates the caller via get_current_user (JWT signature + expiry).
      2. Checks the caller's role against allowed_roles.
      3. Raises HTTP 403 Forbidden if the role is not permitted.

    Usage:
        @app.patch("/flight/{id}/seat")
        def book_seat(user = Depends(require_roles(["staff", "admin"]))):
            ...
    """
    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. "
                    f"Required roles: {allowed_roles}. "
                    f"Your role: '{current_user.role}'."
                ),
            )
        return current_user

    return role_checker
