FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies only first (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --no-install-project --frozen

# Copy source and install project
COPY . .
RUN uv sync --no-dev --frozen

RUN chmod +x start.sh

# Railway routes to 8000 — must match port in start.sh
EXPOSE 8000

CMD ["./start.sh"]
