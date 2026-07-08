# tests/test_background_build.py
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient


def make_mock_supabase(existing_active=False, insert_id="build-123"):
    """Return a supabase mock that simulates the itinerary_builds table."""
    sb = MagicMock()
    active_data = [{"id": "existing-id", "status": "running"}] if existing_active else []
    # Chain for active build check
    (sb.table.return_value.select.return_value
       .eq.return_value.in_.return_value
       .order.return_value.limit.return_value.execute.return_value.data) = active_data
    # Chain for insert
    (sb.table.return_value.insert.return_value
       .execute.return_value.data) = [{"id": insert_id}]
    return sb


def test_start_returns_202_with_build_id():
    """POST /engine-itinerary/start must return buildId and status=pending."""
    from main import app, get_current_user
    fake_user = type("U", (), {"id": "user-abc"})()
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch("main._supabase", make_mock_supabase()):
            client = TestClient(app)
            response = client.post(
                "/engine-itinerary/start",
                json={
                    "city": "Tokyo", "lat": 35.68, "lon": 139.69, "days": 3,
                    "startDate": "2026-08-01",
                    "selectedPlaces": [{"id": "p1", "place_id": "gp1", "title": "Senso-ji",
                                        "lat": 35.71, "lon": 139.79, "category": "temple",
                                        "rating": 4.5, "photo_ref": None, "city": "Tokyo"}],
                    "personaArchetype": "explorer",
                },
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 200
    body = response.json()
    assert body["buildId"] == "build-123"
    assert body["status"] == "pending"


def test_start_returns_409_when_build_active():
    """POST /engine-itinerary/start must return 409 if user already has a running build."""
    from main import app, get_current_user
    fake_user = type("U", (), {"id": "user-abc"})()
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with patch("main._supabase", make_mock_supabase(existing_active=True)):
            client = TestClient(app)
            response = client.post(
                "/engine-itinerary/start",
                json={
                    "city": "Tokyo", "lat": 35.68, "lon": 139.69, "days": 1,
                    "startDate": "2026-08-01", "selectedPlaces": [],
                    "personaArchetype": "explorer",
                },
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 409
    body = response.json()
    assert body["detail"]["code"] == "build_in_progress"
    assert body["detail"]["buildId"] == "existing-id"


def test_status_returns_build_data():
    """GET /engine-itinerary/status/:id must return status and result."""
    from main import app, get_current_user
    fake_user = type("U", (), {"id": "user-abc"})()
    app.dependency_overrides[get_current_user] = lambda: fake_user
    sb = MagicMock()
    (sb.table.return_value.select.return_value
       .eq.return_value.eq.return_value.single.return_value.execute.return_value.data) = {
        "id": "build-123", "status": "done", "result": {"days": []}, "error": None,
        "updated_at": "2026-07-08T03:00:00Z",
    }
    try:
        with patch("main._supabase", sb):
            client = TestClient(app)
            response = client.get(
                "/engine-itinerary/status/build-123",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "done"
    assert body["buildId"] == "build-123"
    assert body["result"] == {"days": []}
