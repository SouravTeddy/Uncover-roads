import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import patch, MagicMock
from city.trend_fetcher import (
    fetch_youtube_score,
    fetch_wikimedia_score,
    fetch_foursquare_score,
    fetch_reddit_score,
)


# ── YouTube ──────────────────────────────────────────────────────────────────

def test_youtube_returns_zero_without_key():
    assert fetch_youtube_score("Eiffel Tower", "Paris", "") == 0.0


def test_youtube_returns_zero_on_http_error():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = Exception("HTTP 403")
        assert fetch_youtube_score("Eiffel Tower", "Paris", "fake_key") == 0.0


def test_youtube_normalises_video_count():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"items": [{}] * 20}  # 20 videos
        mock_get.return_value = mock_resp
        score = fetch_youtube_score("Eiffel Tower", "Paris", "fake_key")
        assert score == 1.0  # 20/20 = 1.0 (clamped)


def test_youtube_partial_count():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"items": [{}] * 10}  # 10 videos
        mock_get.return_value = mock_resp
        score = fetch_youtube_score("Some Café", "Paris", "fake_key")
        assert score == 0.5  # 10/20 = 0.5


# ── Wikimedia ────────────────────────────────────────────────────────────────

def test_wikimedia_returns_zero_on_no_results():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"query": {"search": []}}
        mock_get.return_value = mock_resp
        assert fetch_wikimedia_score("Unknown Place XYZ") == 0.0


def test_wikimedia_returns_zero_on_http_error():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_get.side_effect = Exception("timeout")
        assert fetch_wikimedia_score("Eiffel Tower") == 0.0


def test_wikimedia_normalises_pageviews():
    responses = [
        MagicMock(
            raise_for_status=MagicMock(return_value=None),
            json=MagicMock(return_value={"query": {"search": [{"title": "Eiffel Tower"}]}}),
        ),
        MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "items": [{"views": 5000}] * 90  # 5000 views/day avg
            }),
        ),
    ]
    with patch("city.trend_fetcher.requests.get", side_effect=responses):
        score = fetch_wikimedia_score("Eiffel Tower")
        assert score == 1.0  # 5000/5000 = 1.0 (clamped)


# ── Foursquare ───────────────────────────────────────────────────────────────

def test_foursquare_returns_zero_without_key():
    assert fetch_foursquare_score("Café de Flore", 48.854, 2.332, "") == 0.0


def test_foursquare_returns_zero_on_no_results():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": []}
        mock_get.return_value = mock_resp
        assert fetch_foursquare_score("Ghost Place", 48.854, 2.332, "fake_key") == 0.0


def test_foursquare_returns_popularity():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": [{"popularity": 0.82}]}
        mock_get.return_value = mock_resp
        score = fetch_foursquare_score("Café de Flore", 48.854, 2.332, "fake_key")
        assert score == 0.82


# ── Reddit ───────────────────────────────────────────────────────────────────

def test_reddit_returns_zero_without_credentials():
    assert fetch_reddit_score("Eiffel Tower", "Paris", "", "") == 0.0
    assert fetch_reddit_score("Eiffel Tower", "Paris", "id", "") == 0.0
    assert fetch_reddit_score("Eiffel Tower", "Paris", "", "secret") == 0.0


def test_reddit_returns_zero_on_auth_error():
    with patch("city.trend_fetcher.requests.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = Exception("401")
        score = fetch_reddit_score("Eiffel Tower", "Paris", "id", "secret")
        assert score == 0.0


def test_reddit_normalises_post_count():
    with patch("city.trend_fetcher.requests.post") as mock_post, \
         patch("city.trend_fetcher.requests.get") as mock_get:
        mock_post.return_value.raise_for_status.return_value = None
        mock_post.return_value.json.return_value = {"access_token": "tok123"}
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {
            "data": {"children": [{}] * 30}  # 30 posts
        }
        score = fetch_reddit_score("Eiffel Tower", "Paris", "id", "secret")
        assert score == 1.0  # 30/30 = 1.0 (clamped)
