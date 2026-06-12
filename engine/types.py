from __future__ import annotations
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from city.data_model import CityData

_OUTDOOR_CATEGORIES = {"park", "beach", "viewpoint", "garden", "nature_reserve", "hiking_area"}


@dataclass
class EngineStop:
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    duration_min: int
    opening_hours: list[dict]
    price_level: int
    rating: float
    neighborhood: str | None
    is_user_added: bool
    scheduled_time: str | None = None          # ISO time, set by sequencer
    transition_to_next: str | None = None      # 'walk'|'transit'|'rideshare'
    type: str | None = None                    # 'coffee'|'lunch'|'scenic_walk'|'rest'
    tags: list = field(default_factory=list)
    city: str | None = None                    # city this stop belongs to (multi-city trips)

    @property
    def outdoor(self) -> bool:
        return self.category.lower() in _OUTDOOR_CATEGORIES


@dataclass
class EngineContext:
    persona: dict                              # archetype + full weight vector
    city: "CityData"                           # forward ref — city.data_model
    travel_dates: list[str]                    # ISO date strings, one per day
    weather: dict | None = None
    generation_count: int = 0
    user_arrival_time: str | None = None       # user's actual arrival time, day-1 only
    user_start_type: str | None = None         # 'airport' | 'hotel' | 'custom'


@dataclass
class EngineMessage:
    type: str          # 'swap'|'insert'|'resequence'|'weather'|'transit'|'advisory'|'event'
    what: str
    why: str
    consequence: str
    dismissable: bool
    undo_key: str | None = None
    stop_id: str | None = None   # place_id of anchor stop; None for day-level messages


@dataclass
class EngineDay:
    date: str
    stops: list[EngineStop]
    is_travel_day: bool = False


@dataclass
class EngineResult:
    days: list[EngineDay]
    messages: list[EngineMessage]
    generation_id: str
    recommendations: list[dict] | None = None
