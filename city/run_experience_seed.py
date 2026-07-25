"""
Hypothesis test: extract experience tips from existing place_details_cache reviews.

Runs against existing data — zero Google API calls.
Writes to place_photo_spots with tip_type embedded in source field.

Usage: python -m city.run_experience_seed
"""
from __future__ import annotations

import os
import re
from datetime import datetime

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://wdfxpmzkctrxwziovbuy.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ── Regex patterns ────────────────────────────────────────────────────────────

# Positive: "what to do / order / experience"
_POSITIVE_RE = re.compile(
    r"\b(must try|must have|must visit|order the|try the|don't miss|do not miss|"
    r"famous for|known for|best known|make sure to|worth it|highly recommend|"
    r"go for the|ask for|the [a-z]+ (here|is amazing|is incredible|is worth)|"
    r"signature (dish|drink|item)|specialty|can't go wrong with|"
    r"early morning|arrive early|go early|get there early|"
    r"golden hour|blue hour|sunrise|sunset|best view|best spot|"
    r"best time to (visit|go|see)|from the top|from across|overlooking|"
    r"take the free|free (tour|entry|admission))\b",
    re.IGNORECASE,
)

# Negative: "what to avoid"
_NEGATIVE_RE = re.compile(
    r"\b(avoid|skip|don't bother|do not bother|not worth|overrated|"
    r"terrible|horrible|awful|worst|disappointing|stay away|"
    r"never (again|order|go)|waste of (time|money)|"
    r"(pizza|food|service|staff|price[s]?) (is|are|was|were) (bad|terrible|awful|horrible|disappointing))\b",
    re.IGNORECASE,
)

_NEGATIVE_WORDS = re.compile(
    r"\b(avoid|skip|terrible|horrible|awful|worst|disappointing|waste|never again|"
    r"not worth|overrated|stay away)\b",
    re.IGNORECASE,
)

# Extract the most useful sentence from text
def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]

def _extract_tip(text: str, rating: float | None) -> dict | None:
    """
    Returns {"description": str, "tip_type": str, "timing": str | None} or None.
    tip_type: "do" | "avoid" | "photo"
    """
    sentences = _sentences(text)
    if not sentences:
        return None

    # Negative review: low rating OR explicit negative language
    is_negative = (rating is not None and rating < 3.5) or bool(_NEGATIVE_RE.search(text))

    if is_negative:
        # Only keep negatives about the core product (food/venue/exhibit), not apps/billing/staff names
        _IRRELEVANT_NEG = re.compile(
            r"\b(app|deal|coupon|voucher|cashback|refund|billing|staff name|[A-Z][a-z]+ (raj|singh|kumar|chen|kim|lee|san|kun))\b",
            re.IGNORECASE,
        )
        _CORE_NEG = re.compile(
            r"\b(food|dish|meal|pizza|ramen|sushi|coffee|tea|drink|menu|portion|price|queue|crowd|"
            r"exhibit|collection|view|entrance|ticket|tour|experience|place|venue|location|wait|smell|noise)\b",
            re.IGNORECASE,
        )
        neg_sentences = [
            s for s in sentences
            if (_NEGATIVE_RE.search(s) or _NEGATIVE_WORDS.search(s))
            and _CORE_NEG.search(s)
            and not _IRRELEVANT_NEG.search(s)
        ]
        if neg_sentences:
            raw = max(neg_sentences, key=len)
            return {
                "description": raw,
                "tip_type": "avoid",
                "timing": None,
                "raw_negative": True,
            }
        return None

        # Photo/timing tips — "stand" only counts with a location noun after it
    photo_sentences = [s for s in sentences if re.search(
        r"\b(golden hour|blue hour|sunrise|sunset|best (view|spot|angle|time)|"
        r"from the top|from across|shoot from|overlooking|rooftop|observation deck|"
        r"morning light|early morning|best time to (visit|go|see|photograph)|"
        r"stand (at|on|near) (the|a|this) \w+)\b", s, re.IGNORECASE
    )]
    if photo_sentences:
        best = max(photo_sentences, key=len)
        timing = None
        for label, pat in [
            ("Golden hour", r"\bgolden hour\b"),
            ("Blue hour",   r"\bblue hour\b"),
            ("Sunrise",     r"\b(sunrise|dawn)\b"),
            ("Sunset",      r"\b(sunset|dusk)\b"),
            ("Morning",     r"\b(early morning|morning light)\b"),
        ]:
            if re.search(pat, best, re.IGNORECASE):
                timing = label
                break
        return {"description": best, "tip_type": "photo", "timing": timing, "raw_negative": False}

    # Experience / "do this" tips
    exp_sentences = [s for s in sentences if _POSITIVE_RE.search(s)]
    if exp_sentences:
        best = max(exp_sentences, key=len)
        return {"description": best, "tip_type": "do", "timing": None, "raw_negative": False}

    return None


