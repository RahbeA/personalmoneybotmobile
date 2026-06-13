import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-moneybot-dev-secret-change-in-production',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes')

# Comma-separated hostnames in production, e.g. "api.getmoneybot.com,getmoneybot.com".
_allowed_hosts = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if h.strip()]

# Railway injects the service's public domain as RAILWAY_PUBLIC_DOMAIN. Trust it
# automatically so the first deploy works without a manual ALLOWED_HOSTS round-trip.
RAILWAY_PUBLIC_DOMAIN = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
if RAILWAY_PUBLIC_DOMAIN and RAILWAY_PUBLIC_DOMAIN not in _allowed_hosts:
    _allowed_hosts.append(RAILWAY_PUBLIC_DOMAIN)

ALLOWED_HOSTS = _allowed_hosts if _allowed_hosts else (['*'] if DEBUG else [])

# Path to the built web control panel (web/dist), if present.
WEB_DIST = BASE_DIR.parent / 'web' / 'dist'

# OpenAI configuration for the Tutor and Money Chat AI features.
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

# Google OAuth: comma-separated list of accepted client IDs (web, iOS, Android).
# A Google ID token is only accepted if its "aud" matches one of these.
GOOGLE_CLIENT_IDS = [
    cid.strip()
    for cid in os.environ.get('GOOGLE_CLIENT_IDS', '').split(',')
    if cid.strip()
]

# Sign in with Apple: comma-separated list of accepted audiences (usually the iOS bundle ID).
APPLE_CLIENT_IDS = [
    cid.strip()
    for cid in os.environ.get('APPLE_CLIENT_IDS', 'com.moneybot.app').split(',')
    if cid.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'accounts',
    'courses',
    'moneyverse',
    'ai',
    'adminapi',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'moneybot.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'moneybot.wsgi.application'

# Default to SQLite for local dev. In production, set DATABASE_URL to a Postgres
# DSN (e.g. postgres://user:pass@host:5432/dbname) to use Postgres instead.
DATABASE_URL = os.environ.get('DATABASE_URL', '')

if DATABASE_URL.startswith(('postgres://', 'postgresql://')):
    from urllib.parse import urlparse, unquote

    _u = urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(_u.path.lstrip('/')),
            'USER': unquote(_u.username or ''),
            'PASSWORD': unquote(_u.password or ''),
            'HOST': _u.hostname or '',
            'PORT': str(_u.port or ''),
            'CONN_MAX_AGE': 600,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Serve the built control panel assets under /static/panel/ (collected from web/dist).
# In production the Vite base is /static/panel/, so the SPA's hashed assets resolve here.
STATICFILES_DIRS = [('panel', WEB_DIST)] if WEB_DIST.exists() else []

# WhiteNoise: compress static files and serve them efficiently in production.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# In dev, allow any origin so the Vite dev server can reach the API. In production
# the panel is served same-origin, so only list extra browser origins if you need them.
_cors_origins = [o.strip() for o in os.environ.get('DJANGO_CORS_ORIGINS', '').split(',') if o.strip()]
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = _cors_origins

# Trust the panel's own origin(s) for CSRF when posting from the same domain.
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]

# Same auto-trust for the Railway domain (HTTPS) so admin POSTs pass CSRF.
if RAILWAY_PUBLIC_DOMAIN:
    _railway_origin = f'https://{RAILWAY_PUBLIC_DOMAIN}'
    if _railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_railway_origin)

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
