"""Ramadan date-window check, ported from ip_engine.py's CATEGORY B logic.

Ramadan follows the lunar calendar, so its Gregorian start date shifts each
year — there's no formula, only a lookup of published start dates.
"""
from __future__ import annotations
from datetime import datetime as _datetime

# (start_month, start_day) — Ramadan lasts ~30 days, so the window always
# spans its start month and the following one.
_RAMADAN_START: dict[int, tuple[int, int]] = {
    2024: (3, 11), 2025: (3, 1),  2026: (2, 18),
    2027: (2, 7),  2028: (1, 28), 2029: (1, 16), 2030: (1, 5),
}


def in_ramadan(month: int, year: int) -> bool:
    entry = _RAMADAN_START.get(year)
    if not entry:
        return False
    start_month, _start_day = entry
    start_abs = year * 12 + start_month - 1
    end_abs = start_abs + 1
    cur_abs = year * 12 + month - 1
    return cur_abs in (start_abs, end_abs)


def is_ramadan_date(date_str: str) -> bool:
    try:
        d = _datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return False
    return in_ramadan(d.month, d.year)
