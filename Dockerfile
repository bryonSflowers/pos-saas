FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for cache layering
COPY pyproject.toml ./

# Install deps (no dev extras in production)
RUN uv sync --no-dev --no-editable

COPY . .

EXPOSE 8000

RUN chmod +x start.sh

CMD ["./start.sh"]
