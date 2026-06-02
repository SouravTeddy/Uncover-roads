import pytest
from main import _batch_place_details

def test_batch_returns_dict_keyed_by_place_id(mocker):
    mock_supabase = mocker.MagicMock()
    mock_resp = mocker.MagicMock()
    mock_resp.data = [
        {"place_id": "abc", "data": {"price_level": 2, "weekday_text": ["Mon: 9–5"]}},
        {"place_id": "xyz", "data": {"price_level": None, "weekday_text": []}},
    ]
    mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = mock_resp
    result = _batch_place_details(mock_supabase, ["abc", "xyz"])
    assert result["abc"]["price_level"] == 2
    assert result["abc"]["weekday_text"] == ["Mon: 9–5"]
    assert result["xyz"]["price_level"] is None

def test_batch_empty_place_ids_returns_empty(mocker):
    mock_supabase = mocker.MagicMock()
    result = _batch_place_details(mock_supabase, [])
    assert result == {}
    mock_supabase.table.assert_not_called()

def test_batch_no_supabase_returns_empty():
    result = _batch_place_details(None, ["abc"])
    assert result == {}
