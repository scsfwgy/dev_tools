# DevTools — Project Context

## Architecture
- Backend: Flask (Python) with blueprint-based routing
- Frontend: Static HTML/CSS/JS served by Flask
- Deployment: Vercel serverless via `api/index.py`
- Port: 8730

## Key Files
- `backend/app.py` — Flask app entry, static serving, health endpoint
- `start.sh` — Dev/prod launcher with venv management
- `vercel.json` — Vercel routing (all routes → api/index.py)

## Conventions
- No build step — frontend is plain HTML/CSS/JS
- Locales in `frontend/locales/{lang}.json`
- Blueprints registered in `app.py`
- `.env.local` for secrets (gitignored)
