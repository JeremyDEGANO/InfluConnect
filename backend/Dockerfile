FROM python:3.12-slim@sha256:09f7da3bc104798d0afb40bc08d23ab2da20a76130cec1f2ef170848f5d85217

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app

COPY --chown=app:app . .

# Media dir must exist and be app-owned before the volume mount, otherwise a
# freshly created named volume inherits root ownership and uploads fail.
RUN mkdir -p /app/media && chown -R app:app /app/media

USER 10001:10001

EXPOSE 8000
