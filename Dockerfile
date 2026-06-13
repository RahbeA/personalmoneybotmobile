# syntax=docker/dockerfile:1

# ---- Stage 1: build the web admin SPA (web/dist) ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- Stage 2: Django backend (serves API + the built /panel/ SPA) ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend

# System deps for psycopg/Pillow at runtime are covered by the binary wheels,
# so no extra apt packages are required for the slim image.
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
