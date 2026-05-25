"""
auth-service/app/main.py
────────────────────────
JWT Authentication microservice for the Distributed Airline Management System.

Provides:
  POST /login  — issue a signed JWT
  GET  /me     — return the caller's decoded identity
  GET  /bookings/create  — passenger / staff / admin
  GET  /staff/flights    — staff / admin only
  GET  /admin/users      — admin only
  GET  /health           — public health probe
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# ── JWT Configuration ─────────────────────────────────────────────────────────
# In production: load SECRET_KEY from an environment variable / secrets manager.
# Never hard-code this value in a real deployment.
SECRET_KEY = "airline-jwt-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ── Password Hashing ──────────────────────────────────────────────────────────
# CryptContext wraps bcrypt and handles salt generation transparently.
# "deprecated='auto'" ensures old hashing schemes are flagged automatically.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 Bearer Scheme ──────────────────────────────────────────────────────
# Tells FastAPI where to look for the token (Authorization: Bearer <token>).
# tokenUrl="/login" wires the Swagger UI "Authorize" button to that endpoint.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# ── Role Constants ────────────────────────────────────────────────────────────
STAFF_ADMIN_ROLES: set[str] = {"staff", "admin"}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class User(BaseModel):
    username: str
    role: str
    full_name: str
    email: str


class UserInDB(User):
    hashed_password: str


# ─────────────────────────────────────────────────────────────────────────────
# In-Memory User Store
# ─────────────────────────────────────────────────────────────────────────────
# Replace with a real database (PostgreSQL + SQLAlchemy, etc.) in production.
# Passwords are stored as bcrypt hashes — never as plain text.

fake_users_db: dict[str, UserInDB] = {
    "passenger1": UserInDB(
        username="passenger1",
        role="passenger",
        full_name="Jane Passenger",
        email="passenger1@airline.com",
        hashed_password=pwd_context.hash("password123"),
    ),
    "staff1": UserInDB(
        username="staff1",
        role="staff",
        full_name="John Staff",
        email="staff1@airline.com",
        hashed_password=pwd_context.hash("password123"),
    ),
    "admin1": UserInDB(
        username="admin1",
        role="admin",
        full_name="Alice Admin",
        email="admin1@airline.com",
        hashed_password=pwd_context.hash("password123"),
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# Auth Helpers
# ─────────────────────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain, hashed)


def get_user(username: str) -> Optional[UserInDB]:
    """Look up a user by username in the in-memory store."""
    return fake_users_db.get(username)


def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    """
    Validate credentials:
      1. The user must exist.
      2. The password must match the stored hash.
    The role is server-assigned from the DB — clients never self-declare it.
    Returns the UserInDB on success, None on any failure.
    """
    user = get_user(username)
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Token Generation
    ────────────────
    Build a JWT payload from `data`, attach an expiry claim (`exp`),
    then sign it with SECRET_KEY using the HS256 algorithm.

    The signed token can be decoded and verified by anyone who holds
    SECRET_KEY — in a microservices setup, all services share this key
    (or use public-key verification with RS256).
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=15)
    )
    payload.update({"exp": expire})
    # jwt.encode returns the compact serialisation: header.payload.signature
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Dependencies
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Token Verification Dependency
    ──────────────────────────────
    Called automatically by FastAPI whenever a protected endpoint is hit.

    Steps:
      1. Extract the Bearer token from the Authorization header.
      2. Decode and verify the JWT signature + expiry with python-jose.
      3. Pull the username from the `sub` claim and look up the user.
      4. Raise HTTP 401 on any failure (bad signature, expired, missing `sub`).

    JWTError covers: ExpiredSignatureError, JWTClaimsError, JWSError, etc.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        role: str | None = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        # Expired tokens, tampered signatures, and malformed tokens all land here
        raise credentials_exception

    user = get_user(token_data.username)
    if user is None:
        raise credentials_exception

    return User(
        username=user.username,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
    )


def require_roles(allowed_roles: List[str]):
    """
    Role-Based Authorization Dependency Factory
    ────────────────────────────────────────────
    Returns a FastAPI dependency that:
      - First validates the JWT via `get_current_user` (authentication).
      - Then checks that the user's role is in `allowed_roles` (authorization).
      - Raises HTTP 403 Forbidden if the role check fails.

    Usage:
        @app.get("/admin/users")
        async def admin_endpoint(user = Depends(require_roles(["admin"]))):
            ...
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
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


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Airline Auth Service",
    description="""
## JWT Authentication Microservice

Part of the Distributed Airline Management System.

### How to authenticate in Swagger UI
1. Call **POST /login** with one of the example users below.
2. Copy the `access_token` from the response.
3. Click the **Authorize** button (top-right) and enter: `Bearer <your_token>`.
4. All protected endpoints will now include your token automatically.

### Example users
| Username    | Password    | Role      |
|-------------|-------------|-----------|
| passenger1  | password123 | passenger |
| staff1      | password123 | staff     |
| admin1      | password123 | admin     |

### Role permissions
| Endpoint              | passenger | staff | admin |
|-----------------------|:---------:|:-----:|:-----:|
| GET /me               | ✓         | ✓     | ✓     |
| GET /bookings/create  | ✓         | ✓     | ✓     |
| GET /staff/flights    |           | ✓     | ✓     |
| GET /admin/users      |           |       | ✓     |
""",
    version="1.0.0",
)


