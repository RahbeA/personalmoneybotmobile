# syntax=docker/dockerfile:1

# ---- Stage 1: build the web admin SPA (web/dist) ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Stage 1b: Node tools used by the admin panel (GLB preview + optimize) ----
FROM node:20-slim AS tools
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /tools/glb-optimize
COPY tools/glb-optimize/package*.json ./
RUN npm ci --omit=dev
COPY tools/glb-optimize/optimize.mjs ./

WORKDIR /tools/glb-preview
COPY tools/glb-preview/package*.json ./
RUN npm ci --omit=dev
COPY tools/glb-preview/preview.mjs ./

# ---- Stage 2: Django backend (serves API + the built /panel/ SPA) ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/backend

# Chromium renders character stills. Node comes from the official image so
# preview.mjs / optimize.mjs can run inside this Python container.
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=tools /tools/glb-optimize /app/tools/glb-optimize
COPY --from=tools /tools/glb-preview /app/tools/glb-preview

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./

# Place the built SPA where settings.WEB_DIST expects it (BASE_DIR.parent/web/dist).
COPY --from=web /web/dist /app/web/dist

# Collect static (Django admin + the SPA under /static/panel/). web/dist is present
# now, so STATICFILES_DIRS picks it up. DB is not touched here.
RUN python manage.py collectstatic --noinput

# Railway provides $PORT. Run migrations on boot, then serve with gunicorn.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn moneybot.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]
