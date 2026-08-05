from engine import ramadan


def test_2026_ramadan_starts_february_18():
    assert ramadan.is_ramadan_date("2026-02-20") is True


def test_2026_date_spills_into_march():
    """Ramadan ~30 days from Feb 18, 2026 spills into March."""
    assert ramadan.is_ramadan_date("2026-03-10") is True


def test_2026_date_before_ramadan_is_false():
    assert ramadan.is_ramadan_date("2026-01-15") is False


def test_2026_date_well_after_ramadan_is_false():
    assert ramadan.is_ramadan_date("2026-05-01") is False


def test_year_with_no_known_ramadan_data_is_false():
    assert ramadan.is_ramadan_date("2035-03-01") is False


def test_malformed_date_returns_false_not_crash():
    assert ramadan.is_ramadan_date("not-a-date") is False
