"""
locustfile.py — Load Testing Suite for DAMS (Distributed Airline Management System)
═══════════════════════════════════════════════════════════════════════════════════════
Phase 6: Performance and Scalability Testing

Architecture Under Test
───────────────────────
  Auth Service    — http://localhost:8003  (JWT issuance via POST /login)
  Flight Service  — http://localhost:8000  (flight inventory, GET /flights)
  Booking Service — http://localhost:8001  (booking lifecycle, POST /booking)
  Baggage Service — http://localhost:8002  (baggage tracking, GET /baggage)

Authentication Flow
───────────────────
  1. Each simulated user calls POST /login on the Auth Service at spawn time (on_start).
  2. The response contains a signed JWT (HS256, 30-minute expiry).
  3. The token is stored on the user instance as self.token.
  4. A pre-built Authorization header ({"Authorization": "Bearer <token>"}) is attached
     to every per-service HttpSession so all downstream requests are automatically
     authenticated without repeating the header construction on every task.
  5. The login request itself is tracked in Locust statistics under "POST /login [auth]".

Token Storage
─────────────
  self.token        — raw JWT string; None if authentication failed
  self.auth_headers — {"Authorization": "Bearer <token>"} used by all service clients
  self.flight_client  — HttpSession → Flight Service  (port 8000)
  self.booking_client — HttpSession → Booking Service (port 8001)
  self.baggage_client — HttpSession → Baggage Service (port 8002)

  Each HttpSession is wired to Locust's request event bus (request_event=...) so
  that every HTTP call it makes is automatically recorded in the statistics dashboard,
  including response time percentiles, RPS, and failure counts.

Load Generation Strategy
────────────────────────
  Two user classes model different traffic patterns:

  PassengerUser (weight=4 → 80% of concurrent users):
    Simulates a human airline passenger browsing, checking bookings, and occasionally
    creating new bookings. Think time of 1–3 seconds models realistic user pacing.

    Task weights reproduce the expected production traffic distribution:
      GET /flights     — weight 10  → ~50% of requests
      GET /bookings    — weight  5  → ~25% of requests
      POST /booking    — weight  4  → ~20% of requests
      GET /baggage     — weight  1  → ~ 5% of requests

  HighVolumeUser (weight=1 → 20% of concurrent users):
    Simulates automated clients (mobile apps, price aggregators, status pollers).
    Shorter think time (0.5–1.5 s) increases throughput without booking creation,
    which models read-heavy background traffic and stresses the read path separately.

Metrics Interpretation
──────────────────────
  Response Time (avg / p95):
    • < 200 ms  — excellent; typical for in-memory FastAPI under low load
    • 200–500 ms — acceptable for a networked service under moderate concurrency
    • > 500 ms  — investigate; may indicate I/O blocking, GIL contention, or resource
                  exhaustion in a single-worker Uvicorn process

  Requests per Second (RPS):
    • Baseline: run with 1 user to establish the single-user RPS ceiling
    • Scale users until RPS plateaus — that plateau is the service's throughput limit
    • Sudden RPS drops at high concurrency indicate process saturation

  Failure Rate:
    • 0%        — all endpoints healthy
    • 409 on POST /booking — expected under concurrent load (seat contention); treated
                             as success in the locustfile to avoid skewing failure stats
    • 5xx       — service errors requiring investigation

  95th Percentile Latency:
    • More informative than the average; reveals the tail latency that 1 in 20 users
      experiences. Critical for SLA compliance. A large p95 / avg gap indicates
      occasional spikes, often from GC pauses or connection pool exhaustion.
"""

import os
import random
import uuid

from locust import HttpUser, between, events, task
from locust.clients import HttpSession


# ─── Service URL Configuration ────────────────────────────────────────────────
# All URLs are read from environment variables so the same locustfile targets
# local dev (localhost), Docker Compose (service names), or any remote environment
# without any code changes.

