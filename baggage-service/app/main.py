"""
Baggage Service — FastAPI Microservice
───────────────────────────────────────
Manages airline baggage records stored in Amazon DynamoDB.

Phase 4 Security
────────────────
All endpoints are protected with JWT authentication via the shared auth module.
Baggage status updates are restricted to staff and admin roles.

Role matrix:
  GET  /baggage           — any authenticated user
  GET  /baggage/{id}      — any authenticated user
  POST /baggage           — staff, admin only
  PATCH /baggage/update   — staff, admin only
"""

import logging
import os
from decimal import Decimal

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional

from .auth import get_current_user, require_roles

logger = logging.getLogger(__name__)

# ── DynamoDB Setup ─────────────────────────────────────────────────────────────
# Table name is read from the environment; falls back to 'dams_baggage' when
# the variable is absent (local dev / CI without the env configured).
BAGGAGE_TABLE_NAME = os.environ.get("DYNAMODB_BAGGAGE_TABLE", "dams_baggage")

try:
    # boto3.resource provides a high-level Table interface that handles
    # attribute serialisation automatically (strings, Decimal numbers, etc.).
    _dynamodb = boto3.resource(
        "dynamodb",
        region_name=os.environ.get("AWS_DEFAULT_REGION", "eu-west-1"),
    )
    _table = _dynamodb.Table(BAGGAGE_TABLE_NAME)
except Exception as exc:
    logger.error("Failed to initialise DynamoDB resource: %s", exc)
    raise RuntimeError(f"DynamoDB initialisation failed: {exc}") from exc


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
| POST /baggage        |           | ✓     | ✓     |
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


class BaggageCreateRequest(BaseModel):
    """Payload accepted by POST /baggage. The id is generated server-side."""
    passenger_name: str = Field(..., description="Name of the passenger")
    flight_id: int = Field(..., description="ID of the associated flight")
    status: str = Field(..., description="Initial baggage status, e.g. 'Checked In'")
    location: str = Field(..., description="Current physical location")


class BaggageUpdateRequest(BaseModel):
    """Payload accepted by PATCH /baggage/update."""
    baggage_id: int = Field(..., description="ID of the baggage item to update")
    status: str = Field(..., description="New status for the baggage item")
    location: Optional[str] = Field(None, description="New physical location (optional)")


# ── DynamoDB Helpers ───────────────────────────────────────────────────────────

def _deserialise(item: dict) -> dict:
    """
    Convert DynamoDB Decimal values back to plain Python ints.
    DynamoDB returns all numbers as decimal.Decimal; Pydantic requires int
    for the id and flight_id fields.
    """
    return {
        "id":             int(item["id"]),
        "passenger_name": item["passenger_name"],
        "flight_id":      int(item["flight_id"]),
        "status":         item["status"],
        "location":       item["location"],
    }


def _get_baggage_item(baggage_id: int) -> dict:
    """
    Fetch a single record from DynamoDB by primary key (id).
    Raises HTTP 404 when the item does not exist.
    Raises HTTP 503 on DynamoDB connectivity or permission errors.
    """
    try:
        # GetItem is an O(1) key lookup — id is the partition key (Number type).
        response = _table.get_item(Key={"id": baggage_id})
    except (BotoCoreError, ClientError) as exc:
        logger.error("DynamoDB GetItem failed for id=%s: %s", baggage_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Baggage database is temporarily unavailable.",
        )

    item = response.get("Item")
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Baggage item with ID {baggage_id} not found.",
        )
    return _deserialise(item)


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
    try:
        # Scan reads every item in the table and is suitable for the small
        # baggage dataset in this demo.  For large-scale production use a
        # Query against a GSI instead.
        response = _table.scan()
    except (BotoCoreError, ClientError) as exc:
        logger.error("DynamoDB Scan failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Baggage database is temporarily unavailable.",
        )

    return [_deserialise(item) for item in response.get("Items", [])]


@app.get("/baggage/{id}", response_model=BaggageItem, tags=["Baggage"],
         dependencies=[Depends(get_current_user)])
def get_baggage(id: int):
    """
    Retrieve a single baggage item by ID.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** passenger, staff, admin.
    Returns HTTP 404 if the baggage item does not exist.
    """
    return _get_baggage_item(id)


# ── Protected Endpoints — staff / admin only ───────────────────────────────────

@app.post("/baggage", response_model=BaggageItem, status_code=status.HTTP_201_CREATED,
          tags=["Baggage"],
          dependencies=[Depends(require_roles(["staff", "admin"]))])
def create_baggage(payload: BaggageCreateRequest):
    """
    Create a new baggage record.

    **Authentication:** Requires a valid JWT Bearer token.
    **Roles allowed:** staff, admin only.
    Returns HTTP 403 if a passenger attempts this action.

    The numeric `id` is generated server-side as (current max id + 1).
    DynamoDB has no auto-increment, so we derive the next id from a table
    scan — adequate for this small demo dataset.
    """
    try:
        # Find the current highest id so the new record gets a unique key.
        # Projecting only the id keeps the scan payload minimal.
        response = _table.scan(ProjectionExpression="id")
    except (BotoCoreError, ClientError) as exc:
        logger.error("DynamoDB Scan failed during create: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Baggage database is temporarily unavailable.",
        )

    existing_ids = [int(item["id"]) for item in response.get("Items", [])]
    new_id = (max(existing_ids) + 1) if existing_ids else 1

    new_item = {
        "id": new_id,
        "passenger_name": payload.passenger_name,
        "flight_id": payload.flight_id,
        "status": payload.status,
        "location": payload.location,
    }

    try:
        # ConditionExpression guards against the rare race where the id was
        # taken between the scan and the write.
        _table.put_item(
            Item=new_item,
            ConditionExpression="attribute_not_exists(id)",
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("DynamoDB PutItem failed for id=%s: %s", new_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Baggage database is temporarily unavailable.",
        )

    return _deserialise(new_item)


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
    # Confirm the item exists before writing; raises 404 if not found.
    _get_baggage_item(payload.baggage_id)

    # Build the UpdateExpression dynamically so that location is only written
    # when the caller explicitly provides it; status is always updated.
    update_expr = "SET #s = :status"
    expr_names = {"#s": "status"}
    expr_values: dict = {":status": payload.status}

    if payload.location is not None:
        update_expr += ", #l = :location"
        expr_names["#l"] = "location"
        expr_values[":location"] = payload.location

    try:
        # UpdateItem writes only the changed attributes in-place; unchanged
        # fields are untouched in DynamoDB.  ReturnValues="ALL_NEW" returns
        # the complete record after the write so we can respond immediately.
        response = _table.update_item(
            Key={"id": payload.baggage_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("DynamoDB UpdateItem failed for id=%s: %s", payload.baggage_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Baggage database is temporarily unavailable.",
        )

    # Deserialise Decimal numbers before returning to Pydantic / FastAPI.
    return _deserialise(response["Attributes"])
