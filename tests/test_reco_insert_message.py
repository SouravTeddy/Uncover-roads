"""Reco-engine-injected stops (lunch/coffee/rest gap-fills, added in
main.py's per-day reco injection loop) never created a corresponding
message, so the intro card's "N stops reordered, M spots added" summary
never counted them — it only reflected the earlier, narrower pipeline
that ran before recommendations were layered on.
"""
from main import _make_reco_insert_message


def test_reco_insert_message_has_correct_type_and_stop_id():
    reco_stop = {
        "placeId": "place_123",
        "title": "Blue Bottle Coffee",
        "durationMin": 45,
        "whyForYou": "A relaxed coffee break based on your pace.",
    }
    msg = _make_reco_insert_message(reco_stop)
    assert msg["type"] == "insert"
    assert msg["stopId"] == "place_123"


def test_reco_insert_message_mentions_the_place_name():
    reco_stop = {"placeId": "p1", "title": "Blue Bottle Coffee", "durationMin": 45}
    msg = _make_reco_insert_message(reco_stop)
    assert "Blue Bottle Coffee" in msg["what"]


def test_reco_insert_message_falls_back_gracefully_when_fields_missing():
    """Should not crash on a minimal/partial reco stop dict."""
    msg = _make_reco_insert_message({})
    assert msg["type"] == "insert"
    assert msg["stopId"] == ""
    assert isinstance(msg["what"], str) and msg["what"]