AUTH_SERVICE_URL    = os.getenv("AUTH_SERVICE_URL",    "http://localhost:8003")
FLIGHT_SERVICE_URL  = os.getenv("FLIGHT_SERVICE_URL",  "http://localhost:8000")
BOOKING_SERVICE_URL = os.getenv("BOOKING_SERVICE_URL", "http://localhost:8001")
BAGGAGE_SERVICE_URL = os.getenv("BAGGAGE_SERVICE_URL", "http://localhost:8002")

# ─── Test Credentials ─────────────────────────────────────────────────────────
# Override via environment variables to test under different roles.
# passenger1 has access to all four tested endpoints (flights, bookings, POST booking, baggage).
TEST_USERNAME = os.getenv("LOAD_TEST_USERNAME", "passenger1")
TEST_PASSWORD = os.getenv("LOAD_TEST_PASSWORD", "password123")

# ─── Booking Parameters ───────────────────────────────────────────────────────
# Flight IDs with available seats at service startup (flight 5 initialises with 0 seats).
# Using string representation because BookingRequest.flight_id is typed as str.
BOOKABLE_FLIGHT_IDS = ["1", "2", "3", "4"]

# ─── Passenger Name Pool ──────────────────────────────────────────────────────
# Used to generate unique names + emails per booking to prevent any potential
# duplicate-detection logic from rejecting load test requests.
_FIRST_NAMES = [
    "Alice", "Bob", "Carol", "David", "Emma",
    "Frank", "Grace", "Henry", "Isla", "Jack",
    "Karen", "Liam", "Mia", "Noah", "Olivia",
]
_LAST_NAMES = [
    "Adams", "Baker", "Clark", "Davis", "Evans",
    "Foster", "Green", "Harris", "Irwin", "Jones",
    "King", "Lewis", "Moore", "Nash", "Owen",
]


# ─── Utility Functions ────────────────────────────────────────────────────────

def _random_name() -> str:
    """
    Return a unique passenger name for each booking request.
    A short UUID fragment is appended to guarantee uniqueness under concurrent load
    even when the same first/last name combination is drawn by multiple users.
    """
    first  = random.choice(_FIRST_NAMES)
    last   = random.choice(_LAST_NAMES)
    suffix = uuid.uuid4().hex[:6]
    return f"{first} {last} {suffix}"


def _random_email() -> str:
    """
    Return a unique email address per booking.
    The full UUID hex prevents email collisions across many concurrent users.
    """
    return f"load_{uuid.uuid4().hex}@dams.test"


