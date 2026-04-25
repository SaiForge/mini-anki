# backend/Dockerfile
FROM python:3.10-slim

# Prevent Python from writing pyc files to disc & buffering stdout
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Install system dependencies required for psycopg2
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Run Uvicorn. We bind to 0.0.0.0 so it is accessible outside the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