def run(dry_run: bool = False) -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all cached places with reviews
    resp = sb.table("place_details_cache").select("place_id, data").execute()
    rows = resp.data or []
    print(f"Fetched {len(rows)} cached places")

    stats = {"do": 0, "avoid": 0, "photo": 0, "no_tip": 0, "no_review": 0}
    upsert_rows: list[dict] = []
    samples: dict[str, list[str]] = {"do": [], "avoid": [], "photo": []}

    now = datetime.utcnow().isoformat()

    for row in rows:
        data = row.get("data") or {}
        place_id = row["place_id"]
        name = data.get("name", "")
        rating = float(data["rating"]) if data.get("rating") else None

        # Collect all review texts
        review_texts: list[tuple[str, float | None]] = []

        top_review = data.get("top_review", "")
        if top_review:
            review_texts.append((top_review, rating))

        for rev in (data.get("reviews") or []):
            text = rev.get("text", "")
            rev_rating = float(rev["rating"]) if rev.get("rating") else rating
            if text and text != top_review:
                review_texts.append((text, rev_rating))

        if not review_texts:
            stats["no_review"] += 1
            continue

        found_tip = False
        for text, rev_rating in review_texts:
            tip = _extract_tip(text, rev_rating)
            if not tip:
                continue

            found_tip = True
            stats[tip["tip_type"]] += 1

            if len(samples[tip["tip_type"]]) < 3:
                samples[tip["tip_type"]].append(f"[{name}] {tip['description'][:120]}")

            prefix = {"do": "TRY: ", "avoid": "AVOID: ", "photo": "PHOTO: "}.get(tip["tip_type"], "")
            upsert_rows.append({
                "place_id":    place_id,
                "city_id":     "unknown",
                "description": prefix + tip["description"],
                "timing":      tip.get("timing"),
                "source":      "google_review",
                "source_url":  None,
                "confidence":  0.6 if not tip.get("raw_negative") else 0.5,
                "updated_at":  now,
            })
            break  # one tip per place for now

        if not found_tip:
            stats["no_tip"] += 1

    total = len(rows)
    hit = stats["do"] + stats["avoid"] + stats["photo"]
    print(f"\n── Results ─────────────────────────────")
    print(f"Total places:    {total}")
    print(f"Got a tip:       {hit}  ({round(hit/total*100)}%)")
    print(f"  'do' tips:     {stats['do']}")
    print(f"  'avoid' tips:  {stats['avoid']}")
    print(f"  'photo' tips:  {stats['photo']}")
    print(f"No review:       {stats['no_review']}")
    print(f"Review but no tip: {stats['no_tip']}")

    print(f"\n── Sample DO tips ──────────────────────")
    for s in samples["do"]:
        print(f"  ✓ {s}")

    print(f"\n── Sample AVOID tips ───────────────────")
    for s in samples["avoid"]:
        print(f"  ✗ {s}")

    print(f"\n── Sample PHOTO tips ───────────────────")
    for s in samples["photo"]:
        print(f"  📷 {s}")

    if dry_run:
        print(f"\n[DRY RUN] Would upsert {len(upsert_rows)} rows to place_photo_spots")
        return

    if upsert_rows:
        # Upsert in batches of 100
        for i in range(0, len(upsert_rows), 100):
            batch = upsert_rows[i:i+100]
            sb.table("place_photo_spots").upsert(
                batch, on_conflict="place_id,source"
            ).execute()
        print(f"\n✓ Upserted {len(upsert_rows)} rows to place_photo_spots")
    else:
        print("\nNothing to upsert")


if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    run(dry_run=dry)
