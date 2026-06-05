import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import _parse_weekday_text

def test_parse_standard_hours():
    result = _parse_weekday_text(["Monday: 9:00 AM – 9:00 PM"])
    assert result == [{"day": 0, "open_min": 540, "close_min": 1260}]

def test_parse_closed():
    result = _parse_weekday_text(["Tuesday: Closed"])
    assert result == []

def test_parse_24_hours():
    result = _parse_weekday_text(["Wednesday: Open 24 hours"])
    assert result == [{"day": 2, "open_min": 0, "close_min": 1440}]

def test_parse_midnight_close():
    # 12:00 AM as close = end of day
    result = _parse_weekday_text(["Thursday: 9:00 AM – 12:00 AM"])
    assert result == [{"day": 3, "open_min": 540, "close_min": 1440}]

def test_parse_multiple_days():
    result = _parse_weekday_text([
        "Monday: 9:00 AM – 6:00 PM",
        "Sunday: Closed",
    ])
    assert len(result) == 1
    assert result[0]["day"] == 0
    assert result[0]["close_min"] == 1080