# ─── Locust Event Hook — Startup Banner ───────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """
    Fires once when the Locust test begins.
    Prints the target service URLs so the tester can confirm the configuration
    before committing to a full load run.
    """
    print("\n" + "=" * 65)
    print("  DAMS Load Test — Phase 6: Performance & Scalability")
    print("=" * 65)
    print(f"  Auth Service    : {AUTH_SERVICE_URL}")
    print(f"  Flight Service  : {FLIGHT_SERVICE_URL}")
    print(f"  Booking Service : {BOOKING_SERVICE_URL}")
    print(f"  Baggage Service : {BAGGAGE_SERVICE_URL}")
    print(f"  Credentials     : {TEST_USERNAME} / {'*' * len(TEST_PASSWORD)}")
    print("=" * 65 + "\n")


# ─── Base User Class ──────────────────────────────────────────────────────────

class _DAMSBaseUser(HttpUser):
    """
    Abstract base class shared by all DAMS simulated user types.

    Responsibilities:
      • Authenticate against the Auth Service on user spawn (on_start).
      • Store the JWT token and pre-built auth header.
      • Create per-service HttpSession clients that feed metrics into
        Locust's statistics aggregator via the shared request_event bus.

    This class is never instantiated directly by Locust (abstract = True).
    Concrete subclasses inherit auth setup and service clients, and only
    need to declare @task methods and a wait_time.
    """

    # Locust will never spawn this class directly — only concrete subclasses.
    abstract = True

    # self.client targets the Auth Service; used only for the initial login request.
    # All other requests go through the per-service HttpSession clients.
    host = AUTH_SERVICE_URL

    def on_start(self) -> None:
        """
        Called once per simulated user at spawn time.

        Authentication flow:
          1. POST /login to Auth Service with form-encoded credentials.
             (FastAPI's OAuth2PasswordRequestForm requires application/x-www-form-urlencoded)
          2. On HTTP 200, extract access_token from JSON response body.
          3. Build Authorization header and attach to all service clients.
          4. Instantiate three HttpSession objects, one per downstream service,
             each wired to the Locust event bus for automatic stats collection.

        If login fails, self.token is set to None and self._authenticated()
        guards every task to prevent AttributeError on missing service clients.
        """
        # ── Step 1: Login ──────────────────────────────────────────────────
        resp = self.client.post(
            "/login",
            data={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD,
            },
            name="POST /login [auth]",
        )

        if resp.status_code != 200:
            resp.failure(
                f"Authentication failed: HTTP {resp.status_code} — {resp.text[:200]}"
            )
            self.token = None
            self.auth_headers = {}
            return

        body = resp.json()
        self.token = body.get("access_token", "")

        if not self.token:
            resp.failure("Login response did not contain access_token")
            self.token = None
            self.auth_headers = {}
            return

        # ── Step 2: Store token ────────────────────────────────────────────
        # Pre-build the header once; applied to all three service clients below.
        # All protected DAMS endpoints use: Authorization: Bearer <JWT>
        self.auth_headers = {"Authorization": f"Bearer {self.token}"}

        # ── Step 3: Create per-service HTTP clients ────────────────────────
        # HttpSession is Locust's requests.Session subclass.  By passing
        # request_event=self.environment.events.request, each HTTP call made
        # via these clients is automatically recorded in Locust's statistics
        # (response time histogram, RPS counter, failure log).
        #
        # user=self links each client back to this Locust user instance so that
        # Locust's internal aggregator can attribute requests correctly.

        self.flight_client = HttpSession(
            base_url=FLIGHT_SERVICE_URL,
            request_event=self.environment.events.request,
            user=self,
        )
        self.flight_client.headers.update(self.auth_headers)

        self.booking_client = HttpSession(
            base_url=BOOKING_SERVICE_URL,
            request_event=self.environment.events.request,
            user=self,
        )
        self.booking_client.headers.update(self.auth_headers)

        self.baggage_client = HttpSession(
            base_url=BAGGAGE_SERVICE_URL,
            request_event=self.environment.events.request,
            user=self,
        )
        self.baggage_client.headers.update(self.auth_headers)

    def _authenticated(self) -> bool:
        """
        Return True if this user has a valid JWT token.
        Guards every task so that a failed on_start does not crash the process
        with AttributeError when service clients are accessed.
        """
        return bool(getattr(self, "token", None))


# ─── Concrete User Class: PassengerUser ───────────────────────────────────────

class PassengerUser(_DAMSBaseUser):
    """
    Simulates a typical airline passenger interacting with the DAMS.

    Traffic Distribution
    ────────────────────
    Task weights are set proportionally to the target percentages:
      10 : 5 : 4 : 1  →  50% : 25% : 20% : 5%

    Wait time of 1–3 seconds models human think time between actions.
    In production testing against a live system, increase to 3–8 seconds
    to avoid overloading a single-worker development server.

    User Weight
    ───────────
    weight=4 means that for every 5 total users Locust spawns,
    4 will be PassengerUsers and 1 will be a HighVolumeUser.
    This reflects the expected majority of human-driven traffic.
    """

    weight = 4
    wait_time = between(1, 3)

    # ── Scenario A ─────────────────────────────────────────────────────────────

    @task(10)
    def scenario_a_get_flights(self) -> None:
        """
        Scenario A — GET /flights
        Purpose : Measure read throughput and latency on the flight listing endpoint.
        Weight  : 10 (50% of this user's requests)

        The flight listing is the highest-traffic endpoint; it is hit by every
        user before any other interaction.  Low latency here is critical because
        a slow response blocks the booking funnel entirely.
        """
        if not self._authenticated():
            return
        self.flight_client.get("/flights", name="GET /flights")

    # ── Scenario B ─────────────────────────────────────────────────────────────

    @task(5)
    def scenario_b_get_bookings(self) -> None:
        """
        Scenario B — GET /bookings
        Purpose : Measure authenticated retrieval performance on the booking list.
        Weight  : 5 (25% of this user's requests)

        Tests the booking service's read path under realistic concurrency.
        The booking store is append-only during the test run, so the response
        payload grows over time — useful for measuring serialisation overhead.
        """
        if not self._authenticated():
            return
        self.booking_client.get("/bookings", name="GET /bookings")

    # ── Scenario C ─────────────────────────────────────────────────────────────

    @task(4)
    def scenario_c_create_booking(self) -> None:
        """
        Scenario C — POST /booking
        Purpose : Measure booking creation performance under load.
        Weight  : 4 (20% of this user's requests)

        Each invocation generates a unique passenger name and email to avoid
        triggering any duplicate detection in the booking service.

        The flight_id is chosen randomly from BOOKABLE_FLIGHT_IDS (flights 1–4).
        Flight 5 has 0 available seats at service startup and is excluded.

        Seat contention handling:
          Under concurrent load, multiple users may attempt to book the last seat
          on a flight simultaneously.  The booking service returns HTTP 409 in that
          case.  This is expected behaviour — not a system failure — so 409 is
          explicitly marked as success to prevent it from inflating the failure rate.

        Service-to-service call chain triggered by this task:
          Locust → POST /booking (Booking Service)
               → GET  /flight/{id}        (Flight Service — verify availability)
               → PATCH /flight/{id}/seat  (Flight Service — decrement seat count)
               → Publish to AWS SNS       (asynchronous; not blocking)
        """
        if not self._authenticated():
            return

        payload = {
            "flight_id":       random.choice(BOOKABLE_FLIGHT_IDS),
            "passenger_name":  _random_name(),
            "passenger_email": _random_email(),
            "seat_class":      "economy",
        }

        # catch_response=True suspends automatic pass/fail determination so we
        # can inspect the status code before deciding how to classify the result.
        with self.booking_client.post(
            "/booking",
            json=payload,
            name="POST /booking",
            catch_response=True,
        ) as resp:
            if resp.status_code == 201:
                resp.success()
            elif resp.status_code == 409:
                # Seat unavailable — expected under concurrent load; not a failure
                resp.success()
            else:
                resp.failure(
                    f"Unexpected status {resp.status_code}: {resp.text[:200]}"
                )

    # ── Scenario D ─────────────────────────────────────────────────────────────

    @task(1)
    def scenario_d_get_baggage(self) -> None:
        """
        Scenario D — GET /baggage
        Purpose : Measure baggage query performance.
        Weight  : 1 (5% of this user's requests)

        Low frequency reflects the real-world usage pattern: passengers check
        baggage status infrequently compared to browsing flights or bookings.
        """
        if not self._authenticated():
            return
        self.baggage_client.get("/baggage", name="GET /baggage")


# ─── Concrete User Class: HighVolumeUser ──────────────────────────────────────

class HighVolumeUser(_DAMSBaseUser):
    """
    Simulates automated high-frequency clients: mobile apps polling for updates,
    flight price aggregators, kiosk displays, or status dashboards.

    Characteristics
    ───────────────
    • Shorter think time (0.5–1.5 s) than human users — models automation.
    • Read-only traffic — no POST /booking — to apply sustained pressure on
      the read path without depleting the in-memory seat inventory.
    • Lower weight (weight=1 → 20% of users) than PassengerUser, but issues
      requests at twice the frequency, so it contributes disproportionate RPS.

    This class exists to validate that read endpoints remain fast under a
    concurrent mix of human (PassengerUser) and automated (HighVolumeUser) traffic.
    """

    weight = 1
    wait_time = between(0.5, 1.5)

    @task(3)
    def poll_flights(self) -> None:
        """Rapid flight listing — models an automated status board or price feed."""
        if not self._authenticated():
            return
        self.flight_client.get("/flights", name="GET /flights [auto]")

    @task(1)
    def poll_bookings(self) -> None:
        """Periodic booking retrieval — models automated order tracking."""
        if not self._authenticated():
            return
        self.booking_client.get("/bookings", name="GET /bookings [auto]")
