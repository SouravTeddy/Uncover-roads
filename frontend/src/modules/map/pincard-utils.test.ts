import { describe, expect, it } from 'vitest'
import { computeAnalysisInsights } from './pincard-utils'

const noDetails = null
const travel = { start: '2026-06-18', end: '2026-06-25' }

// Google weekday_text: index 0 = Monday, index 6 = Sunday
// Jun 22 2026 is a Monday → closed
const closedMonday = [
  'Monday: Closed',
  'Tuesday: 9:00 AM – 10:00 PM',
  'Wednesday: 9:00 AM – 10:00 PM',
  'Thursday: 9:00 AM – 10:00 PM',
  'Friday: 9:00 AM – 10:00 PM',
  'Saturday: 9:00 AM – 10:00 PM',
  'Sunday: 9:00 AM – 10:00 PM',
]
const openAllWeek = [
  'Monday: 9:00 AM – 10:00 PM',
  'Tuesday: 9:00 AM – 10:00 PM',
  'Wednesday: 9:00 AM – 10:00 PM',
  'Thursday: 9:00 AM – 10:00 PM',
  'Friday: 9:00 AM – 10:00 PM',
  'Saturday: 9:00 AM – 10:00 PM',
  'Sunday: 9:00 AM – 10:00 PM',
]

describe('computeAnalysisInsights', () => {
  it('returns AnalysisInsight[] with text and state properties', () => {
    const result = computeAnalysisInsights({ category: 'museum' }, noDetails, null, travel.start, travel.end)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('text')
      expect(result[0]).toHaveProperty('state')
    }
  })

  it('first insight is green when open all days in trip', () => {
    const result = computeAnalysisInsights(
      { category: 'museum' },
      { weekday_text: openAllWeek, open_now: true },
      null,
      travel.start,
      travel.end,
    )
    expect(result[0].state).toBe('green')
    expect(result[0].text).toMatch(/Open every day/)
  })

  it('closed day insight is warm red', () => {
    // Jun 22 2026 is a Monday
    const result = computeAnalysisInsights(
      { category: 'museum' },
      { weekday_text: closedMonday, open_now: false },
      null,
      '2026-06-22',
      '2026-06-22',
    )
    expect(result[0].state).toBe('red')
    expect(result[0].text).toMatch(/Closed Mon/)
    expect(result[0].text).toMatch(/plan another day/)
  })

  it('no travel dates → shows open_now as first insight', () => {
    const result = computeAnalysisInsights(
      { category: 'museum' },
      { weekday_text: openAllWeek, open_now: true },
      null,
      null,
      null,
    )
    expect(result[0].text).toBe('Open now')
    expect(result[0].state).toBe('green')
  })

  it('trending badge produces gold insight with linkLabel', () => {
    const result = computeAnalysisInsights({ category: 'museum' }, noDetails, 'trending', travel.start, travel.end)
    const trend = result.find(i => i.text.includes('Trending'))
    expect(trend).toBeDefined()
    expect(trend!.state).toBe('gold')
    expect(trend!.linkLabel).toBe('reserve')
  })

  it('hidden_gem is gold with no linkLabel', () => {
    const result = computeAnalysisInsights({ category: 'museum' }, noDetails, 'hidden_gem', travel.start, travel.end)
    const gem = result.find(i => i.text.includes('Hidden gem'))
    expect(gem).toBeDefined()
    expect(gem!.linkLabel).toBeUndefined()
  })

  it('restaurant produces booking insight with linkLabel=reserve', () => {
    const result = computeAnalysisInsights({ category: 'restaurant' }, noDetails, null, travel.start, travel.end)
    const r = result.find(i => i.text.includes('lunch'))
    expect(r).toBeDefined()
    expect(r!.linkLabel).toBe('reserve')
  })

  it('caps at 3 insights', () => {
    const result = computeAnalysisInsights(
      { category: 'restaurant' },
      { weekday_text: closedMonday, open_now: false },
      'trending',
      travel.start,
      travel.end,
    )
    expect(result.length).toBeLessThanOrEqual(3)
  })
})
