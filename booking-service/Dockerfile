# ---------------------------------------------------------------------------
# Booking Service — Dockerfile
# Base image: Python 3.11 slim for a small production-ready image
# ---------------------------------------------------------------------------
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Copy and install Python dependencies first (layer caching optimisation)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ ./app/

# Expose the port uvicorn will listen on
EXPOSE 8001

# Start the Booking Service with uvicorn
# --host 0.0.0.0 makes the server reachable from outside the container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
