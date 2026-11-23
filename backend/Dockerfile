# Purpose: Build the Python environment used by the Django development service.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
EXPOSE 8000
CMD ["python", "-m", "daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
