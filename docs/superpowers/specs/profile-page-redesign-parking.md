# Profile Page Redesign — Parked Discussion

Topics to tackle when we reach the profile page design. Do not implement until that session.

---

## 1. Monetization Model

**Structure:**
- **Free (B2C)**: explore any city, save places, build 1 itinerary (1 city, up to 3 days). Full map experience — free users should not feel left out.
- **Pro**: unlimited cities, unlimited days, multi-city trips, full Our Analysis insights, export to calendar/PDF
- **B2B**: tourism boards, hotels, airlines — white-label API, bulk itinerary generation, co-branded city guides

**Principle:** Gate on *depth* not *width*. A free user who builds a great Sydney itinerary becomes the best B2B pitch to Sydney tourism.

**Questions to answer at design time:**
- What exactly is the Pro unlock UI? Where does the paywall appear?
- How do free users see a "teaser" of Pro features without feeling blocked?
- Does the profile page show plan status, usage, and upgrade CTA?

---

## 2. Pro Plan Pricing (Demography-Based)

Target user is an international traveller — self-selected higher income regardless of origin. Regional pricing is less critical than for local apps.

| Market | Monthly | Annual |
|--------|---------|--------|
| US / Canada / Australia | $9.99 | $59.99 |
| UK / Western Europe | £7.99 / €8.99 | £49 / €54 |
| Japan / South Korea / UAE | $7.99 | $49.99 |
| Southeast Asia / Latin America | $4.99 | $29.99 |
| India | ₹399 | ₹2,499 |

Use App Store / Play Store regional pricing — Apple and Google handle currency and local tax. Start with a single USD price at launch, tune after seeing where users convert.

---

## 3. Usage Monitoring Dashboard

A lightweight internal tool (not user-facing) to monitor real-time API spend and usage. Build when ready — one afternoon of work.

**Data sources to poll (every 60s):**
- **Google Cloud Billing API** → Places API spend, Maps tiles, Photos requests
- **Railway API** → compute hours, memory, bandwidth
- **Supabase** → row reads, auth volume, storage
- **Own DB** → active sessions, itineraries built today, API calls per user

**Display:** current month spend, daily burn rate, projected month-end, users online now. Single HTML page, no framework, cron-driven.

---

## 4. Global Launch Challenges

### Regulatory
- **GDPR (EU)**: location data needs explicit consent, right to deletion, data residency — plan before EU launch, not after
- **India DPDP Act 2023**: personal data localisation requirements still evolving — watch closely
- **China**: Google Maps/Places don't work. Would need Baidu/Amap — separate build. Skip at launch.
- **App Store review**: Apple strict about location usage — "map exploration" use case should pass but allow for a review cycle

### Cost at Scale
- Google Places Details ~$17/1000 requests. At 10k DAU: $8–15k/month on Places alone
- Caching `PlaceDetails` in Supabase once fetched is critical — must not re-fetch on every card open
- Google Photos API also costs — cache images aggressively once fetched

### Infrastructure
- Railway autoscale needs load testing before a seasonal spike, not during
- Travel apps are violently seasonal — summer/holiday peaks can be 5–10x baseline
- Most usage happens evenings (planning) and on-device during travel → offline/slow connection resilience matters

### Localisation
- English-only locks out Japan, South Korea, Brazil, France — major travel markets
- Not a launch blocker but a 6-month roadmap item after initial launch

### Competition Timing
- Google integrating Gemini into Maps itinerary features now
- Window to establish persona-based differentiation: ~12–18 months before it becomes mainstream
- Ship fast

---

## 5. Profile Page Design Implications

When we get to the profile page, it needs to handle:
- Plan status (Free / Pro) with upgrade CTA for free users
- B2B account type (if applicable)
- Travel history / past itineraries
- Persona display (already exists as PersonaScreen — may need a condensed version here)
- Settings: theme, notifications, date format, currency display
- Account: email, sign out, delete account (GDPR requirement)
