"""
services/auth.py — Shared FastAPI auth dependency

Extracted from main.py to break the circular import between
main.py and routers/drawings.py (AGENTS.md B.2).

Both main.py and all routers import get_current_user from here.
"""

import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL", "")
supabase_key = os.environ.get("SUPABASE_KEY", "")

# Shared read-only client — used only for auth token validation
_auth_supabase: Client = create_client(supabase_url, supabase_key)

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validates a Supabase JWT and returns {"sub": user_id, "role": role}.
    Raises HTTP 401 on any failure.
    """
    token = credentials.credentials
    try:
        user_response = _auth_supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token structure")

        if user_response.user.role != "authenticated":
            raise HTTPException(status_code=401, detail="Not authorized")

        return {"sub": user_response.user.id, "role": user_response.user.role}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
