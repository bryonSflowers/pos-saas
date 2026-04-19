FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for cache layering
COPY pyproject.toml uv.lock ./

# Install deps (no dev extras in production), frozen to lock file
RUN uv sync --no-dev --no-editable --frozen

COPY . .

EXPOSE 8000

RUN chmod +x start.sh

CMD ["./start.sh"]
