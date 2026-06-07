# MoneyBot Mobile

React Native (Expo) + Django full-stack app for [getmoneybot.com](https://getmoneybot.com).

## Structure

```
moneybotmobile/
├── mobile/          # React Native (Expo) iOS app
└── backend/         # Django REST API
```

---

## Mobile App (React Native / Expo)

### Setup

```bash
cd mobile
npm install
```

### Run on iOS Simulator

```bash
npm run ios
```

### Screens

| Screen | Description |
|--------|-------------|
| **Landing** | Animated landing with logo, Get Started + Sign In CTAs |
| **Auth** | Login / Register with email & password, tab switcher |
| **Home** | Dashboard with balance card, stats, quick actions, logout |

### Environment

Update `src/api/auth.js` — change `BASE_URL` to your Django server address:

- **iOS Simulator**: `http://localhost:8000/api`
- **Physical device**: `http://<your-local-ip>:8000/api`

---

## Backend (Django)

### Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register/` | None | Create account → returns token |
| `POST` | `/api/auth/login/` | None | Login → returns token |
| `POST` | `/api/auth/logout/` | Token | Invalidate token |
| `GET`  | `/api/auth/profile/` | Token | Get current user |

### Auth

Token-based authentication (`Authorization: Token <token>`).

### Admin

```bash
python manage.py createsuperuser
# visit http://localhost:8000/admin
```

---

## Color Scheme

| Token | Hex | Usage |
|-------|-----|-------|
| Primary green | `#3DDC5F` | Buttons, accents, active states |
| Dark green | `#2AB84A` | Gradient ends, pressed states |
| Background | `#0A0A0A` | App background |
| Surface | `#1E1E1E` | Cards, inputs |
| White | `#FFFFFF` | Primary text |
| Error red | `#FF4D4D` | Validation errors, sign out |
