# Base image — Python 3.11 slim keeps the image small
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /flight-service

# Copy and install dependencies first (layer-caching: only reinstalls on requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ ./app/

# Expose the port uvicorn will listen on
EXPOSE 8000

# Start the FastAPI application via uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
