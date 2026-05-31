# Project Description
## Airline management system (ALMS)

---

**Document Type:** Project Description & Scope Definition  
**Classification:** Assignment Documentation  
**Version:** 1.0  
**Target Grade:** Distinction / High Distinction  
**Assignment:** Project Documentation  

---

## Table of Contents

1. [Project Name](#1-project-name)
2. [Project Goal](#2-project-goal)
3. [Actors](#3-actors)
4. [Core Features](#4-core-features)
5. [Out-of-Scope Features](#5-out-of-scope-features)
6. [Microservices](#6-microservices)
7. [Current Architecture](#7-current-architecture)
8. [Technologies](#8-technologies)
9. [AWS Infrastructure](#9-aws-infrastructure)
10. [Architecture Decisions & Trade-offs](#10-architecture-decisions--trade-offs)
11. [Distinction-Level Enhancement Opportunities](#11-distinction-level-enhancement-opportunities)
12. [Deliverables & Evidence](#12-deliverables--evidence)

---

## 1. Project Name

**Distributed Airline Management System (DAMS)**

Internal identifier: `alms` (Airline Management System), as used in container network names (`alms-network`) and AWS resource names (`alms-booking-topic`).

---

## 2. Project Goal

Design, build, and deploy a cloud-native distributed system that simulates the core operational domains of a commercial airline — authentication, flight inventory, passenger bookings, baggage tracking, and real-time event-driven notifications — using industry-standard microservices architecture patterns.

The system demonstrates:

- **Distributed systems design** through independently deployable, loosely-coupled services with clear domain boundaries.
- **Cloud integration** through AWS-managed services (SNS, Lambda) for asynchronous, event-driven communication.
- **Security architecture** through stateless JWT authentication with Role-Based Access Control (RBAC) enforced consistently at every service boundary without a centralised gateway.
- **Containerisation** through Docker and Docker Compose for reproducible local deployment.

The business problem addressed is the operational complexity of airline management — multiple user types (passengers, ground staff, administrators) require access to different subsets of functionality with strict access controls, and operational events (booking confirmations) must trigger downstream processes (notifications) without blocking the primary transaction.

---

## 3. Actors

| Actor | Description | Privilege Level |
|-------|-------------|----------------|
| **Passenger** | End-user booking flights and tracking baggage. Has read access to flights, bookings, and baggage. Can create bookings. Cannot cancel bookings or modify operational data. | Low |
| **Staff** | Airline operational staff managing day-to-day operations. All passenger permissions, plus the ability to cancel bookings and update baggage status and location. | Medium |
| **Admin** | System administrator with unrestricted access to all endpoints across all services. | High (super-user) |

---

## 4. Core Features

### 4.1 Implemented (In Scope)

| # | Feature | Service | Description |
|---|---------|---------|-------------|
| 1 | **JWT Authentication** | Auth Service | Stateless HS256 token issuance with 30-minute expiry. Shared secret distributed to all services; no network round-trip required at verification time. |
| 2 | **Role-Based Access Control (RBAC)** | All Services | Three-tier privilege model (`passenger`, `staff`, `admin`) enforced at the endpoint level via FastAPI dependency injection (`require_roles()`). |
| 3 | **User Profile Management** | Auth Service | Token-based identity resolution (`GET /me`). In-memory user store with bcrypt-hashed passwords. |
| 4 | **Flight Inventory** | Flight Service | CRUD access to flight records including origin, destination, available seats, and status. Seat availability is managed atomically per booking transaction. |
| 5 | **Booking Management** | Booking Service | Full booking lifecycle — create, retrieve, cancel. Booking creation validates flight availability via synchronous service call. Cancellation restores seat inventory. |
| 6 | **Baggage Tracking** | Baggage Service | Read access for all roles; status and location updates restricted to staff and admin. Pre-seeded with representative baggage states (Checked In, In Transit, Arrived, Lost). |
| 7 | **Event-Driven Notifications** | Booking Service + Notification Lambda | Booking confirmation events published to AWS SNS (`alms-booking-topic`) asynchronously. AWS Lambda function consumes events and processes notifications. Decoupled from the booking transaction — notification failures do not affect booking reliability. |
| 8 | **Service-to-Service Communication** | Booking ↔ Flight | Token forwarding zero-trust pattern: the Booking Service forwards the caller's Bearer token to the Flight Service, which independently validates it. No implicit trust between services. |
| 9 | **Containerised Deployment** | All Services | Each microservice has an independent Dockerfile. Docker Compose orchestrates all four services over a shared bridge network (`alms-network`) with DNS-based service discovery. |
| 10 | **Auto-Generated API Documentation** | All Services | Each FastAPI service exposes Swagger UI (`/docs`), ReDoc (`/redoc`), and raw OpenAPI JSON (`/openapi.json`) automatically. |

---

## 5. Out-of-Scope Features

The following are intentionally excluded from the current implementation. Each exclusion is a deliberate scope decision, not an oversight.

| Feature | Reason for Exclusion |
|---------|---------------------|
| **Persistent database (PostgreSQL, MySQL)** | In-memory stores are sufficient for demonstration. Adding a database would require migration scripts, connection pooling, and transaction management beyond the assignment scope. |
| **Aurora / RDS** | Cloud-managed relational database. Excluded to keep infrastructure footprint manageable; in-memory storage serves the functional demonstration goal. Identified as a distinction-level enhancement. |
| **DynamoDB** | NoSQL persistent store. Excluded for the same reason as Aurora. Suitable for baggage or booking records in a production scenario. |
| **API Gateway** | Centralised request routing, rate limiting, and SSL termination. Excluded; services are accessed directly by port. Would be a production-readiness addition. |
| **EventBridge** | Advanced event routing and rule-based fan-out. SNS is sufficient for the current single-subscriber notification pattern. EventBridge would be warranted if multiple consumers or routing rules were required. |
| **CQRS / Saga patterns** | Distributed transaction patterns. The current booking flow uses synchronous compensation (best-effort seat restore on cancellation), which is adequate at this scale. |
| **Real-time synchronisation (WebSockets)** | The system uses a request-response model. Real-time push updates are not required for the current feature set. |
| **Automated testing suite** | The `Tests/` directory is a placeholder. Manual testing via Swagger UI and Postman is used for verification. Automated tests are a production-readiness addition. |
| **Infrastructure as Code (Terraform / CDK)** | The `Infrastructure/` directory is a placeholder. AWS resources were provisioned manually. IaC would be required for a repeatable production deployment. |
| **Rate limiting / throttling** | Not implemented at the service level. Would be handled by API Gateway in a production setup. |
| **HTTPS / TLS** | Services communicate over HTTP within the Docker bridge network. TLS termination would be handled by a load balancer or API Gateway in production. |
| **Secrets Manager integration** | The JWT secret key is currently hardcoded. AWS Secrets Manager or Parameter Store would replace this in production. |

---

## 6. Microservices

| Service | Port | Deployment | Domain Responsibility |
|---------|------|------------|-----------------------|
| **Auth Service** | 8003 | Docker container | Issues JWT tokens; manages user credentials; exposes current user profile. |
| **Flight Service** | 8000 | Docker container | Maintains flight inventory; manages seat availability atomically in response to bookings and cancellations. |
| **Booking Service** | 8001 | Docker container | Orchestrates the booking lifecycle; validates flight availability via synchronous service call; publishes booking events to SNS. |
| **Baggage Service** | 8002 | Docker container | Tracks baggage item status and location; updates restricted to operational roles. |
| **Notification Service** | N/A | AWS Lambda (serverless) | Event-driven consumer of SNS booking events; processes and dispatches passenger notifications asynchronously. |

Each service is independently deployable, maintains its own in-memory data store, and communicates with other services exclusively over HTTP using JSON. There is no shared database or shared memory between services.

---

## 7. Current Architecture

### 7.1 Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser / Postman)               │
└───────────────┬─────────────┬──────────────┬────────────────┘
                │             │              │
         :8003  │      :8000  │       :8001  │       :8002
    ┌───────────▼─┐  ┌────────▼────┐  ┌─────▼────────┐  ┌─────▼────────┐
    │ Auth Service│  │Flight Service│  │Booking Service│  │Baggage Service│
    │  FastAPI    │  │  FastAPI    │  │  FastAPI     │  │  FastAPI     │
    │  bcrypt/JWT │  │  In-Memory  │  │  In-Memory   │  │  In-Memory   │
    └─────────────┘  └─────────────┘  └──────┬───────┘  └──────────────┘
                                             │ JWT forwarding
                                     ┌───────▼───────┐
                                     │ Flight Service │
                                     │  (seat ops)    │
                                     └───────────────┘
                                             │
                                     ┌───────▼───────┐
                                     │   AWS SNS     │
                                     │  alms-booking │
                                     │    -topic     │
                                     └───────┬───────┘
                                             │ async event
                                     ┌───────▼───────┐
                                     │  AWS Lambda   │
                                     │  Notification │
                                     │   Service     │
                                     └───────────────┘

All Docker services share: alms-network (bridge)
AWS Region: eu-west-1 (Ireland)
```

### 7.2 Key Architectural Patterns

| Pattern | Where Applied | Description |
|---------|--------------|-------------|
| **Microservices** | Entire system | Independent deployment units with discrete domain boundaries and per-service data stores. |
| **Zero-Trust Service Mesh** | Booking ↔ Flight | No implicit service-to-service trust. The Booking Service forwards the original caller's JWT to the Flight Service, which independently validates it. |
| **Asynchronous Event Publishing** | Booking → SNS → Lambda | Booking confirmation events are published fire-and-forget. Notification delivery is fully decoupled from the booking transaction. |
| **Stateless Authentication** | All services | JWT tokens are verified locally by each service using a shared symmetric key. No session state is maintained server-side. |
| **Dependency Injection for RBAC** | All services | `require_roles()` is a FastAPI dependency factory; role enforcement is composable and reusable across endpoints without duplication. |
| **In-Memory Seed Data** | All services | Pre-populated data enables immediate functional testing without database provisioning. |

---

## 8. Technologies

### 8.1 Core Framework & Runtime

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.11 | Primary language (Docker base: `python:3.11-slim`) |
| **FastAPI** | 0.115.x | Async REST API framework (all microservices) |
| **Uvicorn** | 0.30.x – 0.32.x | ASGI server (all microservices) |
| **Pydantic** | v2.9.x – 2.10.x | Request/response schema validation and serialisation |

### 8.2 Authentication & Security

| Technology | Version | Purpose |
|-----------|---------|---------|
| **python-jose** | 3.3.0 | JWT encoding and decoding (HS256 algorithm) |
| **passlib** | 1.7.4 | Password hashing abstraction layer |
| **bcrypt** | 4.0.1 | Bcrypt password hashing algorithm (pinned version for compatibility) |

### 8.3 Service Integration & HTTP

| Technology | Version | Purpose |
|-----------|---------|---------|
| **boto3** | 1.34.69 | AWS SDK — SNS event publishing from Booking Service |
| **requests** | 2.31.0 | Synchronous HTTP client — Booking to Flight Service calls |
| **python-multipart** | 0.0.12 | Multipart form data parsing (OAuth2 password flow on `/login`) |

### 8.4 Infrastructure & Deployment

| Technology | Purpose |
|-----------|---------|
| **Docker** | Service containerisation |
| **Docker Compose** (v3.9) | Local multi-service orchestration |
| **AWS SNS** | Asynchronous event messaging (booking lifecycle events) |
| **AWS Lambda** | Serverless notification processing |
| **PowerShell** (`start-all.ps1`) | Windows development startup script |

---

## 9. AWS Infrastructure

| Resource | Type | Region | Purpose |
|----------|------|--------|---------|
| `alms-booking-topic` | SNS Topic | eu-west-1 | Receives booking lifecycle events from Booking Service |
| Notification Lambda | Lambda Function | eu-west-1 | Consumes SNS events and processes passenger notifications |

**AWS Credentials Flow:**
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) loaded from `.env` file into the Booking Service container at runtime.
2. boto3 resolves credentials from the environment and initialises an SNS client targeting `eu-west-1`.
3. On successful booking creation, the Booking Service publishes a JSON event payload to the SNS topic ARN.

**Error Handling:**
- SNS publish failures (`ClientError`, `BotoCoreError`) return HTTP 503 to the caller.
- Booking records are persisted before the SNS publish is attempted — a notification failure does not roll back the booking.

---

## 10. Architecture Decisions & Trade-offs

| Decision | Alternative Considered | Rationale |
|----------|----------------------|-----------|
| **Shared JWT secret (symmetric HS256)** | Asymmetric RS256 with per-service public keys | Symmetric key is simpler to distribute in a controlled demo environment. RS256 would be preferred in production (no secret sharing required). |
| **Token forwarding (zero-trust)** | Service accounts with internal tokens | Forwarding preserves the caller's identity and role throughout the call chain without introducing a separate privileged identity. |
| **In-memory data stores** | PostgreSQL / SQLite | Eliminates database provisioning for the demo context. Acknowledged as not suitable for production. |
| **SNS (not SQS)** | SQS queue | SNS allows fan-out to multiple subscribers without re-architecting. A single subscription to Lambda is sufficient for the current use case. |
| **Synchronous Booking → Flight call** | Saga / event-driven booking | Direct HTTP call is simpler and provides immediate consistency for seat availability. Saga would be warranted for multi-service distributed transactions at scale. |
| **Best-effort seat restore on cancellation** | Two-phase commit | Full 2PC is operationally complex. Best-effort restore is adequate given the demo scope and in-memory state. |
| **Docker Compose (not Kubernetes)** | Kubernetes / ECS | Docker Compose is sufficient for a local multi-service demo. Kubernetes would be required for production orchestration, scaling, and self-healing. |

---

## 11. Distinction-Level Enhancement Opportunities

The following additions would elevate the system toward distinction or high-distinction marking criteria:

| Enhancement | AWS Service | Value |
|-------------|------------|-------|
| **Persistent relational storage** | Amazon Aurora Serverless v2 or RDS (PostgreSQL) | Replaces in-memory stores; data survives restarts; demonstrates production-grade persistence |
| **NoSQL storage for bookings** | Amazon DynamoDB | Demonstrates knowledge of NoSQL patterns; highly scalable key-value access pattern suits booking records |
| **Centralised API routing** | Amazon API Gateway | Single entry point; built-in rate limiting, throttling, and SSL termination; integrates with Cognito for auth |
| **Advanced event routing** | Amazon EventBridge | Rule-based fan-out beyond SNS; enables conditional routing of booking events to multiple consumers |
| **Secrets management** | AWS Secrets Manager or Parameter Store | Removes hardcoded JWT secret; demonstrates secure configuration management |
| **Observability** | Amazon CloudWatch + X-Ray | Distributed tracing across service calls; structured log aggregation; metrics dashboards |
| **Infrastructure as Code** | AWS CDK or Terraform | Reproducible, version-controlled infrastructure provisioning; demonstrates DevOps maturity |
| **Load testing evidence** | Locust (already scaffolded) | Demonstrates system behaviour under concurrent load; quantifies throughput and latency |
| **Container orchestration** | Amazon ECS (Fargate) or EKS | Production-grade deployment replacing Docker Compose; demonstrates cloud deployment knowledge |

> **Note:** The `Tests/`, `Postman/`, `Locust/`, and `Infrastructure/` directories are already scaffolded in the project. Populating these would provide high-value evidence for marking.

---

## 12. Deliverables & Evidence

### 12.1 Completed Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Auth Service (JWT + RBAC) | `auth-service/` | Complete |
| Flight Service (inventory management) | `flight-service/` | Complete |
| Booking Service (lifecycle + SNS) | `booking-service/` | Complete |
| Baggage Service (tracking) | `baggage-service/` | Complete |
| Notification Service (Lambda + SNS) | Deployed to AWS Lambda | Complete |
| Docker Compose orchestration | `docker-compose.yml` | Complete |
| API Specification | `Docs/api-specification.md` | Complete |
| AWS SNS topic (`alms-booking-topic`) | eu-west-1 | Provisioned |

### 12.2 Scaffolded (Incomplete)

| Deliverable | Location | Notes |
|-------------|----------|-------|
| Automated tests | `Tests/` | Directory exists; no test files yet |
| Postman collection | `Postman/` | Directory exists; no collection file yet |
| Load testing | `Locust/` | Directory exists; no locustfile yet |
| Infrastructure as Code | `Infrastructure/` (misspelled `Infrustracture/`) | Directory exists; no IaC files yet |
| Lambda source code | `Lambda notification/` | Directory exists; code deployed directly to AWS |

### 12.3 High-Value Screenshots to Capture

The following screenshots provide the highest evidence value for marking:

1. All four Docker containers running simultaneously (`docker ps` or Docker Desktop)
2. Successful `POST /login` → token returned (Swagger UI or Postman)
3. `GET /flights` with valid Bearer token (Passenger role)
4. `POST /booking` — successful booking creation with seat count decrement visible
5. `DELETE /booking/{id}` — successful cancellation (Staff/Admin token)
6. `DELETE /booking/{id}` attempted with Passenger token — `403 Forbidden` returned
7. `PATCH /baggage/update` — baggage status updated (Staff token)
8. `PATCH /baggage/update` attempted with Passenger token — `403 Forbidden` returned
9. AWS SNS Console — `alms-booking-topic` showing message published
10. AWS Lambda Console — Notification function execution log showing event received
11. CloudWatch logs (if available) — Lambda invocation trace
12. Docker Compose network — `alms-network` bridge connecting all containers
