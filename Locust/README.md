# Phase 6 — Performance & Scalability Testing (Locust)

Load testing suite for the Distributed Airline Management System (DAMS).  
Tests all four microservices under concurrent synthetic traffic and measures throughput, latency, and failure rates.

---

## Services Under Test

| Service         | Port  | Tested Endpoints                          |
|----------------|-------|-------------------------------------------|
| Auth Service   | 8003  | `POST /login`                             |
| Flight Service | 8000  | `GET /flights`                            |
| Booking Service| 8001  | `GET /bookings`, `POST /booking`          |
| Baggage Service| 8002  | `GET /baggage`                            |

---

## Prerequisites

All four DAMS microservices must be running before starting a load test.

**Option A — Docker Compose (recommended)**
```bash
docker-compose up --build
```

**Option B — Direct (PowerShell, four terminals)**
```powershell
# Terminal 1
cd auth-service; uvicorn app.main:app --port 8003

# Terminal 2
cd flight-service; uvicorn app.main:app --port 8000

# Terminal 3
cd booking-service; uvicorn app.main:app --port 8001

# Terminal 4
cd baggage-service; uvicorn app.main:app --port 8002
```

---

## Installation

```bash
pip install locust
```

Verify the installation:
```bash
python -m locust --version
```

> **Windows note:** Locust installs into the user Scripts folder which may not be on PATH.  
> Always invoke it as `python -m locust` rather than `locust` directly — both are identical.

---

## Running Locust

Navigate to the `Locust/` directory first:

```powershell
cd "Locust"
```

### Interactive Web UI (recommended)

```bash
python -m locust -f locustfile.py
```

Then open **http://localhost:8089** in a browser.  
Enter the number of users, spawn rate, and host, then click **Start**.

> The host field in the Locust UI is overridden by environment variable configuration.  
> You can enter any value (e.g. `http://localhost:8003`) — the locustfile reads service URLs from env vars.

### Headless (no browser, CI-friendly)

```bash
python -m locust -f locustfile.py --headless \
  --users 10 \
  --spawn-rate 1 \
  --run-time 2m \
  --csv results/load_test
```

Results are written to `results/load_test_stats.csv` and `results/load_test_failures.csv`.

---

## Environment Variables

Override any service URL without editing the locustfile:

```bash
# Windows PowerShell
$env:AUTH_SERVICE_URL    = "http://localhost:8003"
$env:FLIGHT_SERVICE_URL  = "http://localhost:8000"
$env:BOOKING_SERVICE_URL = "http://localhost:8001"
$env:BAGGAGE_SERVICE_URL = "http://localhost:8002"

# Optional: override test credentials
$env:LOAD_TEST_USERNAME  = "passenger1"
$env:LOAD_TEST_PASSWORD  = "password123"
```

```bash
# macOS / Linux
export AUTH_SERVICE_URL=http://localhost:8003
export FLIGHT_SERVICE_URL=http://localhost:8000
export BOOKING_SERVICE_URL=http://localhost:8001
export BAGGAGE_SERVICE_URL=http://localhost:8002
```

For Docker Compose targets:
```bash
$env:FLIGHT_SERVICE_URL  = "http://flight-service:8000"
$env:BOOKING_SERVICE_URL = "http://booking-service:8001"
$env:BAGGAGE_SERVICE_URL = "http://baggage-service:8002"
$env:AUTH_SERVICE_URL    = "http://auth-service:8003"
```

---

## Test Scenarios

| Scenario | Method | Endpoint         | Service  | Weight | Purpose                                     |
|----------|--------|------------------|----------|--------|---------------------------------------------|
| A        | GET    | `/flights`       | Flight   | 50%    | Read throughput and latency — primary load  |
| B        | GET    | `/bookings`      | Booking  | 25%    | Authenticated retrieval performance         |
| C        | POST   | `/booking`       | Booking  | 20%    | Write performance under concurrent load     |
| D        | GET    | `/baggage`       | Baggage  | 5%     | Baggage query performance                   |

### User Classes

| Class            | Weight | Think Time   | Description                                        |
|-----------------|--------|--------------|----------------------------------------------------|
| `PassengerUser`  | 80%    | 1 – 3 s      | Human passenger: all four scenarios                |
| `HighVolumeUser` | 20%    | 0.5 – 1.5 s  | Automated client: read-only, higher request rate   |

---

## Suggested Test Configurations

### Load Test — Baseline
```bash
python -m locust -f locustfile.py --headless --users 10 --spawn-rate 1 --run-time 2m
```
- 10 concurrent users
- 1 user spawned per second (ramp-up: 10 s)
- 2-minute duration
- **Goal:** Establish baseline latency with minimal concurrency

---

