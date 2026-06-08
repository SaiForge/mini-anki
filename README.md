# Mini Anki

An end-to-end spaced repetition flashcard app built with FastAPI, PostgreSQL, and React.

Create decks, add flashcards, and run focused study sessions with graded recall (**Again · Hard · Good · Easy**) that automatically schedules your next review. Streak tracking keeps you accountable, and email verification keeps your account secure.

## Live Demo

| Service | URL |
|---|---|
| Frontend | [minianki.netlify.app](https://minianki.netlify.app) |
| Backend API | `http://18.118.210.98:8000` |
| API Docs (Swagger) | `http://18.118.210.98:8000/docs` |

## Highlights

- **JWT authentication** — register, login, email verification, password reset
- **Email verification** via AWS SES (verification link sent on signup)
- **Password reset flow** — forgot-password email with time-limited token
- **Multi-user isolation** — each user only sees their own decks and cards
- **Default deck** — auto-created `📚 Today's Review` deck aggregates all due cards
- **Spaced repetition engine** — interval scheduling with four grade levels
- **Streak tracking** — daily check-in & review completion streaks
- **Review history** — every grade is logged for future analytics
- **Dockerized full stack** for quick local startup

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Axios, Lucide Icons, date-fns, Vite 8 |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn |
| Database | PostgreSQL (AWS RDS in production) |
| Auth | JWT (python-jose), bcrypt / passlib |
| Email | AWS SES (transactional emails) |
| Hosting | Netlify (frontend), EC2 / Docker (backend), RDS (database) |
| Infra | Docker, Docker Compose |

## Architecture

```mermaid
flowchart LR
	A[React Frontend<br/>Vite · Netlify] -->|HTTP + JWT| B[FastAPI Backend<br/>Docker · EC2 :8000]
	B --> C[(PostgreSQL<br/>AWS RDS :5432)]
	B --> D[SRS Engine<br/>Interval Scheduler]
	B --> E[AWS SES<br/>Email Service]
```

## Project Structure

```text
mini-anki/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # App entry, CORS, startup migration
│       ├── api/
│       │   ├── auth_router.py # Register, login, verify, reset password
│       │   ├── deck_router.py # CRUD for decks and cards
│       │   ├── study_router.py# Due cards, grading, streaks, check-in
│       │   └── deps.py        # get_current_user dependency
│       ├── core/
│       │   └── security.py    # JWT creation/decoding, password hashing
│       ├── db/
│       │   └── database.py    # SQLAlchemy engine + session
│       ├── models/
│       │   └── all_models.py  # User, Deck, Card, Schedule, ReviewLog
│       ├── schemas/           # Pydantic request/response models
│       └── services/
│           └── srs_engine.py  # Interval calculation logic
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.jsx            # Routes + ProtectedRoute wrapper
        ├── App.css            # Global styles
        ├── api/               # Axios client + API helpers
        ├── context/           # AuthContext (JWT + user state)
        └── pages/
            ├── Login.jsx      # Login / register with email verification
            ├── Dashboard.jsx  # Deck list, card management, streaks
            ├── StudySession.jsx # Flip-card review + grading
            ├── DeckEditor.jsx # Create new deck
            └── VerifyEmail.jsx# Email verification landing page
```

## Quick Start (Docker)

### 1) Clone and configure

```bash
git clone https://github.com/<your-org>/mini-anki.git
cd mini-anki
cp .env.example .env   # or create .env with the variables below
```

### 2) Start everything

```bash
docker compose up --build
```

### 3) Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |

### 4) Stop

```bash
docker compose down        # stop containers
docker compose down -v     # stop + remove database volume
```

## Local Development (No Docker)

You can run PostgreSQL in Docker while running the app natively:

```bash
docker compose up -d db   # if you have a db service defined
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql://postgres:password123@localhost:5432/minianki"
export SECRET_KEY="replace-with-a-strong-random-secret"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open http://localhost:5173.

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/minianki` | SQLAlchemy connection string |
| `SECRET_KEY` | Yes | `super-secret-jwt-key-change-me-later` | JWT signing secret |

### Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:8000` | Base URL for backend API |

### AWS (for email features)

AWS SES credentials are picked up from the standard AWS credential chain (`~/.aws/credentials`, environment variables, or IAM role). The sender address and region are configured in `auth_router.py`:

| Constant | Value | Description |
|---|---|---|
| `AWS_REGION` | `us-east-2` | SES region |
| `SES_SENDER_EMAIL` | `noreply@hirechance.in` | Verified sender address |

## API Reference

Base URL: `http://localhost:8000`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account (sends verification email) |
| POST | `/api/auth/login` | No | Get JWT token (requires verified email) |
| GET | `/api/auth/me` | Yes | Get current user profile |
| GET | `/api/auth/verify?token=…` | No | Verify email address |
| POST | `/api/auth/resend-verification` | No | Resend verification email |
| POST | `/api/auth/forgot-password` | No | Request password reset email |
| POST | `/api/auth/reset-password` | No | Reset password with token |

### Decks & Cards

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/decks/` | Yes | Create deck |
| GET | `/api/decks/` | Yes | List current user's decks |
| DELETE | `/api/decks/{deck_id}` | Yes | Delete deck (cannot delete default) |
| POST | `/api/decks/{deck_id}/cards` | Yes | Add card to deck (not default deck) |

### Study

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/study/{deck_id}/due` | Yes | Get due cards (default deck returns all due) |
| POST | `/api/study/grade` | Yes | Submit grade and reschedule card |
| POST | `/api/study/{deck_id}/check-in` | Yes | Daily check-in for streak (default deck only) |

### Utility

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Health status |
| GET | `/health` | No | Health check |

## SRS Grading Rules

The current interval in days is transformed based on the grade:

| Grade | New Interval | Minimum |
|---|---|---|
| Again | `0` days (review immediately) | — |
| Hard | `current_interval × 1` | 1 day |
| Good | `current_interval × 2` | 3 days |
| Easy | `current_interval × 3` | 7 days |

```
next_review_date = today + new_interval_days
```

## Streak System

- A **daily streak** tracks consecutive days of engagement.
- The streak increments when you **complete all due cards** in the default deck, or manually **check in** if there are no cards due.
- Missing a day resets the streak to 1 on your next review.

## Data Model

```mermaid
erDiagram
    USER ||--o{ DECK : owns
    DECK ||--o{ CARD : contains
    CARD ||--|| SCHEDULE : has
    CARD ||--o{ REVIEW_LOG : tracks

    USER {
        uuid user_id PK
        string email UK
        string password_hash
        bool is_verified
        int current_streak
        date last_review_date
    }
    DECK {
        uuid deck_id PK
        uuid user_id FK
        string title
        int is_default
    }
    CARD {
        uuid card_id PK
        uuid deck_id FK
        text front_text
        text back_text
    }
    SCHEDULE {
        uuid schedule_id PK
        uuid card_id FK
        date next_review_date
        int current_interval_days
    }
    REVIEW_LOG {
        uuid log_id PK
        uuid card_id FK
        string grade_submitted
        datetime reviewed_at
    }
```

## Typical User Flow

1. **Register** — enter email and password; a verification link is sent.
2. **Verify** — click the link in your inbox to activate the account.
3. **Login** — authenticate and receive a JWT.
4. **Create a deck** — organize cards by topic.
5. **Add cards** — write front/back flashcards.
6. **Study** — open `📚 Today's Review` to see all due cards across decks.
7. **Grade** — flip each card and submit **Again / Hard / Good / Easy**.
8. **Streak** — complete all due cards (or check in) daily to build your streak.

## Frontend Scripts

Run from the `frontend/` directory:

```bash
npm run dev       # Vite dev server
npm run build     # Production build (includes Netlify _redirects)
npm run preview   # Preview production build
```

## Deployment

### Frontend — Netlify

- Build command: `npm run build`
- Publish directory: `dist/`
- The build script auto-generates `dist/_redirects` for API proxying and SPA fallback.

### Backend — Docker on EC2

```bash
docker compose up --build -d backend
```

### Database — AWS RDS

PostgreSQL instance managed via RDS. Connection string is set in `DATABASE_URL`.

## Troubleshooting

### Backend cannot connect to database

- Verify PostgreSQL is running and reachable.
- Check `DATABASE_URL` credentials and host.
- If using Docker for DB, ensure port 5432 is available.

### CORS errors in browser

- Ensure the frontend origin is listed in `main.py` → `origins`.
- Local dev: `http://localhost:5173`. Production: `https://minianki.netlify.app`.

### Email verification not arriving

- Check your spam/junk folder.
- Ensure the sender email is verified in AWS SES.
- If SES is in sandbox mode, the recipient must also be verified.

### Unauthorized (401) errors after login

- Confirm `access_token` exists in localStorage.
- Confirm requests include `Authorization: Bearer <token>`.
- Try logging out and in again to refresh the token.

### Port already in use

- Stop existing processes on ports 5173, 8000, or 5432.
- Or adjust exposed ports in `docker-compose.yml`.

## Security Notes

- Replace the default `SECRET_KEY` in all non-local environments.
- Do not commit `.env` or secrets to version control.
- Use HTTPS and secure cookie/token handling in production.
- Password reset tokens expire in 1 hour.
- Email verification is required before login is allowed.

## Future Improvements

- Add database migrations with Alembic.
- Add backend and frontend automated tests.
- Add card editing and deck statistics/analytics.
- Add refresh token flow and stricter auth hardening.
- Add rate limiting on auth endpoints.
- Build review analytics dashboard from `ReviewLog` data.

## License

No license file is currently included in this repository.
