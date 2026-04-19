FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy lock files first — install only dependencies (not the project itself)
# This layer is cached unless pyproject.toml or uv.lock changes
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen

# Copy source and install the project
COPY . .
RUN uv sync --no-dev --frozen

RUN chmod +x start.sh

# Must match PORT env var set in Railway (8080)
EXPOSE 8080

CMD ["./start.sh"]
