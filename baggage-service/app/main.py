"""
Baggage Service — FastAPI Microservice
───────────────────────────────────────
Manages airline baggage records in the distributed airline management system.

Phase 4 Security
────────────────
All endpoints are protected with JWT authentication via the shared auth module.
Baggage status updates are restricted to staff and admin roles.

Role matrix:
  GET  /baggage           — any authenticated user
  GET  /baggage/{id}      — any authenticated user
  PATCH /baggage/update   — staff, admin only
"""

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional

from .auth import get_current_user, require_roles

# ── FastAPI Application ────────────────────────────────────────────────────────

app = FastAPI(
    title="Baggage Service",
    description="""
## Baggage Microservice

Part of the Distributed Airline Management System.

### Authentication
All endpoints require a valid **JWT Bearer token** issued by the
**Auth Service** running on port 8003.

1. Obtain a token: `POST http://localhost:8003/login`
2. Click **Authorize** (top-right) and enter: `Bearer <your_token>`

### Role permissions
| Endpoint             | passenger | staff | admin |
|----------------------|:---------:|:-----:|:-----:|
| GET /baggage         | ✓         | ✓     | ✓     |
| GET /baggage/{id}    | ✓         | ✓     | ✓     |
| PATCH /baggage/update|           | ✓     | ✓     |
""",
    version="1.0.0",
)


# ── Pydantic Models ────────────────────────────────────────────────────────────

class BaggageItem(BaseModel):
    """Full baggage record returned by the API."""
    id: int
    passenger_name: str
    flight_id: int
    status: str
    location: str


class BaggageUpdateRequest(BaseModel):
    """Payload accepted by PATCH /baggage/update."""
    baggage_id: int = Field(..., description="ID of the baggage item to update")
    status: str = Field(..., description="New status for the baggage item")
    location: Optional[str] = Field(None, description="New physical location (optional)")


# ── In-Memory Data Store ───────────────────────────────────────────────────────

baggage_db: List[dict] = [
    {"id": 1, "passenger_name": "Josh Perera",        "flight_id": 1, "status": "Checked In",  "location": "Heathrow Airport"},
    {"id": 2, "passenger_name": "Sarah Mendis",        "flight_id": 2, "status": "In Transit",  "location": "Dubai International Airport"},
    {"id": 3, "passenger_name": "Amal Fernando",       "flight_id": 1, "status": "Arrived",     "location": "Bandaranaike International Airport"},
    {"id": 4, "passenger_name": "Priya Jayawardena",   "flight_id": 3, "status": "Checked In",  "location": "Changi Airport"},
    {"id": 5, "passenger_name": "Nimal Wickrama",      "flight_id": 2, "status": "Lost",        "location": "Unknown"},
]


# ── Helper ─────────────────────────────────────────────────────────────────────

def _find_baggage(baggage_id: int) -> dict:
    """
    Scan the in-memory list for a record matching baggage_id.
    Raises HTTP 404 if no match is found so callers never receive None.
    """
    for item in baggage_db:
        if item["id"] == baggage_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Baggage item with ID {baggage_id} not found.",
    )


# ── Public Endpoints ───────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    """Public health-check — no authentication required."""
    return {"service": "Baggage Service", "status": "running"}


# ── Protected Endpoints — all authenticated roles ──────────────────────────────

@app.get("/baggage", response_model=List[BaggageItem], tags=["Baggage"],
         dependencies=[Depends(get_current_user)])
def get_all_baggage():
    """
    List all baggage items.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 401 if the token is missing or invalid.
    """
    return baggage_db


@app.get("/baggage/{id}", response_model=BaggageItem, tags=["Baggage"],
         dependencies=[Depends(get_current_user)])
def get_baggage(id: int):
    """
    Retrieve a single baggage item by ID.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 404 if the baggage item does not exist.
    """
    return _find_baggage(id)


# ── Protected Endpoints — staff / admin only ───────────────────────────────────

@app.patch("/baggage/update", response_model=BaggageItem, tags=["Baggage"],
           dependencies=[Depends(require_roles(["staff", "admin"]))])
def update_baggage(payload: BaggageUpdateRequest):
    """
    Update baggage status and/or location.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** staff, admin only.
    Returns HTTP 403 if a passenger attempts this action.

    **Update logic:**
    1. Validate required fields via Pydantic (HTTP 422 if missing).
    2. Locate the record — HTTP 404 if not found.
    3. Apply status update (always required).
    4. Apply location update only when explicitly provided.
    5. Return the full updated record.
    """
    record = _find_baggage(payload.baggage_id)

    record["status"] = payload.status

    if payload.location is not None:
        record["location"] = payload.location

    return record
