"""
Flight Service — FastAPI Microservice
──────────────────────────────────────
Manages flight data and seat availability in the distributed airline system.

Phase 4 Security
────────────────
All endpoints are protected with JWT authentication via the shared auth module.
The seat modification endpoints also accept forwarded tokens from booking-service
(token-forwarding / zero-trust service-to-service pattern).

Role matrix:
  GET  /flights                   — any authenticated user
  GET  /flight/{id}               — any authenticated user
  PATCH /flight/{id}/seat         — any authenticated user
                                    (called by booking-service on behalf of caller)
  PATCH /flight/{id}/seat/restore — any authenticated user
                                    (called by booking-service on cancellation)

Note on seat endpoints and role design:
  These mutation endpoints accept any authenticated role because they are
  internal service-to-service calls made by booking-service, which forwards
  the original caller's token. Restricting them to staff/admin would prevent
  passengers from completing bookings end-to-end. In a production system these
  would be protected by a dedicated service-account token instead.
"""

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List

from .auth import get_current_user, require_roles

# ── FastAPI Application ────────────────────────────────────────────────────────

app = FastAPI(
    title="Flight Service",
    description="""
## Flight Microservice

Part of the Distributed Airline Management System.

### Authentication
All endpoints require a valid **JWT Bearer token** issued by the
**Auth Service** running on port 8003.

1. Obtain a token: `POST http://localhost:8003/login`
2. Click **Authorize** (top-right) and enter: `Bearer <your_token>`

### Role permissions
| Endpoint                        | passenger | staff | admin |
|---------------------------------|:---------:|:-----:|:-----:|
| GET /flights                    | ✓         | ✓     | ✓     |
| GET /flight/{id}                | ✓         | ✓     | ✓     |
| PATCH /flight/{id}/seat         | ✓         | ✓     | ✓     |
| PATCH /flight/{id}/seat/restore | ✓         | ✓     | ✓     |
""",
    version="1.0.0",
)


# ── Pydantic Models ────────────────────────────────────────────────────────────

class Flight(BaseModel):
    """Represents a single flight record."""
    id: int
    flight_number: str
    origin: str
    destination: str
    available_seats: int
    status: str


class FlightSummary(BaseModel):
    """Response wrapper returned after a seat operation."""
    message: str
    flight: Flight


# ── In-Memory Data Store ───────────────────────────────────────────────────────

flights_db: dict[int, Flight] = {
    1: Flight(id=1, flight_number="TMG101", origin="London",   destination="Dubai",     available_seats=120, status="On Time"),
    2: Flight(id=2, flight_number="TMG202", origin="Dubai",    destination="New York",  available_seats=85,  status="On Time"),
    3: Flight(id=3, flight_number="TMG303", origin="New York", destination="Toronto",   available_seats=60,  status="Delayed"),
    4: Flight(id=4, flight_number="TMG404", origin="Toronto",  destination="London",    available_seats=200, status="On Time"),
    5: Flight(id=5, flight_number="TMG505", origin="Sydney",   destination="Singapore", available_seats=0,   status="Boarding"),
}


# ── Helper ─────────────────────────────────────────────────────────────────────

def _get_flight_or_404(flight_id: int) -> Flight:
    """Look up a flight by ID. Raises HTTP 404 if not found."""
    flight = flights_db.get(flight_id)
    if not flight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flight with ID {flight_id} not found.",
        )
    return flight


# ── Public Endpoints ───────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
def root():
    """Public health-check — no authentication required."""
    return {"service": "Flight Service", "status": "running"}


# ── Protected Endpoints — all authenticated roles ──────────────────────────────

@app.get("/flights", response_model=List[Flight], tags=["Flights"],
         dependencies=[Depends(get_current_user)])
def get_flights():
    """
    List all flights.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 401 if the token is missing or invalid.
    """
    return list(flights_db.values())


@app.get("/flight/{id}", response_model=Flight, tags=["Flights"],
         dependencies=[Depends(get_current_user)])
def get_flight(id: int):
    """
    Retrieve a single flight by ID.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 404 if the flight does not exist.
    """
    return _get_flight_or_404(id)


@app.patch("/flight/{id}/seat", response_model=FlightSummary, tags=["Flights"],
           dependencies=[Depends(get_current_user)])
def book_seat(id: int):
    """
    Decrease available seat count by 1 (simulates a seat booking).

    **Authentication:** Requires a valid JWT Bearer token (any role).
    **Called by:** booking-service, which forwards the original caller's token.

    **Logic:**
    - Validates the flight exists (HTTP 404 if not).
    - Rejects with HTTP 409 if the flight is fully booked.
    - Decrements available_seats by 1 and returns the updated flight.
    """
    flight = _get_flight_or_404(id)

    if flight.available_seats <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Flight {flight.flight_number} is fully booked. No seats available.",
        )

    updated = flight.model_copy(update={"available_seats": flight.available_seats - 1})
    flights_db[id] = updated

    return FlightSummary(
        message=f"Seat successfully booked on flight {updated.flight_number}.",
        flight=updated,
    )


@app.patch("/flight/{id}/seat/restore", response_model=FlightSummary, tags=["Flights"],
           dependencies=[Depends(get_current_user)])
def restore_seat(id: int):
    """
    Increase available seat count by 1 (releases a seat on booking cancellation).

    **Authentication:** Requires a valid JWT Bearer token (any role).
    **Called by:** booking-service on DELETE /booking/{id}, forwarding the caller's token.

    **Logic:**
    - Validates the flight exists (HTTP 404 if not).
    - Increments available_seats by 1 and returns the updated flight.
    - No upper-bound check — restoring beyond original capacity is intentionally
      allowed to handle edge cases in distributed state.
    """
    flight = _get_flight_or_404(id)

    updated = flight.model_copy(update={"available_seats": flight.available_seats + 1})
    flights_db[id] = updated

    return FlightSummary(
        message=f"Seat successfully restored on flight {updated.flight_number}.",
        flight=updated,
    )
