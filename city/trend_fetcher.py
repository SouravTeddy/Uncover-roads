"""Trend signal fetchers — one per source, each returns float 0.0–1.0.

All functions catch every exception and return 0.0. Missing credentials
also return 0.0 so the pipeline degrades gracefully.
"""
from __future__ import annotations

import requests
import requests.auth
from datetime import datetime, timedelta


def fetch_youtube_score(place_name: str, city_name: str, api_key: str) -> float:
    """Count YouTube videos mentioning place+city in last 90 days. Max 20 videos → 1.0."""
    if not api_key:
        return 0.0
    published_after = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": f"{place_name} {city_name}",
                "type": "video",
                "publishedAfter": published_after,
                "maxResults": 50,
                "key": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        video_count = len(resp.json().get("items", []))
        return min(1.0, video_count / 20.0)
    except Exception:
        return 0.0


def fetch_wikimedia_score(place_name: str) -> float:
    """Average daily Wikipedia page views over last 90 days. 5000 views/day → 1.0."""
    try:
        search_resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": place_name,
                "format": "json",
                "srlimit": 1,
            },
            timeout=10,
        )
        search_resp.raise_for_status()
        results = search_resp.json().get("query", {}).get("search", [])
        if not results:
            return 0.0
        title = results[0]["title"].replace(" ", "_")
    except Exception:
        return 0.0

    try:
        end = datetime.utcnow()
        start = end - timedelta(days=90)
        pv_resp = requests.get(
            f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
            f"/en.wikipedia/all-access/all-agents/{title}/daily"
            f"/{start.strftime('%Y%m%d')}/{end.strftime('%Y%m%d')}",
            timeout=10,
        )
        if pv_resp.status_code != 200:
            return 0.0
        items = pv_resp.json().get("items", [])
        if not items:
            return 0.0
        avg_views = sum(i["views"] for i in items) / len(items)
        return min(1.0, avg_views / 5000.0)
    except Exception:
        return 0.0


def fetch_foursquare_score(place_name: str, lat: float, lon: float, api_key: str) -> float:
    """Foursquare popularity score (0.0–1.0) for nearest matching place."""
    if not api_key:
        return 0.0
    try:
        resp = requests.get(
            "https://api.foursquare.com/v3/places/nearby",
            headers={"Authorization": api_key},
            params={
                "ll": f"{lat},{lon}",
                "query": place_name,
                "limit": 1,
                "fields": "fsq_id,popularity",
            },
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return 0.0
        return float(results[0].get("popularity", 0.0))
    except Exception:
        return 0.0


def fetch_reddit_score(
    place_name: str, city_name: str, client_id: str, client_secret: str
) -> float:
    """Reddit post mention count in last month. 30 posts → 1.0. Returns 0.0 if no credentials."""
    if not client_id or not client_secret:
        return 0.0
    try:
        auth = requests.auth.HTTPBasicAuth(client_id, client_secret)
        token_resp = requests.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=auth,
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": "uncover-roads-trends/1.0"},
            timeout=10,
        )
        token_resp.raise_for_status()
        token = token_resp.json()["access_token"]
    except Exception:
        return 0.0

    try:
        search_resp = requests.get(
            "https://oauth.reddit.com/search",
            headers={
                "Authorization": f"bearer {token}",
                "User-Agent": "uncover-roads-trends/1.0",
            },
            params={
                "q": f"{place_name} {city_name}",
                "sort": "new",
                "t": "month",
                "limit": 100,
                "restrict_sr": "false",
            },
            timeout=10,
        )
        search_resp.raise_for_status()
        posts = search_resp.json().get("data", {}).get("children", [])
        return min(1.0, len(posts) / 30.0)
    except Exception:
        return 0.0
