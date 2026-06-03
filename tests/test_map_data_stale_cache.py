from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta


def _make_stale_row():
    old_ts = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    return {"places": [{"id": "p1", "title": "Old Place"}], "fetched_at": old_ts}


def test_stale_cache_is_returned_immediately(client):
    stale = _make_stale_row()
    with (
        patch("main._supabase") as mock_sb,
        patch("main.requests.get") as mock_get,
        patch("main._refresh_map_data_tile") as mock_refresh,
    ):
        # Supabase returns a stale row
        mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = stale
        resp = client.get("/map-data?lat=12.97&lon=77.59")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "p1"
        # Google should NOT have been called synchronously
        mock_get.assert_not_called()
        # Background refresh should have been scheduled
        mock_refresh.assert_called_once()
