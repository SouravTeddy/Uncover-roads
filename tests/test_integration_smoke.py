# tests/test_integration_smoke.py
"""
Integration smoke test for the full background build flow.

Exercises end-to-end (with mocks — no real network calls):
  POST /engine-itinerary/start
    → 200  {buildId, status='pending'}
  GET  /engine-itinerary/status/{buildId}   (poll 1)
    → 200  {status='running'}
  GET  /engine-itinerary/status/{buildId}   (poll 2)
    → 200  {status='done', result≠None}
  POST /engine-itinerary/start  (while build active)
    → 409  {detail.code='build_in_progress'}

All Supabase calls are mocked; get_current_user is overridden via
FastAPI dependency_overrides — the same pattern used in test_background_build.py.
"""
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_SAMPLE_PAYLOAD = {
    "city": "Tokyo",
    "lat": 35.68,
    "lon": 139.69,
    "days": 2,
    "startDate": "2026-08-01",
    "selectedPlaces": [
        {
            "id": "p1",
            "place_id": "gp1",
            "title": "Senso-ji",
            "lat": 35.71,
            "lon": 139.79,
            "category": "temple",
            "rating": 4.5,
            "photo_ref": None,
            "city": "Tokyo",
        }
    ],
    "personaArchetype": "explorer",
}

_AUTH_HEADERS = {"Authorization": "Bearer smoke-test-token"}


def _make_smoke_supabase(build_id: str = "smoke-build-1"):
    """
    Return a Supabase mock wired for the happy-path smoke flow:
      • Active-build check  → no active builds (empty list)
      • Insert              → row with the given build_id
      • Status poll #1      → status='running'
      • Status poll #2      → status='done' with result payload
    """
    sb = MagicMock()

    # ── Active-build check ──────────────────────────────────────────────────
    # chain: .table().select().eq().in_().order().limit().execute().data
    (
        sb.table.return_value
        .select.return_value
        .eq.return_value
        .in_.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
        .data
    ) = []

    # ── Insert new build record ─────────────────────────────────────────────
    # chain: .table().insert().execute().data
    (
        sb.table.return_value
        .insert.return_value
        .execute.return_value
        .data
    ) = [{"id": build_id}]

    # ── Status polls ────────────────────────────────────────────────────────
    # chain: .table().select().eq().eq().single().execute()   (diverges from
    # active-check chain at the *second* .eq() call, which returns a different
    # MagicMock than .in_() does)
    poll_running = MagicMock()
    poll_running.data = {
        "id": build_id,
        "status": "running",
        "result": None,
        "error": None,
        "updated_at": "2026-08-01T10:00:00Z",
    }

    poll_done = MagicMock()
    poll_done.data = {
        "id": build_id,
        "status": "done",
        "result": {"days": [{"stops": [{"title": "Senso-ji"}]}]},
        "error": None,
        "updated_at": "2026-08-01T10:01:30Z",
    }

    # side_effect list is consumed one item per call
    (
        sb.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .single.return_value
        .execute
    ).side_effect = [poll_running, poll_done]

    return sb


def _make_conflict_supabase(existing_id: str = "smoke-build-0"):
    """Return a Supabase mock where an active build already exists, triggering 409."""
    sb = MagicMock()
    (
        sb.table.return_value
        .select.return_value
        .eq.return_value
        .in_.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
        .data
    ) = [{"id": existing_id, "status": "running"}]
    return sb


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_integration_smoke_full_flow():
    """
    Happy-path smoke: start → poll running → poll done.

    Assertions:
      • POST returns 200 with buildId and status='pending'
      • First GET returns status='running'
      • Second GET returns status='done' and result is not None
    """
    from main import app, get_current_user

    fake_user = type("U", (), {"id": "user-smoke"})()
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch("main._supabase", _make_smoke_supabase("smoke-build-1")):
            from fastapi.testclient import TestClient
            client = TestClient(app)

            # ── Step 1: start build ─────────────────────────────────────────
            start_resp = client.post(
                "/engine-itinerary/start",
                json=_SAMPLE_PAYLOAD,
                headers=_AUTH_HEADERS,
            )
            assert start_resp.status_code == 200, start_resp.text
            start_body = start_resp.json()
            assert start_body["status"] == "pending"
            build_id = start_body["buildId"]
            assert build_id == "smoke-build-1"

            # ── Step 2: first poll — build is running ───────────────────────
            poll1 = client.get(
                f"/engine-itinerary/status/{build_id}",
                headers=_AUTH_HEADERS,
            )
            assert poll1.status_code == 200, poll1.text
            assert poll1.json()["status"] == "running"

            # ── Step 3: second poll — build is done ─────────────────────────
            poll2 = client.get(
                f"/engine-itinerary/status/{build_id}",
                headers=_AUTH_HEADERS,
            )
            assert poll2.status_code == 200, poll2.text
            body2 = poll2.json()
            assert body2["status"] == "done"
            assert body2["result"] is not None, "result must be present when status is done"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_integration_smoke_409_while_building():
    """
    Conflict guard: a second POST while a build is active must return 409
    with detail.code == 'build_in_progress' and the existing build's id.
    """
    from main import app, get_current_user

    fake_user = type("U", (), {"id": "user-smoke"})()
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch("main._supabase", _make_conflict_supabase("smoke-build-0")):
            from fastapi.testclient import TestClient
            client = TestClient(app)

            resp = client.post(
                "/engine-itinerary/start",
                json=_SAMPLE_PAYLOAD,
                headers=_AUTH_HEADERS,
            )
            assert resp.status_code == 409, resp.text
            detail = resp.json()["detail"]
            assert detail["code"] == "build_in_progress"
            assert detail["buildId"] == "smoke-build-0"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
