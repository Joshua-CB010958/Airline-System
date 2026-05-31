"""
Booking Service — FastAPI Microservice
──────────────────────────────────────
Manages flight bookings and coordinates with the Flight Service for seat
availability checks and seat count management.

Phase 4 Security
────────────────
All endpoints are protected with JWT authentication via the shared auth module.
Service-to-service calls to the Flight Service forward the caller's Bearer token
so that the Flight Service can independently verify the request (zero-trust).

Phase 5 — Event Publishing
──────────────────────────
After a booking is successfully created the service publishes a JSON event to
an Amazon SNS topic so that downstream consumers (e.g. notification, baggage
services) can react without polling.

Role matrix:
  GET  /bookings          — passenger, staff, admin
  GET  /booking/{id}      — passenger, staff, admin
  POST /booking           — passenger, staff, admin
  DELETE /booking/{id}    — staff, admin only
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

import boto3
import requests
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from .auth import get_current_user, require_roles

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────
# Override via environment variable when running in Docker / Kubernetes.
FLIGHT_SERVICE_URL = os.getenv("FLIGHT_SERVICE_URL", "http://host.docker.internal:8000")

# SNS topic that receives booking-created events.
# Falls back to the project ARN if the environment variable is not set.
SNS_TOPIC_ARN = os.getenv(
    "SNS_TOPIC_ARN",
    "arn:aws:sns:eu-west-1:180571023460:alms-booking-topic",
)

# AWS region — must match the region in the topic ARN.
AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")

# ── SNS Client ─────────────────────────────────────────────────────────────────
# Boto3 client is created once at startup; subsequent calls reuse the connection.
# Credentials are resolved via the standard boto3 chain:
#   1. Environment variables (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
#   2. ~/.aws/credentials
#   3. IAM instance/task role (recommended for production)
sns_client = boto3.client("sns", region_name=AWS_REGION)

# ── FastAPI Application ────────────────────────────────────────────────────────

app = FastAPI(
    title="Booking Service",
    description="""
## Booking Microservice

Part of the Distributed Airline Management System.

### Authentication
All endpoints require a valid **JWT Bearer token** issued by the
**Auth Service** running on port 8003.

1. Obtain a token: `POST http://localhost:8003/login`
2. Click **Authorize** (top-right) and enter: `Bearer <your_token>`

### Role permissions
| Endpoint              | passenger | staff | admin |
|-----------------------|:---------:|:-----:|:-----:|
| GET /bookings         | ✓         | ✓     | ✓     |
| GET /booking/{id}     | ✓         | ✓     | ✓     |
| POST /booking         | ✓         | ✓     | ✓     |
| DELETE /booking/{id}  |           | ✓     | ✓     |
""",
    version="1.0.0",
)

# ── In-Memory Store ────────────────────────────────────────────────────────────
bookings_db: dict[str, dict] = {}


# ── Pydantic Models ────────────────────────────────────────────────────────────

class BookingRequest(BaseModel):
    """Fields required to create a new booking."""
    flight_id: str = Field(..., description="ID of the flight to book")
    passenger_name: str = Field(..., min_length=2, description="Full name of the passenger")
    passenger_email: str = Field(..., description="Email address of the passenger")
    seat_class: Optional[str] = Field("economy", description="Seat class: economy, business, first")


class BookingResponse(BaseModel):
    """Shape of a booking record returned by the API."""
    id: str
    flight_id: str
    passenger_name: str
    passenger_email: str
    seat_class: str
    status: str
    created_at: str


class ServiceStatus(BaseModel):
    service: str
    status: str


# ── Service-to-Service Authorization ──────────────────────────────────────────
# When booking-service calls flight-service, it forwards the original caller's
# Bearer token. Flight-service then independently verifies that same JWT.
# This is the token-forwarding pattern for service-to-service auth in HS256.

def _forward_auth(request: Request) -> dict:
    """
    Extract the incoming Authorization header to forward to downstream services.
    Returns a headers dict ready to pass to requests.get() / requests.patch().
    """
    auth_header = request.headers.get("Authorization", "")
    return {"Authorization": auth_header}


def get_flight(flight_id: str, auth_headers: dict) -> dict:
    """
    Fetch flight details from the Flight Service.

    Service-to-service call: forwards the caller's Bearer token so that
    the Flight Service can verify auth independently.
    Raises HTTPException on network failure, 401, 404, or other errors.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}"
    try:
        response = requests.get(url, headers=auth_headers, timeout=5)
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Flight Service is unavailable. Please try again later.",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Flight Service did not respond in time.",
        )

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Service-to-service auth failed: token rejected by Flight Service.",
        )
    if response.status_code == 403:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service-to-service auth failed: insufficient role for Flight Service.",
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flight '{flight_id}' not found.",
        )
    if response.status_code == 422:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid flight_id '{flight_id}'. Check GET /flights for valid IDs.",
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Flight Service returned an unexpected error (HTTP {response.status_code}).",
        )

    return response.json()


