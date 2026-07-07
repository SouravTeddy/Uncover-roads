import pytest
from unittest.mock import Mock, MagicMock, patch
import sys
from pathlib import Path

# Add parent directory to path to import main
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import _cache_route_character


@pytest.fixture
def mock_supabase():
    """Mock the Supabase client."""
    with patch("main._supabase") as mock_sb:
        yield mock_sb


def test_cache_route_character_upsert_called(mock_supabase):
    """Test that _cache_route_character calls upsert with correct keys."""
    # Set up mock chain: _supabase -> table() -> upsert() -> execute()
    mock_table = MagicMock()
    mock_upsert = MagicMock()
    mock_execute = MagicMock()

    mock_supabase.table.return_value = mock_table
    mock_table.upsert.return_value = mock_upsert
    mock_upsert.execute.return_value = None

    # Test data
    corridor_key = "test_corridor_123"
    scoring_result = {
        "character_scores": {"urban": 0.8, "nature": 0.2, "historic": 0.5, "commercial": 0.3, "industrial": 0.1, "residential": 0.6, "scenic": 0.7},
        "top_character": "scenic",
        "path_names": ["Main St", "Park Ave"],
        "landmark_peeks": ["City Hall", "Central Park"],
        "route_type": "walk",
    }

    # Call the function
    _cache_route_character(corridor_key, scoring_result)

    # Verify table was called with correct table name
    mock_supabase.table.assert_called_once_with("route_profile_cache")

    # Verify upsert was called
    mock_table.upsert.assert_called_once()

    # Get the upsert call arguments
    upsert_data = mock_table.upsert.call_args[0][0]

    # Verify the upsert data contains the expected keys
    assert upsert_data["corridor_key"] == corridor_key
    assert upsert_data["character_scores"] == scoring_result["character_scores"]
    assert upsert_data["top_character"] == scoring_result["top_character"]
    assert upsert_data["path_names"] == scoring_result["path_names"]
    assert upsert_data["landmark_peeks"] == scoring_result["landmark_peeks"]
    assert upsert_data["route_type"] == scoring_result["route_type"]
    assert "route_computed_at" in upsert_data

    # Verify execute was called
    mock_upsert.execute.assert_called_once()


def test_cache_route_character_handles_none_supabase():
    """Test that _cache_route_character handles None supabase gracefully."""
    # Patch _supabase to None
    with patch("main._supabase", None):
        corridor_key = "test_corridor_123"
        scoring_result = {
            "character_scores": {"urban": 0.8},
            "top_character": "urban",
            "path_names": ["Main St"],
            "landmark_peeks": ["City Hall"],
            "route_type": "walk",
        }

        # Should not raise an exception
        _cache_route_character(corridor_key, scoring_result)


def test_cache_route_character_handles_exception(mock_supabase, capsys):
    """Test that _cache_route_character handles exceptions gracefully."""
    # Set up mock to raise an exception
    mock_supabase.table.side_effect = Exception("Database error")

    corridor_key = "test_corridor_123"
    scoring_result = {
        "character_scores": {"urban": 0.8},
        "top_character": "urban",
        "path_names": ["Main St"],
        "landmark_peeks": ["City Hall"],
        "route_type": "walk",
    }

    # Should not raise an exception, just print error
    _cache_route_character(corridor_key, scoring_result)

    # Verify error message was printed
    captured = capsys.readouterr()
    assert "ROUTE CHARACTER CACHE WRITE" in captured.out


def test_cache_route_character_partial_scoring_result(mock_supabase):
    """Test that _cache_route_character handles partial scoring results."""
    mock_table = MagicMock()
    mock_upsert = MagicMock()
    mock_execute = MagicMock()

    mock_supabase.table.return_value = mock_table
    mock_table.upsert.return_value = mock_upsert
    mock_upsert.execute.return_value = None

    corridor_key = "test_corridor_456"
    # Partial result - missing some keys
    scoring_result = {
        "character_scores": {"urban": 0.5},
        "top_character": "urban",
    }

    # Call the function
    _cache_route_character(corridor_key, scoring_result)

    # Get the upsert call arguments
    upsert_data = mock_table.upsert.call_args[0][0]

    # Verify corridor_key and existing keys are present
    assert upsert_data["corridor_key"] == corridor_key
    assert upsert_data["character_scores"] == {"urban": 0.5}
    assert upsert_data["top_character"] == "urban"
    # Missing keys should be None
    assert upsert_data["path_names"] is None
    assert upsert_data["landmark_peeks"] is None
    assert upsert_data["route_type"] is None
    assert "route_computed_at" in upsert_data
