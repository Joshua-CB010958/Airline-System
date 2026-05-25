# Use the official lightweight Python 3.11 image as the base
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy and install dependencies first (leverages Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application source code into the container
COPY app/ ./app/

# Expose the port that uvicorn will listen on
EXPOSE 8002

# Start the FastAPI application with uvicorn
# --host 0.0.0.0 makes the server reachable from outside the container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
