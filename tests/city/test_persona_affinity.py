from city.persona_affinity import get_persona_affinity, ARCHETYPES


def test_museum_high_historian():
    scores = get_persona_affinity("museum")
    assert scores["historian"] >= 0.8


def test_cafe_high_epicurean_and_slowtraveller():
    scores = get_persona_affinity("cafe")
    assert scores["epicurean"] >= 0.7
    assert scores["slowtraveller"] >= 0.7


def test_night_club_high_pulse():
    scores = get_persona_affinity("night_club")
    assert scores["pulse"] >= 0.9


def test_unknown_type_returns_neutral():
    scores = get_persona_affinity("unmapped_type_xyz")
    for archetype in ARCHETYPES:
        assert scores[archetype] == 0.5


def test_all_scores_in_range():
    for gtype in ["museum", "cafe", "park", "restaurant", "tourist_attraction", "bar", "market"]:
        scores = get_persona_affinity(gtype)
        for archetype, score in scores.items():
            assert 0.0 <= score <= 1.0, f"{gtype}/{archetype} = {score} out of range"
