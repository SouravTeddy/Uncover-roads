# Profile, Monetization & AI Disclaimer — Design Spec

**Date:** 2026-05-29
**Status:** Approved — ready for implementation

---

## 1. Monetization Model

### Free tier
- 3 full trips, full access, no feature degradation, no time limit
- After the 3rd trip: hard paywall on next "Build Now" tap (itinerary or curated tabs)

### Paid options (Plan page)
| Option | Price | Notes |
|---|---|---|
| 5-trip pack | $2.99 / ₹249 | One-time, expires 1 year |
| 10-trip pack (Best Value) | $4.99 / ₹399 | One-time, 17% cheaper per trip |
| Monthly subscription | $9.99/mo | Unlimited trips, cancel anytime |

No degraded/guided mode. No 1-trip pack. No Unlimited tier (consolidate into Monthly).

---

## 2. Profile Page Redesign

### Layout (top to bottom)
1. **Header** — "Profile" title + settings icon
2. **Identity card** — avatar (initials), name, email, tier badge (FREE / PRO)
   - Free: plain border badge
   - Pro: gold gradient ring on avatar, gold PRO badge
3. **Archetype card** — emoji, persona name, tagline, inline "Retune persona" chip
4. **Plan row** — adapts to tier:
   - Free (trips remaining): "Free · X trips used" + trip dots (filled = used)
   - Free (paywall hit): gold-tinted border, "Upgrade →" CTA
   - Pack: "X trips remaining"
   - Pro: "Pro · Unlimited" + renewal date + "Manage →"
5. **Settings section** — Notifications, Units, Appearance (dark mode toggle), Privacy & Data
6. **Legal & Support section** — Privacy Policy, Terms & Conditions, Send Feedback, Sign Out

### Key changes from current design
- No "Save Changes" button — nothing editable inline
- No attempts counter as a separate section — folded into plan row
- Sign out moved from header top-right to bottom of list
- Archetype retune inline on card, not a separate button block
- Trip dots give instant visual feedback on free usage

### Plan page entry points
1. Tap "Upgrade →" on plan row in profile
2. Auto-redirect after tapping "Build Now" once 3 free trips are used
- Context banner ("You've used your 3 free trips") only appears on paywall entry, not profile entry

---

## 3. AI Disclaimer

### Post-"Build Now" bottom sheet
- Triggers once after first itinerary build
- Persisted via `localStorage` — never shown again after acknowledged
- Sheet content:
  - Title: **"A heads up"**
  - Body (2 lines): "Some suggestions in your trip are AI-generated. Verify times and prices before heading out."
  - AI pattern example box (gold-tinted): one ✦ line showing how AI content looks
  - Checkbox: "I understand some content is AI-generated and may need verification"
  - CTA button: **"Continue"** — disabled until checkbox is ticked

---

## 4. AI Content Markers

### Single standard: ✦ in `--color-primary` (gold)
All AI-generated text across every surface uses one marker only — ✦ prefixed to italic/dimmed text.

| Surface | Field | Current icon | Action needed |
|---|---|---|---|
| ReelStopCard | `whyForYou` | ✦ | Already correct |
| ReelStopCard | `orderReason` | `schedule` icon | Replace with ✦ |
| ReelStopCard | `orderConsequence` | `check_circle` icon | Replace with ✦ |
| ReelRecoCard | `card.label`, `card.consequence`, `place.matchReasons` | gold chips | Already correct |
| PinCard | `place.reason` | ✦ | Already correct |
| PinCard analysis strip | `computeAnalysisInsights()` | gold border | Already correct |

No "AI" text label or chip — the ✦ symbol is the entire marker.

---

## 5. Subscription Screen Bugs (fix alongside implementation)

- [ ] Free plan copy still references degradation model — update to "3 full trips, then choose a plan"
- [ ] Conversion nudge `nudgeSavings` can go negative — clamp to 0 or hide when negative
- [ ] Pack spend calculation hardcoded — derive from actual purchase history
- [ ] 10-trip pack missing — add it
- [ ] Free plan column visible to paywalled users — hide it

---

## 6. Country Launch Readiness

English-only, no GDPR compliance yet. **Safe to launch:** India, UAE, Singapore, Australia, Canada, USA.
**Avoid:** UK, EU, Germany, Brazil.

Minimum required before launch: a Privacy Policy page (what data is collected, why, contact email).

---

## Out of Scope (separate tasks)

- Fix guide/bulb icon on map (not working as planned)
- Fix curated mode (not firing all expected behaviour)
- GDPR compliance documentation
