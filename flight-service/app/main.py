"""
Flight Service - Microservice for managing flight data in a distributed airline system.
Provides endpoints to list flights, retrieve a single flight, and book a seat.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Flight Service",
    description="Microservice responsible for flight data and seat availability in the airline system.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class Flight(BaseModel):
    """Represents a single flight record."""
    id: int
    flight_number: str
    origin: str
    destination: str
    available_seats: int
    status: str


class FlightSummary(BaseModel):
    """Lightweight response wrapper returned after a seat booking."""
    message: str
    flight: Flight


# ---------------------------------------------------------------------------
# In-memory mock data store
# Keyed by flight ID for O(1) lookups.
# ---------------------------------------------------------------------------

flights_db: dict[int, Flight] = {
    1: Flight(id=1, flight_number="TMG101", origin="London",    destination="Dubai",     available_seats=120, status="On Time"),
    2: Flight(id=2, flight_number="TMG202", origin="Dubai",     destination="New York",  available_seats=85,  status="On Time"),
    3: Flight(id=3, flight_number="TMG303", origin="New York",  destination="Toronto",   available_seats=60,  status="Delayed"),
    4: Flight(id=4, flight_number="TMG404", origin="Toronto",   destination="London",    available_seats=200, status="On Time"),
    5: Flight(id=5, flight_number="TMG505", origin="Sydney",    destination="Singapore", available_seats=0,   status="Boarding"),
}

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_flight_or_404(flight_id: int) -> Flight:
    """
    Lookup a flight by ID.
    Raises HTTP 404 if no flight exists with that ID.
    """
    flight = flights_db.get(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail=f"Flight with ID {flight_id} not found.")
    return flight

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", summary="Health check", tags=["System"])
def root():
    """Root endpoint — confirms the service is running."""
    return {"service": "Flight Service", "status": "running"}


@app.get("/flights", response_model=List[Flight], summary="List all flights", tags=["Flights"])
def get_flights():
    """
    Endpoint purpose: Return every flight currently in the system.
    Returns a list of all flight objects from the in-memory store.
    """
    return list(flights_db.values())


@app.get("/flight/{id}", response_model=Flight, summary="Get a flight by ID", tags=["Flights"])
def get_flight(id: int):
    """
    Endpoint purpose: Retrieve a single flight by its unique integer ID.
    Returns HTTP 404 if no flight matches the given ID.
    """
    return _get_flight_or_404(id)


@app.patch(
    "/flight/{id}/seat",
    response_model=FlightSummary,
    summary="Book one seat on a flight",
    tags=["Flights"],
)
def book_seat(id: int):
    """
    Endpoint purpose: Decrement the available seat count by 1, simulating a seat booking.

    Business logic:
    - Retrieve the flight or return 404.
    - Validate that at least one seat is still available; return 409 if fully booked.
    - Reduce available_seats by 1 and persist the change in-memory.

    Validation logic:
    - available_seats must be > 0 before the decrement to prevent negative values.
    """
    flight = _get_flight_or_404(id)

    # Prevent overbooking — seat count must never go below zero.
    if flight.available_seats <= 0:
        raise HTTPException(
            status_code=409,
            detail=f"Flight {flight.flight_number} is fully booked. No seats available.",
        )

    # Apply the booking: create an updated Flight object and replace the record.
    updated = flight.model_copy(update={"available_seats": flight.available_seats - 1})
    flights_db[id] = updated

    return FlightSummary(
        message=f"Seat successfully booked on flight {updated.flight_number}.",
        flight=updated,
    )
