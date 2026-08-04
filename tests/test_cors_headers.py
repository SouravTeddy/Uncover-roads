"""CORSMiddleware must be the outermost layer so every response — including
early-returns from require_bearer_middleware — carries CORS headers. Without
this, the browser can't read the response at all (blocked as opaque/failed),
even though the server sent a perfectly valid JSON error body.
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_unauthenticated_request_to_protected_route_has_cors_header(client):
    """A request with no Bearer token gets short-circuited to 401 by
    require_bearer_middleware — that response must still carry
    access-control-allow-origin, or the browser silently drops it."""
    resp = client.get(
        "/api/cities/photos",
        params={"names": "Paris"},
        headers={"Origin": "https://uncover-roads.vercel.app"},
    )
    assert resp.status_code == 401
    assert resp.headers.get("access-control-allow-origin") == "https://uncover-roads.vercel.app"


def test_invalid_bearer_token_response_has_cors_header(client):
    resp = client.get(
        "/api/cities/photos",
        params={"names": "Paris"},
        headers={
            "Origin": "https://uncover-roads.vercel.app",
            "Authorization": "Bearer not-a-real-token",
        },
    )
    assert resp.status_code in (401, 503)
    assert resp.headers.get("access-control-allow-origin") == "https://uncover-roads.vercel.app"
