"""
Booking Service - FastAPI Microservice
Handles flight bookings and communicates with the Flight Service
for seat availability checks and seat count management.
"""

import os
import uuid
from typing import Optional
from datetime import datetime

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Flight Service base URL — override via environment variable in Docker/K8s
FLIGHT_SERVICE_URL = os.getenv("FLIGHT_SERVICE_URL", "http://host.docker.internal:8000")

# ---------------------------------------------------------------------------
# FastAPI app initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Booking Service",
    description="Microservice for managing flight bookings in a distributed airline system.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# In-memory data store
# ---------------------------------------------------------------------------

# Mock booking store: { booking_id (str) -> booking dict }
bookings_db: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class BookingRequest(BaseModel):
    """Fields required to create a new booking."""
    flight_id: str = Field(..., description="ID of the flight to book")
    passenger_name: str = Field(..., min_length=2, description="Full name of the passenger")
    passenger_email: str = Field(..., description="Email address of the passenger")
    seat_class: Optional[str] = Field("economy", description="Seat class: economy, business, first")


class BookingResponse(BaseModel):
    """Shape of a booking returned by the API."""
    id: str
    flight_id: str
    passenger_name: str
    passenger_email: str
    seat_class: str
    status: str
    created_at: str


class ServiceStatus(BaseModel):
    """Root endpoint response."""
    service: str
    status: str

# ---------------------------------------------------------------------------
# Helper — Flight Service communication
# ---------------------------------------------------------------------------

def get_flight(flight_id: str) -> dict:
    """
    Fetch flight details from the Flight Service.
    Raises HTTPException if the service is unreachable or the flight is not found.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}"
    try:
        response = requests.get(url, timeout=5)
    except requests.exceptions.ConnectionError:
        # Flight Service is down or unreachable
        raise HTTPException(
            status_code=503,
            detail="Flight Service is unavailable. Please try again later.",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Flight Service did not respond in time.",
        )

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Flight '{flight_id}' not found.")

    # 422 means the flight_id value failed validation on the Flight Service side
    if response.status_code == 422:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid flight_id '{flight_id}'. Check the Flight Service for valid IDs (GET /flights).",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Flight Service returned an unexpected error (HTTP {response.status_code}).",
        )

    return response.json()


def decrement_seat(flight_id: str) -> None:
    """
    Call PATCH /flight/{id}/seat on the Flight Service to reduce the
    available seat count by 1 after a successful booking.
    Raises HTTPException if the operation fails.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}/seat"
    try:
        response = requests.patch(url, timeout=5)
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Flight Service is unavailable. Seat count could not be decremented.",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Flight Service timed out while decrementing seat count.",
        )

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Flight '{flight_id}' not found during seat update.")

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=502,
            detail=f"Failed to decrement seat count (HTTP {response.status_code}).",
        )


def increment_seat(flight_id: str) -> None:
    """
    Call PATCH /flight/{id}/seat/restore on the Flight Service to add back
    1 seat when a booking is cancelled. Failure is logged but does not block
    the deletion — the booking is already removed from the local store.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}/seat/restore"
    try:
        response = requests.patch(url, timeout=5)
        if response.status_code not in (200, 204):
            # Non-fatal: booking is deleted; seat restore is best-effort
            print(f"Warning: seat restore for flight '{flight_id}' returned HTTP {response.status_code}")
    except requests.exceptions.RequestException as exc:
        # Non-fatal: do not block the delete if Flight Service is unreachable
        print(f"Warning: could not restore seat for flight '{flight_id}': {exc}")

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", response_model=ServiceStatus, tags=["Health"])
def root():
    """Root health-check endpoint."""
    return {"service": "Booking Service", "status": "running"}


@app.get("/bookings", response_model=list[BookingResponse], tags=["Bookings"])
def get_all_bookings():
    """Return a list of all bookings stored in memory."""
    return list(bookings_db.values())


@app.get("/booking/{id}", response_model=BookingResponse, tags=["Bookings"])
def get_booking(id: str):
    """
    Return a single booking by its ID.
    Returns 404 if the booking does not exist.
    """
    booking = bookings_db.get(id)
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{id}' not found.")
    return booking


@app.post("/booking", response_model=BookingResponse, status_code=201, tags=["Bookings"])
def create_booking(payload: BookingRequest):
    """
    Create a new flight booking.

    Booking creation logic:
      1. Validate all required fields via Pydantic (automatic).
      2. Check seat availability by calling GET /flight/{id} on the Flight Service.
      3. If available_seats <= 0, return HTTP 409 (Conflict) — no seats left.
      4. If seats are available, persist the booking in memory.
      5. Decrement the seat count on the Flight Service via PATCH /flight/{id}/seat.
      6. Return the created booking with HTTP 201.
    """

    # --- Step 1: Validate seat_class value ---
    valid_classes = {"economy", "business", "first"}
    if payload.seat_class not in valid_classes:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid seat_class '{payload.seat_class}'. Must be one of: {', '.join(valid_classes)}.",
        )

    # --- Step 2: Flight availability check ---
    # Query the Flight Service to confirm the flight exists and has open seats.
    flight = get_flight(payload.flight_id)

    available_seats = flight.get("available_seats", 0)

    # --- Step 3: Reject booking if no seats remain ---
    if available_seats <= 0:
        raise HTTPException(
            status_code=409,
            detail=f"No seats available on flight '{payload.flight_id}'.",
        )

    # --- Step 4: Persist the new booking ---
    booking_id = str(uuid.uuid4())
    new_booking = {
        "id": booking_id,
        "flight_id": payload.flight_id,
        "passenger_name": payload.passenger_name,
        "passenger_email": payload.passenger_email,
        "seat_class": payload.seat_class,
        "status": "confirmed",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    bookings_db[booking_id] = new_booking

    # --- Step 5: Decrement seat count on the Flight Service ---
    # This keeps the flight's available_seats in sync with confirmed bookings.
    decrement_seat(payload.flight_id)

    # --- Step 6: Return the created booking ---
    return new_booking


@app.delete("/booking/{id}", status_code=200, tags=["Bookings"])
def delete_booking(id: str):
    """
    Cancel and delete a booking by ID.

    Deletion logic:
      1. Look up the booking — return 404 if it does not exist.
      2. Remove the booking from the in-memory store.
      3. Attempt to restore the seat count on the Flight Service (best-effort).
         If the Flight Service is unavailable the booking is still deleted locally.
      4. Return a confirmation message with HTTP 200.
    """
    # --- Step 1: Check booking exists ---
    booking = bookings_db.get(id)
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{id}' not found.")

    flight_id = booking["flight_id"]

    # --- Step 2: Remove booking from store ---
    del bookings_db[id]

    # --- Step 3: Restore the seat on the Flight Service ---
    # Best-effort: a warning is printed if this fails, but the delete still succeeds.
    increment_seat(flight_id)

    # --- Step 4: Confirm deletion ---
    return {"message": f"Booking '{id}' has been cancelled successfully."}