# ─────────────────────────────────────────────────────────────────────────────
# Public Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    """Public health probe — no authentication required."""
    return {"status": "healthy", "service": "airline-auth-service", "port": 8003}


@app.post("/login", response_model=Token, tags=["Authentication"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    **Authenticate** with username and password.

    Accepts standard OAuth2 `application/x-www-form-urlencoded` form data —
    this is what the Swagger UI Authorize dialog and Postman's form-body mode send.

    Returns a signed JWT access token valid for 30 minutes.
    The user's role is read from the server-side store, not declared by the client.
    """
    # authenticate_user validates credentials; role is server-assigned from the DB
    user = authenticate_user(form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Embed username as `sub` (subject) and server-assigned role as a custom claim
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token, token_type="bearer")


# ─────────────────────────────────────────────────────────────────────────────
# Protected Endpoints — all roles
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/me", response_model=User, tags=["User"])
async def read_current_user(current_user: User = Depends(get_current_user)):
    """
    **View your profile.**

    Returns the authenticated user's identity decoded from the JWT.
    Accessible by any valid token holder (passenger, staff, or admin).
    """
    return current_user


@app.get("/bookings/create", tags=["Bookings"])
async def create_booking(
    current_user: User = Depends(require_roles(["passenger", "staff", "admin"]))
):
    """
    **Create a booking (simulated).**

    Accessible by passengers, staff, and admins.
    Returns HTTP 401 if the token is missing or invalid.
    """
    return {
        "message": f"Booking successfully created by '{current_user.username}'.",
        "booked_by_role": current_user.role,
        "booking_ref": "BK-20260525-001",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Protected Endpoints — staff / admin only
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/staff/flights", tags=["Staff"])
async def manage_flights(
    current_user: User = Depends(require_roles(["staff", "admin"]))
):
    """
    **Flight management panel.**

    Returns HTTP 403 for passengers.
    Accessible by staff and admin roles.
    """
    return {
        "message": f"Flight management access granted to '{current_user.username}'.",
        "role": current_user.role,
        "flights": [
            {"id": "FL001", "route": "CMB → LHR", "status": "On Time"},
            {"id": "FL002", "route": "LHR → DXB", "status": "Delayed"},
            {"id": "FL003", "route": "DXB → SIN", "status": "Boarding"},
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Protected Endpoints — admin only
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/admin/users", tags=["Admin"])
async def list_all_users(
    current_user: User = Depends(require_roles(["admin"]))
):
    """
    **List all registered users.**

    Returns HTTP 403 for passengers and staff.
    Admin-only endpoint.
    """
    return {
        "requested_by": current_user.username,
        "users": [
            {"username": u.username, "role": u.role, "email": u.email, "full_name": u.full_name}
            for u in fake_users_db.values()
        ],
    }
