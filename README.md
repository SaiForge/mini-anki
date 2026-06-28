# Mini-Anki

A full-stack social spaced repetition platform built with FastAPI, PostgreSQL, and React.

Mini-Anki takes the proven spaced repetition system (SRS) of traditional flashcards and supercharges it with social networking and community collaboration. Create decks, study with an automated SRS engine, share insights on a global feed, fork community decks, and even submit Pull Requests to improve other users' flashcards!

## Live Demo

| Service | URL |
|---|---|
| Frontend | [minianki.netlify.app](https://minianki.netlify.app) |
| Backend API | `http://18.118.210.98:8000` |
| API Docs (Swagger) | `http://18.118.210.98:8000/docs` |

## Highlights

- **Spaced repetition engine** — interval scheduling with four grade levels (Again · Hard · Good · Easy)
- **Default deck** — auto-created `📚 Today's Review` deck aggregates all due cards across all decks
- **Streak tracking** — increments only when all due cards are completed; resets if a day is missed
- **Social Feed & Profiles** — Follow users, post concepts/flashcards/code, and like/comment on community posts
- **Deck Collaboration** — Publish decks publicly, fork other users' decks, and submit Pull Requests to suggest improvements
- **Direct Messaging & Notifications** — Real-time DMs and in-app notifications for likes, follows, and PR activity
- **JWT authentication** — Secure login/register flow
- **Dark mode** — persistent light/dark toggle stored in browser, easy on the eyes at night
- **Browser-side caching** — deck list and profile are cached in memory for blazing fast navigation
- **Dockerized full stack** — single `docker compose up --build` for local startup

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Axios, Lucide Icons, Vite 8 |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn |
| Database | PostgreSQL (AWS RDS in production) |
| Auth | JWT (python-jose), bcrypt / passlib |
| Hosting | Netlify (frontend), EC2 / Docker (backend), RDS (database) |
| Infra | Docker, Docker Compose |

## Architecture

```mermaid
flowchart LR
	A[React Frontend<br/>Vite · Netlify] -->|HTTP + JWT| B[FastAPI Backend<br/>Docker · EC2 :8000]
	B --> C[(PostgreSQL<br/>AWS RDS :5432)]
	B --> D[SRS Engine<br/>Interval Scheduler]
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
        ├── App.css            # Global styles (light + dark themes)
        ├── api/               # Axios client with JWT interceptor
        ├── components/
        │   └── ThemeToggle.jsx# Moon/Sun icon button for dark mode
        ├── context/
        │   ├── AuthContext.jsx # JWT auth state
        │   ├── DataContext.jsx # Cached deck list + profile across routes
        │   └── ThemeContext.jsx# Dark/light mode, persisted to localStorage
        └── pages/
            ├── Login.jsx        # Login / register with email verification
            ├── Dashboard.jsx    # Deck grid, add card modal, streak display
            ├── StudySession.jsx # Flip-card review + grading
            ├── DeckEditor.jsx   # Create new deck
            ├── VerifyEmail.jsx  # Email verification landing page
            └── ResetPassword.jsx# Password reset form
```

## Quick Start (Docker)

### 1) Clone and configure

```bash
git clone https://github.com/SaiForge/mini-anki.git
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
| `DATABASE_URL` | Yes | — | SQLAlchemy PostgreSQL connection string |
| `SECRET_KEY` | Yes | — | JWT signing secret (use a strong random value) |
| `FRONTEND_BASE_URL` | Yes | — | Frontend origin used in email links (e.g. `https://minianki.netlify.app`) |

### Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `''` (same host) | Base URL for backend API |



## API Reference

Base URL: `http://localhost:8000`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Get JWT token |
| GET | `/api/auth/me` | Yes | Get current user profile and streak |
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
| GET | `/api/study/{deck_id}/due` | Yes | Get due cards (default deck aggregates all due) |
| POST | `/api/study/grade` | Yes | Submit grade and reschedule card |
| POST | `/api/study/{deck_id}/check-in` | Yes | Daily check-in — updates streak only when no cards are due |

### Utility

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Health status |
| GET | `/health` | No | Health check |

## SRS Grading Rules

The current interval in days is transformed based on the grade:

| Grade | New Interval | Minimum |
|---|---|---|
| Again | `0` days (review immediately in the same session) | — |
| Hard | `current_interval × 1` | 1 day |
| Good | `current_interval × 2` | 3 days |
| Easy | `current_interval × 3` | 7 days |

```
next_review_date = today + new_interval_days
```

## Streak System

- The streak tracks **consecutive days of completed reviews**.
- It increments only when **all due cards are cleared** for the day — either by grading the last card or by checking in when there are no cards due.
- Simply opening a study session **does not** increment the streak.
- Missing a day resets the streak to 1 on your next review.

## Caching Strategy

The frontend uses a **`DataContext`** that lives above all routes and caches decks and user profile in memory for the entire session:

| Data | Cached | Reason |
|---|---|---|
| Deck list | ✅ Yes | Mutations update cache in-place; no refetch needed on navigation |
| User profile / streak | ✅ Yes | Refreshed after a study session check-in |
| Due cards | ❌ No | Time-sensitive SRS data; always fetched fresh |
| Card grades | ❌ No | Write-only operations |

## Data Model

```mermaid
erDiagram
    USER ||--o{ DECK : owns
    DECK ||--o{ CARD : contains
    CARD ||--|| SCHEDULE : has
    CARD ||--o{ REVIEW_LOG : tracks
    USER ||--o{ POST : authors
    USER ||--o{ FOLLOW : follows
    POST ||--o{ COMMENT : has
    DECK ||--o{ PULL_REQUEST : receives

    USER {
        uuid user_id PK
        string email UK
        string username UK
        int current_streak
    }
    DECK {
        uuid deck_id PK
        uuid user_id FK
        string title
        boolean is_public
        int fork_count
    }
    CARD {
        uuid card_id PK
        uuid deck_id FK
        text front_text
        text back_text
    }
    SCHEDULE {
        uuid schedule_id PK
        date next_review_date
        int current_interval_days
    }
    POST {
        uuid post_id PK
        uuid author_id FK
        string content_type
        text body
    }
    PULL_REQUEST {
        uuid pr_id PK
        uuid original_deck_id FK
        uuid forked_deck_id FK
        string status
    }
```

## Typical User Flow

1. **Register** — Create an account.
2. **Create & Study Decks** — Organize flashcards by topic and study them daily to build your streak.
3. **Explore the Feed** — Discover concepts, code snippets, and flashcards shared by the community.
4. **Collaborate** — Fork public decks you like, or submit Pull Requests to suggest new cards to the original authors.
5. **Connect** — Follow other learners, engage in comments, and send Direct Messages.

## Frontend Scripts

Run from the `frontend/` directory:

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # Production build (includes Netlify _redirects)
npm run preview   # Preview production build locally
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

PostgreSQL instance managed via RDS. Connection string is passed via `DATABASE_URL` environment variable.

## Troubleshooting

### Backend cannot connect to database

- Verify PostgreSQL is running and reachable at the host in `DATABASE_URL`.
- Check credentials and port (default 5432).
- If using Docker, ensure port 5432 is not already in use.

### CORS errors in browser

- Ensure the frontend origin is listed in `main.py` → `origins`.
- Local dev: `http://localhost:5173`. Production: `https://minianki.netlify.app`.



### Unauthorized (401) errors after login

- Confirm `access_token` exists in `localStorage`.
- Confirm requests include `Authorization: Bearer <token>`.
- Try logging out and back in to refresh the token.

### Port already in use

- Stop existing processes on ports 5173, 8000, or 5432.
- Or adjust exposed ports in `docker-compose.yml`.

## Security Notes

- Replace the default `SECRET_KEY` with a strong random value in all non-local environments.
- Do not commit `.env` files or secrets to version control.
- Use HTTPS and secure cookie/token handling in production.
- Password reset tokens expire in 1 hour.

## Future Improvements

- Add database migrations with Alembic.
- Add backend and frontend automated tests.
- Add detailed deck statistics and analytics dashboards.
- Add refresh token flow and stricter auth hardening.
- Add rate limiting on endpoints.
- Support image/audio cards and rich text formatting.

## License

No license file is currently included in this repository.
