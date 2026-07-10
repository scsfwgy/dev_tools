---
name: verify
description: Verify DevTools startup gates and Flask health behavior.
---

# Verify DevTools

1. Run `./start.sh start`; observe that pytest finishes before the background Flask process starts.
2. Request `curl -fsS http://127.0.0.1:8731/api/health`; expect `{"status":"ok"}`.
3. Run `./start.sh restart`; confirm tests complete before the existing PID is stopped and replaced.
4. To verify fail-fast behavior, temporarily add a failing file under `backend/tests/`, run `./start.sh restart`, and confirm the command fails while the existing PID remains alive; remove the temporary file immediately afterward.
5. Use `./start.sh stop` when verification should leave no service running.
