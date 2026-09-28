#!/usr/bin/env python3
"""
Launcher so you can run the API from the backend/ directory:

    python run.py            # dev server with auto-reload
    python run.py --port 8000
"""

import sys
from pathlib import Path

# All project imports are `from backend.app...`, so the PARENT of backend/
# (the project root) must be on sys.path.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn

if __name__ == "__main__":
    port = 8000
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=True)
