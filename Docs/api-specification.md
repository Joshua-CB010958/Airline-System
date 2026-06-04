# API Specification
## Distributed Airline Management System

---

**Document Type:** API Reference Manual  
**Classification:** Technical Specification  
**Version:** 1.0  
**Architecture:** Microservices — FastAPI / AWS Lambda  
**Authentication:** JWT (HS256) with Role-Based Access Control  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication Model](#2-authentication-model)
3. [Service API Reference](#3-service-api-reference)
   - 3.1 [Authentication Service](#31-authentication-service)
   - 3.2 [Booking Service](#32-booking-service)
   - 3.3 [Flight Service](#33-flight-service)
   - 3.4 [Baggage Service](#34-baggage-service)
   - 3.5 [Notification Service](#35-notification-service)
4. [Security and Access Control Matrix](#4-security-and-access-control-matrix)
5. [Request and Response Examples](#5-request-and-response-examples)
6. [Error Handling](#6-error-handling)
7. [Data Flow Notes](#7-data-flow-notes)
8. [Implementation Notes](#8-implementation-notes)
9. [Conclusion](#9-conclusion)

---

## 1. Overview

The Distributed Airline Management System exposes its functionality through a suite of independently deployable RESTful microservices, each responsible for a discrete operational domain. Services communicate over HTTP using JSON as the canonical data interchange format. All inter-service and client-facing communication is governed by a shared JWT-based security model, ensuring that authentication decisions are made consistently across service boundaries without requiring a centralised authentication gateway on every request path.

The five core services — Authentication, Booking, Flight, Baggage, and Notification — are containerised independently using Docker and are reachable on distinct ports. This separation enforces loose coupling and allows each service to be scaled, updated, or replaced independently.

Security is enforced uniformly through Bearer token validation at each service. Role-based access control (RBAC) is applied at the endpoint level, restricting operations to authorised user roles. The three defined roles — `passenger`, `staff`, and `admin` — encode a tiered privilege model aligned with real-world airline operational requirements.

---

## 2. Authentication Model

### 2.1 Token Issuance

Authentication is performed exclusively through the Authentication Service. A client submits valid credentials to `POST /login`, and the service returns a signed JSON Web Token (JWT). This token encodes the caller's identity and role and is valid for **30 minutes** from the time of issuance.

**JWT Payload Claims:**

| Claim | Type   | Description                                   |
|-------|--------|-----------------------------------------------|
| `sub` | string | Username of the authenticated user            |
| `role`| string | Assigned role: `passenger`, `staff`, or `admin` |
| `exp` | integer| POSIX timestamp indicating token expiry       |

Tokens are signed using the HMAC-SHA256 algorithm (HS256) with a shared secret key distributed to all services at deployment time.

### 2.2 Token Usage

For all protected endpoints, clients must include the JWT in the HTTP `Authorization` header using the Bearer scheme:

```
Authorization: Bearer <token>
```

Each service independently verifies the token signature and expiry using the shared secret key. No network call to the Authentication Service is required at verification time — validation is performed locally within each service using the `python-jose` library.

### 2.3 Role-Based Access Control

Endpoints are protected by a `require_roles()` dependency factory. When invoked, this dependency first validates the JWT (via `get_current_user()`), then asserts that the authenticated user's role is present in the endpoint's permitted role list. If the role check fails, the service returns `403 Forbidden`. If the token is absent or invalid, the service returns `401 Unauthorized`.

**Defined Roles:**

| Role        | Description                                                              |
|-------------|--------------------------------------------------------------------------|
| `passenger` | Standard end user. May view and create bookings, view flights and baggage. |
| `staff`     | Airline operational staff. All passenger privileges plus booking cancellation and baggage status updates. |
| `admin`     | System administrator. Full access to all endpoints across all services.  |

---

## 3. Service API Reference

---

### 3.1 Authentication Service

| Property              | Value                               |
|-----------------------|-------------------------------------|
| **Base URL**          | `http://localhost:8003`             |
| **Purpose**           | Issues JWT tokens; exposes current user profile and role-scoped sample endpoints |
| **Authentication**    | Required for `/me` and role-scoped endpoints; not required for `/login` or `/health` |
| **Role Restrictions** | See per-endpoint detail below       |

---

#### `GET /health`

**Purpose:** Public health probe for uptime checks.

**Authentication Required:** No

**Allowed Roles:** Public — no token required

**Request Example:**
```
GET /health HTTP/1.1
Host: localhost:8003
```

**Response Body (200 OK):**
```json
{
  "status": "healthy",
  "service": "airline-auth-service",
  "port": 8003
}
```

**Success Status Code:** `200 OK`

---

#### `POST /login`

**Purpose:** Authenticates a user against stored credentials and returns a signed JWT.

**Authentication Required:** No

**Allowed Roles:** Public — no token required

**Request Format:** `application/x-www-form-urlencoded`

| Field      | Type   | Required | Description               |
|------------|--------|----------|---------------------------|
| `username` | string | Yes      | Registered username       |
| `password` | string | Yes      | Plaintext password        |

**Request Example:**
```
POST /login HTTP/1.1
Host: localhost:8003
Content-Type: application/x-www-form-urlencoded

username=passenger1&password=password123
```

**Response Body (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXNzZW5nZXIxIiwicm9sZSI6InBhc3NlbmdlciIsImV4cCI6MTcwMDAwMDAwMH0.abc123",
  "token_type": "bearer"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                                 |
|------|-------------------------------------------|
| 401  | Username does not exist or password is incorrect |
| 422  | Missing `username` or `password` field    |

---

#### `GET /me`

**Purpose:** Returns the profile of the currently authenticated user as decoded from the submitted JWT.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Example:**
```
GET /me HTTP/1.1
Host: localhost:8003
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "username": "passenger1",
  "role": "passenger",
  "full_name": "Passenger One",
  "email": "passenger1@airline.com"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                                           |
|------|-----------------------------------------------------|
| 401  | Token absent, malformed, expired, or has invalid signature |

---

#### `GET /bookings/create`

**Purpose:** Returns a simulated booking response for authenticated users.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Example:**
```
GET /bookings/create HTTP/1.1
Host: localhost:8003
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "message": "Booking successfully created by 'passenger1'.",
  "booked_by_role": "passenger",
  "booking_ref": "BK-20260525-001"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |
| 403  | Role not permitted      |

---

#### `GET /staff/flights`

**Purpose:** Returns a role-restricted flight management payload.

**Authentication Required:** Yes

**Allowed Roles:** `staff`, `admin`

**Request Example:**
```
GET /staff/flights HTTP/1.1
Host: localhost:8003
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "message": "Flight management access granted to 'staff1'.",
  "role": "staff",
  "flights": [
    {"id": "FL001", "route": "CMB → LHR", "status": "On Time"}
  ]
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |
| 403  | Role not permitted      |

---

#### `GET /admin/users`

**Purpose:** Lists all users in the auth store (admin only).

**Authentication Required:** Yes

**Allowed Roles:** `admin`

**Request Example:**
```
GET /admin/users HTTP/1.1
Host: localhost:8003
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "requested_by": "admin1",
  "users": [
    {"username": "admin1", "role": "admin", "email": "admin1@airline.com", "full_name": "Alice Admin"}
  ]
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |
| 403  | Role not permitted      |

---

### 3.2 Booking Service

| Property              | Value                                                                 |
|-----------------------|-----------------------------------------------------------------------|
| **Base URL**          | `http://localhost:8001`                                               |
| **Purpose**           | Manages flight bookings. Validates flight availability by calling the Flight Service before confirming a booking. |
| **Authentication**    | Required for all listed endpoints except `/`                          |
| **Role Restrictions** | See per-endpoint detail below                                         |
| **Upstream Dependency** | Flight Service at `http://localhost:8000` (configurable via `FLIGHT_SERVICE_URL`) |
| **Data Store**        | Aurora PostgreSQL (SQLAlchemy) |

---

#### `GET /`

**Purpose:** Public health probe for uptime checks.

**Authentication Required:** No

**Allowed Roles:** Public — no token required

**Request Example:**
```
GET / HTTP/1.1
Host: localhost:8001
```

**Response Body (200 OK):**
```json
{
  "service": "Booking Service",
  "status": "running"
}
```

**Success Status Code:** `200 OK`

---

#### `GET /bookings`

**Purpose:** Retrieves all bookings currently held in the system.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Example:**
```
GET /bookings HTTP/1.1
Host: localhost:8001
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "flight_id": "1",
    "passenger_name": "Alice Johnson",
    "passenger_email": "alice@example.com",
    "seat_class": "economy",
    "status": "confirmed",
    "created_at": "2024-11-15T10:30:00"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "flight_id": "2",
    "passenger_name": "Bob Smith",
    "passenger_email": "bob@example.com",
    "seat_class": "business",
    "status": "confirmed",
    "created_at": "2024-11-15T11:00:00"
  }
]
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |
| 503  | Booking database is unavailable |

---

#### `GET /booking/{id}`

**Purpose:** Retrieves a single booking record by its unique identifier.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Path Parameters:**

| Parameter | Type   | Description                   |
|-----------|--------|-------------------------------|
| `id`      | string | UUID of the booking to retrieve |

**Request Example:**
```
GET /booking/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8001
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "flight_id": "1",
  "passenger_name": "Alice Johnson",
  "passenger_email": "alice@example.com",
  "seat_class": "economy",
  "status": "confirmed",
  "created_at": "2024-11-15T10:30:00"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                              |
|------|----------------------------------------|
| 401  | Invalid or absent token                |
| 404  | No booking found for the provided `id` |
| 503  | Booking database is unavailable        |

---

#### `POST /booking`

**Purpose:** Creates a new booking. The service validates that the specified flight exists and has available seats before persisting the booking. On success, a seat is decremented in the Flight Service via an internal `PATCH` call.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Body:** `application/json`

| Field              | Type   | Required | Constraints                                  |
|--------------------|--------|----------|----------------------------------------------|
| `flight_id`        | string | Yes      | Must correspond to an existing flight        |
| `passenger_name`   | string | Yes      | Minimum length: 2 characters                 |
| `passenger_email`  | string | Yes      | Must be a valid email address                |
| `seat_class`       | string | No       | One of: `economy`, `business`, `first`. Defaults to `economy` |

**Request Example:**
```json
{
  "flight_id": "1",
  "passenger_name": "Alice Johnson",
  "passenger_email": "alice@example.com",
  "seat_class": "economy"
}
```

**Response Body (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "flight_id": "1",
  "passenger_name": "Alice Johnson",
  "passenger_email": "alice@example.com",
  "seat_class": "economy",
  "status": "confirmed",
  "created_at": "2024-11-15T10:30:00"
}
```

**Success Status Code:** `201 Created`

**Processing Steps:**
1. Validates `seat_class` is one of the accepted values.
2. Calls `GET /flight/{flight_id}` on the Flight Service, forwarding the caller's Bearer token.
3. Verifies that `available_seats > 0`; returns `409` if the flight is fully booked.
4. Persists the booking record in Aurora PostgreSQL with a generated UUID.
5. Calls `PATCH /flight/{flight_id}/seat` on the Flight Service to decrement seat count.
6. Publishes a booking-created event to Amazon SNS.
7. Returns the created booking.

**Error Responses:**

| Code | Condition                                                                |
|------|--------------------------------------------------------------------------|
| 401  | Invalid or absent token                                                  |
| 403  | Authenticated role not in permitted list                                 |
| 404  | `flight_id` does not correspond to a known flight                        |
| 409  | Flight has no remaining available seats                                  |
| 422  | Request body is missing required fields or `seat_class` is not a valid value |
| 503  | Booking database is unavailable                                          |
| 503  | Flight Service is unreachable                                            |
| 504  | Flight Service did not respond within the timeout threshold              |

---

#### `DELETE /booking/{id}`

**Purpose:** Cancels and removes a booking from the system. On success, the corresponding seat is restored in the Flight Service via an internal `PATCH` call.

**Authentication Required:** Yes

**Allowed Roles:** `staff`, `admin`

**Path Parameters:**

| Parameter | Type   | Description                   |
|-----------|--------|-------------------------------|
| `id`      | string | UUID of the booking to cancel |

**Request Example:**
```
DELETE /booking/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8001
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "message": "Booking 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' has been cancelled successfully."
}
```

**Success Status Code:** `200 OK`

**Processing Steps:**
1. Validates that the booking exists; returns `404` if not found.
2. Removes the booking from Aurora PostgreSQL.
3. Calls `PATCH /flight/{flight_id}/seat/restore` on the Flight Service (best-effort; does not fail the request if the restore call is unsuccessful).
4. Returns a confirmation message.

**Error Responses:**

| Code | Condition                              |
|------|----------------------------------------|
| 401  | Invalid or absent token                |
| 403  | `passenger` role; operation not permitted |
| 404  | No booking found for the provided `id` |
| 503  | Booking database is unavailable       |

---

### 3.3 Flight Service

| Property              | Value                                                              |
|-----------------------|--------------------------------------------------------------------|
| **Base URL**          | `http://localhost:8000`                                            |
| **Purpose**           | Manages flight records and seat availability. Receives internal seat-management calls from the Booking Service. |
| **Authentication**    | Required for all listed endpoints except `/`                       |
| **Role Restrictions** | See per-endpoint detail below                                      |

---

#### `GET /`

**Purpose:** Public health probe for uptime checks.

**Authentication Required:** No

**Allowed Roles:** Public — no token required

**Request Example:**
```
GET / HTTP/1.1
Host: localhost:8000
```

**Response Body (200 OK):**
```json
{
  "service": "Flight Service",
  "status": "running"
}
```

**Success Status Code:** `200 OK`

---

#### `GET /flights`

**Purpose:** Returns the complete list of all flights currently held in the system.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Example:**
```
GET /flights HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
[
  {
    "id": 1,
    "flight_number": "TMG101",
    "origin": "London",
    "destination": "Dubai",
    "available_seats": 120,
    "status": "On Time"
  },
  {
    "id": 2,
    "flight_number": "TMG202",
    "origin": "Dubai",
    "destination": "New York",
    "available_seats": 85,
    "status": "On Time"
  }
]
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |

---

#### `GET /flight/{id}`

**Purpose:** Retrieves the record for a single flight identified by its numeric ID.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Path Parameters:**

| Parameter | Type    | Description                  |
|-----------|---------|------------------------------|
| `id`      | integer | Numeric identifier of the flight |

**Request Example:**
```
GET /flight/1 HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "id": 1,
  "flight_number": "TMG101",
  "origin": "London",
  "destination": "Dubai",
  "available_seats": 120,
  "status": "On Time"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                                |
|------|------------------------------------------|
| 401  | Invalid or absent token                  |
| 404  | No flight found for the provided `id`    |

---

#### `PATCH /flight/{id}/seat`

**Purpose:** Decrements the available seat count for a flight by one. This endpoint is called internally by the Booking Service upon successful booking creation and is not intended for direct client invocation.

**Authentication Required:** Yes (caller's token forwarded by Booking Service)

**Allowed Roles:** `passenger`, `staff`, `admin`

**Path Parameters:**

| Parameter | Type    | Description                       |
|-----------|---------|-----------------------------------|
| `id`      | integer | Numeric identifier of the flight  |

**Request Example:**
```
PATCH /flight/1/seat HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "message": "Seat booked successfully.",
  "flight": {
    "id": 1,
    "flight_number": "TMG101",
    "origin": "London",
    "destination": "Dubai",
    "available_seats": 119,
    "status": "On Time"
  }
}
```

**Success Status Code:** `200 OK`

**Processing Steps:**
1. Validates that the flight exists; returns `404` if not found.
2. Checks that `available_seats > 0`; returns `409` if the flight is fully booked.
3. Decrements `available_seats` by 1.
4. Returns the updated flight record.

**Error Responses:**

| Code | Condition                              |
|------|----------------------------------------|
| 401  | Invalid or absent token                |
| 404  | No flight found for the provided `id`  |
| 409  | Flight has no remaining available seats |

---

#### `PATCH /flight/{id}/seat/restore`

**Purpose:** Increments the available seat count for a flight by one. This endpoint is called internally by the Booking Service upon booking cancellation to restore the seat to the flight inventory.

**Authentication Required:** Yes (caller's token forwarded by Booking Service)

**Allowed Roles:** `passenger`, `staff`, `admin`

**Path Parameters:**

| Parameter | Type    | Description                       |
|-----------|---------|-----------------------------------|
| `id`      | integer | Numeric identifier of the flight  |

**Request Example:**
```
PATCH /flight/1/seat/restore HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "message": "Seat restored successfully.",
  "flight": {
    "id": 1,
    "flight_number": "TMG101",
    "origin": "London",
    "destination": "Dubai",
    "available_seats": 121,
    "status": "On Time"
  }
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                              |
|------|----------------------------------------|
| 401  | Invalid or absent token                |
| 404  | No flight found for the provided `id`  |

---

### 3.4 Baggage Service

| Property              | Value                                                              |
|-----------------------|--------------------------------------------------------------------|
| **Base URL**          | `http://localhost:8002`                                            |
| **Purpose**           | Tracks the status and location of passenger baggage items in DynamoDB. Staff and admins may update baggage records; passengers may only view them. |
| **Authentication**    | Required for all listed endpoints except `/`                       |
| **Role Restrictions** | See per-endpoint detail below                                      |
| **Data Store**        | Amazon DynamoDB (`dams_baggage`) |

---

#### `GET /`

**Purpose:** Public health probe for uptime checks.

**Authentication Required:** No

**Allowed Roles:** Public — no token required

**Request Example:**
```
GET / HTTP/1.1
Host: localhost:8002
```

**Response Body (200 OK):**
```json
{
  "service": "Baggage Service",
  "status": "running"
}
```

**Success Status Code:** `200 OK`

---

#### `GET /baggage`

**Purpose:** Returns all baggage records currently held in the system.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Request Example:**
```
GET /baggage HTTP/1.1
Host: localhost:8002
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
[
  {
    "id": 1,
    "passenger_name": "Josh Perera",
    "flight_id": 1,
    "status": "Checked In",
    "location": "Heathrow Airport"
  },
  {
    "id": 2,
    "passenger_name": "Sarah Mendis",
    "flight_id": 2,
    "status": "In Transit",
    "location": "Dubai International Airport"
  }
]
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition              |
|------|------------------------|
| 401  | Invalid or absent token |

---

#### `GET /baggage/{id}`

**Purpose:** Retrieves the record for a single baggage item identified by its numeric ID.

**Authentication Required:** Yes

**Allowed Roles:** `passenger`, `staff`, `admin`

**Path Parameters:**

| Parameter | Type    | Description                       |
|-----------|---------|-----------------------------------|
| `id`      | integer | Numeric identifier of the baggage item |

**Request Example:**
```
GET /baggage/1 HTTP/1.1
Host: localhost:8002
Authorization: Bearer <token>
```

**Response Body (200 OK):**
```json
{
  "id": 1,
  "passenger_name": "Josh Perera",
  "flight_id": 1,
  "status": "Checked In",
  "location": "Heathrow Airport"
}
```

**Success Status Code:** `200 OK`

**Error Responses:**

| Code | Condition                                    |
|------|----------------------------------------------|
| 401  | Invalid or absent token                      |
| 404  | No baggage record found for the provided `id` |
| 503  | Baggage database is unavailable              |

---

#### `PATCH /baggage/update`

**Purpose:** Updates the status and optionally the location of an existing baggage item. This operation is restricted to staff and admin roles, reflecting the operational privilege required to modify baggage tracking data.

**Authentication Required:** Yes

**Allowed Roles:** `staff`, `admin`

**Request Body:** `application/json`

| Field        | Type    | Required | Description                                                  |
|--------------|---------|----------|--------------------------------------------------------------|
| `baggage_id` | integer | Yes      | Numeric identifier of the baggage item to update            |
| `status`     | string  | Yes      | New status value (e.g., `Checked In`, `In Transit`, `Arrived`, `Lost`) |
| `location`   | string  | No       | Updated location descriptor; existing value retained if omitted |

**Request Example:**
```json
{
  "baggage_id": 2,
  "status": "Arrived",
  "location": "Bandaranaike International Airport"
}
```

**Response Body (200 OK):**
```json
{
  "id": 2,
  "passenger_name": "Sarah Mendis",
  "flight_id": 2,
  "status": "Arrived",
  "location": "Bandaranaike International Airport"
}
```

**Success Status Code:** `200 OK`

**Processing Steps:**
1. Validates that the baggage item identified by `baggage_id` exists; returns `404` if not found.
2. Updates the `status` field with the provided value.
3. Updates the `location` field if a value was provided; leaves the existing value unchanged otherwise.
4. Returns the updated baggage record.

**Error Responses:**

| Code | Condition                                          |
|------|----------------------------------------------------|
| 401  | Invalid or absent token                            |
| 403  | `passenger` role; operation not permitted          |
| 404  | No baggage record found for the provided `baggage_id` |
| 422  | Request body is missing `baggage_id` or `status`  |
| 503  | Baggage database is unavailable                    |

---

### 3.5 Notification Service

| Property              | Value                                               |
|-----------------------|-----------------------------------------------------|
| **Architecture**      | AWS Lambda (serverless, event-driven)               |
| **Purpose**           | Dispatches notifications to passengers in response to booking lifecycle events |
| **Public API**        | None — this service exposes no HTTP endpoints        |
| **Trigger Mechanism** | Asynchronous event consumption                      |

The Notification Service is implemented as a serverless AWS Lambda function and does not expose a public HTTP API. It operates exclusively as an event-driven consumer. Booking lifecycle events — such as booking confirmation — are published by the Booking Service and consumed asynchronously by the Lambda function, which subsequently dispatches the appropriate passenger notifications.

This design decouples notification delivery from the synchronous booking request path, ensuring that transient notification failures do not affect the reliability or response latency of the Booking Service.

**Trigger Events:**

| Event                  | Source Service  | Description                                         |
|------------------------|-----------------|-----------------------------------------------------|
| Booking Confirmed      | Booking Service | Emitted when `POST /booking` completes successfully |

Because the Notification Service has no directly callable endpoints, it is not included in the access control matrix and does not participate in the JWT authentication flow.

---

## 4. Security and Access Control Matrix

The following table summarises role-based access permissions across all publicly accessible API endpoints. A tick (✓) indicates that the role is permitted to call the endpoint. A dash (—) indicates the role is explicitly denied and will receive a `403 Forbidden` response.

| Service          | Endpoint                        | Method | `passenger` | `staff` | `admin` |
|------------------|---------------------------------|--------|:-----------:|:-------:|:-------:|
| **Auth**         | `/login`                        | POST   | ✓ (public)  | ✓       | ✓       |
| **Auth**         | `/me`                           | GET    | ✓           | ✓       | ✓       |
| **Auth**         | `/health`                       | GET    | ✓ (public)  | ✓       | ✓       |
| **Auth**         | `/bookings/create`              | GET    | ✓           | ✓       | ✓       |
| **Auth**         | `/staff/flights`                | GET    | —           | ✓       | ✓       |
| **Auth**         | `/admin/users`                  | GET    | —           | —       | ✓       |
| **Booking**      | `/`                             | GET    | ✓ (public)  | ✓       | ✓       |
| **Booking**      | `/bookings`                     | GET    | ✓           | ✓       | ✓       |
| **Booking**      | `/booking/{id}`                 | GET    | ✓           | ✓       | ✓       |
| **Booking**      | `/booking`                      | POST   | ✓           | ✓       | ✓       |
| **Booking**      | `/booking/{id}`                 | DELETE | —           | ✓       | ✓       |
| **Flight**       | `/`                             | GET    | ✓ (public)  | ✓       | ✓       |
| **Flight**       | `/flights`                      | GET    | ✓           | ✓       | ✓       |
| **Flight**       | `/flight/{id}`                  | GET    | ✓           | ✓       | ✓       |
| **Flight**       | `/flight/{id}/seat`             | PATCH  | ✓ (internal)| ✓       | ✓       |
| **Flight**       | `/flight/{id}/seat/restore`     | PATCH  | ✓ (internal)| ✓       | ✓       |
| **Baggage**      | `/`                             | GET    | ✓ (public)  | ✓       | ✓       |
| **Baggage**      | `/baggage`                      | GET    | ✓           | ✓       | ✓       |
| **Baggage**      | `/baggage/{id}`                 | GET    | ✓           | ✓       | ✓       |
| **Baggage**      | `/baggage/update`               | PATCH  | —           | ✓       | ✓       |

> **Note:** The `PATCH /flight/{id}/seat` and `PATCH /flight/{id}/seat/restore` endpoints accept any authenticated token. In normal operation, the token forwarded is that of the original requesting user. Direct invocation by a `passenger` is technically permitted at the JWT layer, but this path should be considered internal to the system and not exposed in client-facing documentation.

---

## 5. Request and Response Examples

### 5.1 Complete Booking Workflow

**Step 1 — Authenticate:**
```http
POST /login HTTP/1.1
Host: localhost:8003
Content-Type: application/x-www-form-urlencoded

username=passenger1&password=password123
```
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Step 2 — Query available flights:**
```http
GET /flights HTTP/1.1
Host: localhost:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```json
[
  { "id": 1, "flight_number": "TMG101", "origin": "London", "destination": "Dubai", "available_seats": 120, "status": "On Time" }
]
```

**Step 3 — Create booking:**
```http
POST /booking HTTP/1.1
Host: localhost:8001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "flight_id": "1",
  "passenger_name": "Alice Johnson",
  "passenger_email": "alice@example.com",
  "seat_class": "economy"
}
```
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "flight_id": "1",
  "passenger_name": "Alice Johnson",
  "passenger_email": "alice@example.com",
  "seat_class": "economy",
  "status": "confirmed",
  "created_at": "2024-11-15T10:30:00"
}
```

---

### 5.2 Baggage Status Update (Staff)

```http
PATCH /baggage/update HTTP/1.1
Host: localhost:8002
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "baggage_id": 5,
  "status": "Located",
  "location": "Dubai International Airport — Lost and Found"
}
```
```json
{
  "id": 5,
  "passenger_name": "Nimal Wickrama",
  "flight_id": 2,
  "status": "Located",
  "location": "Dubai International Airport — Lost and Found"
}
```

---

### 5.3 Booking Cancellation (Staff)

```http
DELETE /booking/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```json
{
  "message": "Booking 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' has been cancelled successfully."
}
```

---

### 5.4 Error Response — Forbidden

```http
DELETE /booking/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: localhost:8001
Authorization: Bearer <passenger-token>
```
```json
{
  "detail": "Access denied: insufficient role."
}
```

---

## 6. Error Handling

All services return structured JSON error bodies conforming to the following format:

```json
{
  "detail": "<human-readable description of the error>"
}
```

For `401 Unauthorized` responses, services additionally include the following HTTP header to indicate the expected authentication scheme:

```
WWW-Authenticate: Bearer
```

**Standard HTTP Status Codes:**

| Code | Status Text           | When Returned                                                                                          |
|------|-----------------------|--------------------------------------------------------------------------------------------------------|
| 400  | Bad Request           | The request is structurally invalid and cannot be processed. Distinct from validation failures.         |
| 401  | Unauthorized          | The `Authorization` header is absent, the token is malformed, the signature is invalid, or the token has expired. |
| 403  | Forbidden             | The token is valid but the authenticated user's role does not have permission to access the requested resource. |
| 404  | Not Found             | The resource identified by the provided path parameter does not exist in the system.                   |
| 409  | Conflict              | The request is valid but cannot be fulfilled due to the current state of the resource — for example, booking a flight with no available seats. |
| 422  | Unprocessable Entity  | FastAPI could not parse or validate the request body against the expected Pydantic schema. The response body includes field-level detail. |
| 503  | Service Unavailable   | A required downstream service (e.g., Flight Service) is unreachable.                                   |
| 504  | Gateway Timeout       | A required downstream service did not respond within the configured timeout period.                    |

---

## 7. Data Flow Notes

### 7.1 Booking Service — Flight Service Integration

When a booking creation request is received by the Booking Service, the service orchestrates a synchronous two-phase interaction with the Flight Service:

1. **Availability Check:** `GET /flight/{flight_id}` is called to verify that the flight exists and that `available_seats > 0`. If the flight is not found or is fully booked, the booking request is rejected before any state is persisted.
2. **Seat Decrement:** Once the booking record has been persisted, `PATCH /flight/{flight_id}/seat` is called to reflect the consumed seat in the Flight Service's inventory.

On booking cancellation, the Booking Service calls `PATCH /flight/{flight_id}/seat/restore` on a best-effort basis to restore the seat. This call does not affect the success response returned to the caller.

### 7.2 Token Forwarding

The Booking Service does not maintain a service account or a separate identity for its downstream calls. Instead, it extracts the `Authorization` header from the inbound client request and forwards it verbatim to the Flight Service. This pattern ensures that:

- The Flight Service always validates a real, client-issued token.
- No additional trust boundary is implicitly introduced at the service layer.
- Role checks performed by the Flight Service reflect the original caller's privileges.

### 7.3 Notification Event Flow

Upon completion of a booking creation, the Booking Service publishes a lifecycle event. The Notification Service, implemented as an AWS Lambda function, consumes this event asynchronously and dispatches the appropriate passenger notification. This asynchronous decoupling ensures that notification delivery failures do not propagate back to the booking transaction and do not affect the client-visible response.

---

## 8. Implementation Notes

### 8.1 Automatic API Documentation

Each FastAPI service automatically generates an OpenAPI 3.0 specification and exposes interactive documentation at the following paths:

- **Swagger UI:** `http://localhost:<port>/docs`
- **ReDoc:** `http://localhost:<port>/redoc`
- **Raw OpenAPI JSON:** `http://localhost:<port>/openapi.json`

These interfaces provide a browser-accessible reference for endpoint schemas, request/response models, and live request execution during development and testing.

### 8.2 Data Storage

Storage choices are split by service to support scalability demonstrations:

- **Auth Service:** In-memory user store (non-persistent, demo use).
- **Flight Service:** In-memory flight inventory (non-persistent, demo use).
- **Booking Service:** Aurora PostgreSQL via SQLAlchemy (persistent storage).
- **Baggage Service:** Amazon DynamoDB table `dams_baggage` (persistent storage).

Pre-loaded seed data is defined at service startup for the in-memory services (auth and flight) to support immediate functional testing.

### 8.3 Service-to-Service Communication

Inter-service communication is implemented using synchronous HTTP calls via the Python `requests` library. The Booking Service is the sole orchestrator and directs requests to the Flight Service as required. A configurable timeout of 5 seconds is enforced on all downstream calls, with `503` and `504` responses returned to the client in the event of connection failure or timeout, respectively.

### 8.4 Docker Deployment

Each microservice is independently containerised using Docker. Services are launched individually and communicate over the host network. The Booking Service resolves the Flight Service using the `host.docker.internal` DNS name (or an overriding value supplied via the `FLIGHT_SERVICE_URL` environment variable), allowing the inter-service base URL to be configured at runtime without code changes.

| Service              | Container Port | Host Port |
|----------------------|:--------------:|:---------:|
| Flight Service       | 8000           | 8000      |
| Booking Service      | 8001           | 8001      |
| Baggage Service      | 8002           | 8002      |
| Authentication Service | 8003         | 8003      |
| Notification Service | N/A (Lambda)   | N/A       |

---

## 9. Conclusion

The API layer of the Distributed Airline Management System provides a secure, modular, and operationally coherent interface across five independent services. Each service enforces JWT authentication locally using a shared symmetric key, and role-based access control is applied consistently at the endpoint level through a reusable dependency pattern. Service responsibilities are cleanly separated — authentication, booking management, flight inventory, baggage tracking, and event-driven notification — and interaction between services is limited to clearly defined, token-authenticated HTTP calls.

This architecture demonstrates the core principles of distributed systems design: loose coupling through service boundary enforcement, security through layered and independently verifiable authentication, and resilience through asynchronous event handling for non-critical downstream processes. The resulting API surface is well-suited to extension, independent scaling of individual services, and integration with cloud-native infrastructure.
