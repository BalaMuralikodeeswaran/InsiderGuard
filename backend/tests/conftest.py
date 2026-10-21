"""Loads REACT_APP_BACKEND_URL from /app/frontend/.env for backend tests."""
import os
from pathlib import Path


def _load_frontend_env():
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return
    p = Path("/app/frontend/.env")
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


_load_frontend_env()
