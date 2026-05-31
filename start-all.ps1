# start-all.ps1 — Start all four ALMS microservices locally (no Docker)
# ───────────────────────────────────────────────────────────────────────
# Each service runs in a new PowerShell window so logs are separate.
# Run this script from the repo root (Airline System\).
#
# Usage:
#   .\start-all.ps1
#
# Prerequisites:
#   - Python 3.11+ on PATH
#   - pip install -r <service>/requirements.txt already run for each service
#   - AWS credentials set as environment variables (for SNS in booking-service)

$root = $PSScriptRoot

# ── AWS credentials for Booking Service ───────────────────────────────────────
# Set these before running, or export them in your shell profile.
# $env:AWS_ACCESS_KEY_ID     = "your_key"
# $env:AWS_SECRET_ACCESS_KEY = "your_secret"
# $env:AWS_REGION            = "eu-west-1"
# $env:SNS_TOPIC_ARN         = "arn:aws:sns:eu-west-1:180571023460:alms-booking-topic"

# Service definitions: name, folder, port, extra env vars
$services = @(
    @{ Name = "flight-service";  Dir = "flight-service";  Port = 8000; Env = @{} },
    @{ Name = "auth-service";    Dir = "auth-service";    Port = 8003; Env = @{} },
    @{ Name = "booking-service"; Dir = "booking-service"; Port = 8001; Env = @{
        FLIGHT_SERVICE_URL    = "http://localhost:8000"
        AWS_ACCESS_KEY_ID     = $env:AWS_ACCESS_KEY_ID
        AWS_SECRET_ACCESS_KEY = $env:AWS_SECRET_ACCESS_KEY
        AWS_REGION            = if ($env:AWS_REGION) { $env:AWS_REGION } else { "eu-west-1" }
        SNS_TOPIC_ARN         = if ($env:SNS_TOPIC_ARN) { $env:SNS_TOPIC_ARN } else { "arn:aws:sns:eu-west-1:180571023460:alms-booking-topic" }
    }},
    @{ Name = "baggage-service"; Dir = "baggage-service"; Port = 8002; Env = @{} }
)

foreach ($svc in $services) {
    $serviceDir = Join-Path $root $svc.Dir

    # Build the environment-variable setup block for the new window
    $envBlock = ""
    foreach ($key in $svc.Env.Keys) {
        $val = $svc.Env[$key]
        if ($val) {
            $envBlock += "`$env:$key = '$val'; "
        }
    }

    $cmd = "$envBlock cd '$serviceDir'; uvicorn app.main:app --port $($svc.Port) --reload"

    Write-Host "Starting $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd
}

Write-Host ""
Write-Host "All services started. Swagger UIs:" -ForegroundColor Green
Write-Host "  Flight Service  -> http://localhost:8000/docs"
Write-Host "  Booking Service -> http://localhost:8001/docs"
Write-Host "  Baggage Service -> http://localhost:8002/docs"
Write-Host "  Auth Service    -> http://localhost:8003/docs"
