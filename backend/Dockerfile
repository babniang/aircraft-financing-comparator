# Explicit image rather than Nixpacks autodetection: it pins the Python
# version, guarantees the dependencies and the start command share one
# interpreter, and removes the "which port did it bind to" guesswork that
# causes 502s.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway injects $PORT at runtime and it overrides this default, which only
# exists so `docker run -p 8000:8000` works locally. main.py reads PORT in
# Python, so no shell expansion is involved.
ENV PORT=8000
EXPOSE 8000

CMD ["python", "main.py"]