def decrement_seat(flight_id: str, auth_headers: dict) -> None:
    """
    Decrease the available seat count by 1 on the Flight Service.

    Service-to-service call: forwards the caller's Bearer token.
    Called after a booking is successfully persisted.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}/seat"
    try:
        response = requests.patch(url, headers=auth_headers, timeout=5)
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Flight Service unavailable during seat decrement.",
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Flight Service timed out during seat decrement.",
        )

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Service-to-service auth failed during seat decrement.",
        )
    if response.status_code == 403:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role for seat decrement on Flight Service.",
        )
    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flight '{flight_id}' not found during seat update.",
        )
    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to decrement seat count (HTTP {response.status_code}).",
        )


def increment_seat(flight_id: str, auth_headers: dict) -> None:
    """
    Restore the seat count by 1 on the Flight Service when a booking is cancelled.

    Service-to-service call: forwards the caller's Bearer token.
    Best-effort: a warning is logged on failure but the booking deletion still succeeds.
    """
    url = f"{FLIGHT_SERVICE_URL}/flight/{flight_id}/seat/restore"
    try:
        response = requests.patch(url, headers=auth_headers, timeout=5)
        if response.status_code not in (200, 204):
            print(
                f"[booking-service] Warning: seat restore for flight '{flight_id}' "
                f"returned HTTP {response.status_code}"
            )
    except requests.exceptions.RequestException as exc:
        print(f"[booking-service] Warning: could not restore seat for flight '{flight_id}': {exc}")


# ── SNS Event Publisher ────────────────────────────────────────────────────────

def publish_booking_event(booking: dict) -> None:
    """
    Publish a booking-created event to Amazon SNS.

    Payload fields:
      - booking_id      — unique identifier of the new booking
      - passenger_name  — full name of the passenger
      - flight_id       — the flight the passenger booked
      - status          — booking status at publish time (always "confirmed" here)
      - timestamp       — ISO 8601 UTC timestamp of when the event was emitted

    The event is published *after* the booking has been persisted and the seat
    count decremented, so downstream consumers can trust the record exists.

    If the SNS publish call fails (network error, permission denied, invalid ARN,
    etc.) the error is logged and an HTTP 503 is raised so the caller knows the
    event was not delivered.  The booking itself has already been created at this
    point, so the error response describes a partial failure.
    """
    # Build the event payload; only the fields consumers need to act on.
    event_payload = {
        "booking_id": booking["id"],
        "passenger_name": booking["passenger_name"],
        "flight_id": booking["flight_id"],
        "status": booking["status"],
        # ISO 8601 timestamp generated at publish time (not booking creation time).
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Message=json.dumps(event_payload),
            Subject="booking.created",
        )
        logger.info(
            "[booking-service] SNS event published for booking '%s' on flight '%s'.",
            booking["id"],
            booking["flight_id"],
        )
    except ClientError as exc:
        # AWS returned an error response (e.g. AuthorizationError, InvalidParameter).
        logger.error(
            "[booking-service] SNS ClientError for booking '%s': %s",
            booking["id"],
            exc.response["Error"]["Message"],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Booking was created but the confirmation event could not be "
                f"published to SNS: {exc.response['Error']['Message']}"
            ),
        )
    except BotoCoreError as exc:
        # Low-level boto3 error (e.g. network failure, endpoint unreachable).
        logger.error(
            "[booking-service] SNS BotoCoreError for booking '%s': %s",
            booking["id"],
            str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Booking was created but the confirmation event could not be "
                f"published to SNS: {exc}"
            ),
        )


# ── Public Endpoints ───────────────────────────────────────────────────────────

@app.get("/", response_model=ServiceStatus, tags=["Health"])
def root():
    """Public health-check endpoint — no authentication required."""
    return {"service": "Booking Service", "status": "running"}


# ── Protected Endpoints — all authenticated roles ──────────────────────────────

@app.get("/bookings", response_model=list[BookingResponse], tags=["Bookings"],
         dependencies=[Depends(get_current_user)])
def get_all_bookings():
    """
    List all bookings.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 401 if the token is missing or invalid.
    """
    return list(bookings_db.values())


@app.get("/booking/{id}", response_model=BookingResponse, tags=["Bookings"],
         dependencies=[Depends(get_current_user)])
def get_booking(id: str):
    """
    Retrieve a single booking by ID.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 401 if token is missing/invalid, HTTP 404 if booking not found.
    """
    booking = bookings_db.get(id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking '{id}' not found.",
        )
    return booking


@app.post("/booking", response_model=BookingResponse, status_code=201, tags=["Bookings"],
          dependencies=[Depends(require_roles(["passenger", "staff", "admin"]))])
def create_booking(payload: BookingRequest, request: Request):
    """
    Create a new flight booking.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.

    **Service-to-service flow:**
    The caller's Bearer token is forwarded to the Flight Service for all
    downstream calls, so the Flight Service independently verifies auth.

    **Booking logic:**
    1. Validate seat_class value.
    2. Call Flight Service (GET /flight/{id}) — forwarding token — to check availability.
    3. Reject with HTTP 409 if no seats remain.
    4. Persist the booking in memory.
    5. Call Flight Service (PATCH /flight/{id}/seat) — forwarding token — to decrement seat.
    6. Publish a booking-created event to Amazon SNS.
    7. Return the created booking (HTTP 201).
    """
    # Step 1: Validate seat class
    valid_classes = {"economy", "business", "first"}
    if payload.seat_class not in valid_classes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid seat_class '{payload.seat_class}'. Must be one of: {sorted(valid_classes)}.",
        )

    # Extract header once; reuse for all downstream calls
    auth_headers = _forward_auth(request)

    # Step 2: Verify flight exists and has open seats (token forwarded)
    flight = get_flight(payload.flight_id, auth_headers)
    if flight.get("available_seats", 0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No seats available on flight '{payload.flight_id}'.",
        )

    # Step 3: Persist booking
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

    # Step 4: Decrement seat count on Flight Service (token forwarded)
    decrement_seat(payload.flight_id, auth_headers)

    # Step 5: Publish booking-created event to SNS.
    # Only reached after the booking is persisted and the seat decremented.
    # Raises HTTP 503 if the publish fails — see publish_booking_event() for details.
    publish_booking_event(new_booking)

    return new_booking


# ── Protected Endpoints — staff / admin only ───────────────────────────────────

@app.delete("/booking/{id}", status_code=200, tags=["Bookings"],
            dependencies=[Depends(require_roles(["staff", "admin"]))])
def delete_booking(id: str, request: Request):
    """
    Cancel and delete a booking by ID.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** staff, admin only.
    Returns HTTP 403 if a passenger attempts this action.

    **Deletion logic:**
    1. Look up booking — return HTTP 404 if not found.
    2. Remove booking from store.
    3. Call Flight Service (PATCH /flight/{id}/seat/restore) — forwarding token —
       to restore the freed seat (best-effort; booking is deleted even if this fails).
    """
    booking = bookings_db.get(id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking '{id}' not found.",
        )

    flight_id = booking["flight_id"]

    # Remove booking first so the response is consistent even if seat restore fails
    del bookings_db[id]

    # Best-effort seat restore — logs a warning on failure, does not block response
    increment_seat(flight_id, _forward_auth(request))

    return {"message": f"Booking '{id}' has been cancelled successfully."}
