# Mini Anki

An end-to-end spaced repetition app built with FastAPI, PostgreSQL, and React.

Mini Anki helps users create decks, add flashcards, and run focused study sessions with graded recall (Again, Hard, Good, Easy) that updates the next review date.

## Highlights

- JWT-based authentication (register/login)
- Multi-user deck isolation (each user only sees their own data)
- Deck + card authoring workflow
- Study queue of due cards
- Spaced repetition scheduling engine
- Dockerized full stack for quick startup

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Axios, Vite |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 15 |
| Auth | JWT (python-jose), bcrypt/passlib |
| Infra | Docker, Docker Compose |

## Architecture

```mermaid
flowchart LR
	A[React Frontend<br/>Vite :5173] -->|HTTP + JWT| B[FastAPI Backend :8000]
	B --> C[(PostgreSQL :5432)]
	B --> D[SRS Engine<br/>Interval + Due Date Rules]
```

## Project Structure

```text
mini-anki/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── api/
│       ├── core/
│       ├── db/
│       ├── models/
│       ├── schemas/
│       └── services/
└── frontend/
		├── Dockerfile
		├── package.json
		└── src/
				├── api/
				├── context/
				└── pages/
```

## Quick Start (Docker)

### 1) Start everything

```bash
docker compose up --build
```

### 2) Open apps

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### 3) Stop

```bash
docker compose down
```

To remove database volume too:

```bash
docker compose down -v
```

## Local Development (No Docker for app services)

You can still use Docker only for PostgreSQL if you want:

```bash
docker compose up -d db
```

### Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql://postgres:password123@localhost:5432/minianki"
export SECRET_KEY="replace-with-a-strong-random-secret"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend setup

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
| DATABASE_URL | Yes (recommended) | postgresql://postgres:password@localhost:5432/minianki | SQLAlchemy connection string |
| SECRET_KEY | Yes (recommended) | super-secret-jwt-key-change-me-later | JWT signing secret |

### Frontend

| Variable | Required | Default | Description |
|---|---|---|---|
| VITE_API_URL | No | http://localhost:8000 | Base URL for backend API |

## API Overview

Base URL: http://localhost:8000

### Authentication

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Get JWT token |

### Decks and Cards

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/decks/ | Yes | Create deck |
| GET | /api/decks/ | Yes | List current user's decks |
| DELETE | /api/decks/{deck_id} | Yes | Delete deck |
| POST | /api/decks/{deck_id}/cards | Yes | Add card to deck |

### Study

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | /api/study/{deck_id}/due | Yes | Get due cards |
| POST | /api/study/grade | Yes | Submit grade and reschedule card |

## SRS Grading Rules

Current interval in days is transformed as follows:

- Again: set interval to 0
- Hard: max(1, current_interval * 1)
- Good: max(3, current_interval * 2)
- Easy: max(7, current_interval * 3)

Next review date is calculated as:

next_review_date = today + new_interval_days

## Typical User Flow

1. Register or login.
2. Create a deck.
3. Add cards from the dashboard.
4. Start a study session.
5. Flip each card and submit a grade.
6. Review schedule updates automatically.

## Frontend Scripts

Run from the frontend directory:

```bash
npm run dev      # Vite dev server
npm run build    # Production build
npm run preview  # Preview build
npm run lint     # ESLint
```

## Troubleshooting

### Backend cannot connect to database

- Verify PostgreSQL is running.
- Check DATABASE_URL and credentials.
- If using Docker DB, ensure port 5432 is available.

### CORS errors in browser

- Ensure frontend is running on http://localhost:5173.
- Ensure backend is running on http://localhost:8000.

### Unauthorized (401) errors after login

- Confirm access_token exists in localStorage.
- Confirm requests include Authorization: Bearer <token>.
- Try logging out and in again to refresh token.

### Port already in use

- Stop existing processes on ports 5173, 8000, or 5432.
- Or adjust exposed ports in docker-compose.yml.

## Security Notes

- Replace default SECRET_KEY in all non-local environments.
- Do not commit secrets or local env files.
- Use HTTPS and secure cookie/token handling in production.

## Next Improvements

- Add migrations with Alembic.
- Add backend and frontend automated tests.
- Add card editing and deck statistics.
- Add refresh token flow and stricter auth hardening.

## License

No license file is currently included in this repository.