### Medium Load
```bash
python -m locust -f locustfile.py --headless --users 25 --spawn-rate 2 --run-time 3m
```
- 25 concurrent users
- 2 users spawned per second (ramp-up: ~13 s)
- 3-minute duration
- **Goal:** Measure latency degradation and RPS growth at moderate concurrency

---

### Stress Test
```bash
python -m locust -f locustfile.py --headless --users 50 --spawn-rate 5 --run-time 5m
```
- 50 concurrent users
- 5 users spawned per second (ramp-up: 10 s)
- 5-minute duration
- **Goal:** Identify the point where response times become unacceptable (>500 ms p95)

---

### Heavy Stress Test
```bash
python -m locust -f locustfile.py --headless --users 100 --spawn-rate 10 --run-time 5m
```
- 100 concurrent users
- 10 users spawned per second (ramp-up: 10 s)
- 5-minute duration
- **Goal:** Measure maximum throughput ceiling and failure rate under saturation

---

## Reading the Results

### Locust Web UI Statistics

| Column              | What It Means                                                          |
|---------------------|------------------------------------------------------------------------|
| **# Requests**      | Total requests issued to that endpoint since the test started          |
| **# Failures**      | Requests that returned an error or were explicitly marked as failed     |
| **Median (ms)**     | 50th percentile response time — half of all requests were faster       |
| **90th %ile (ms)**  | 90% of requests completed within this time                             |
| **99th %ile (ms)**  | 1% of requests exceeded this time — indicates worst-case outliers      |
| **Average (ms)**    | Mean response time; can be skewed upward by outliers                   |
| **Min / Max (ms)**  | Fastest and slowest individual requests                                |
| **Average size**    | Mean response body size in bytes — useful for bandwidth estimation     |
| **Current RPS**     | Live requests per second across all users                              |
| **Current Failures/s** | Live error rate                                                    |

### Expected Behaviour

| Condition                     | Expected Result                                                   |
|-------------------------------|-------------------------------------------------------------------|
| `POST /booking` → HTTP 201    | Success — booking created, seat decremented, SNS event published  |
| `POST /booking` → HTTP 409    | Treated as success — expected seat contention under high load     |
| Any endpoint → HTTP 401       | Token expired or missing — check 30-minute JWT expiry             |
| Any endpoint → HTTP 503/504   | Downstream service unavailable — verify all containers are running|

---

## Results Recording Table

Record results here after each test run. Compare across runs to quantify the impact of concurrency on performance.

| Test Config      | Concurrent Users | Avg Response Time (ms) | p95 Latency (ms) | Requests/sec | Failure Count | Failure Rate (%) |
|-----------------|-----------------|------------------------|-----------------|--------------|---------------|-----------------|
| Load Test        | 10              |                        |                 |              |               |                 |
| Medium Load      | 25              |                        |                 |              |               |                 |
| Stress Test      | 50              |                        |                 |              |               |                 |
| Heavy Stress     | 100             |                        |                 |              |               |                 |

### Per-Endpoint Breakdown (Stress Test — 50 Users)

| Endpoint              | Avg (ms) | p95 (ms) | RPS  | Failures |
|-----------------------|---------|---------|------|----------|
| GET /flights          |         |         |      |          |
| GET /bookings         |         |         |      |          |
| POST /booking         |         |         |      |          |
| GET /baggage          |         |         |      |          |
| POST /login [auth]    |         |         |      |          |

---

## Exporting Results

Locust can write CSV reports automatically:

```bash
# Create output directory
mkdir results

python -m locust -f locustfile.py --headless \
  --users 50 --spawn-rate 5 --run-time 5m \
  --csv results/stress_test \
  --html results/stress_test_report.html
```

Output files:
- `results/stress_test_stats.csv` — per-endpoint stats snapshot
- `results/stress_test_stats_history.csv` — time-series RPS and latency data
- `results/stress_test_failures.csv` — full failure log with response bodies
- `results/stress_test_report.html` — self-contained HTML report with charts

---

## Troubleshooting

**`ConnectionRefusedError` on all requests**  
The target service is not running. Start all four DAMS microservices before running Locust.

**All requests fail with HTTP 401**  
The JWT token expired (30-minute TTL). This occurs in tests longer than 30 minutes.  
Restart the test, or increase `ACCESS_TOKEN_EXPIRE_MINUTES` in `auth-service/app/main.py`.

**`POST /booking` returns 409 for every request**  
The in-memory flight seat inventory was depleted.  
Restart the booking and flight services to reset state, then re-run the test.

**Locust shows 0 users active after spawning**  
`on_start()` is raising an unhandled exception. Run with `--loglevel DEBUG` to see the traceback:
```bash
python -m locust -f locustfile.py --loglevel DEBUG
```

**`ImportError: cannot import name 'HttpSession' from 'locust.clients'`**  
Upgrade Locust:
```bash
pip install --upgrade locust
```
