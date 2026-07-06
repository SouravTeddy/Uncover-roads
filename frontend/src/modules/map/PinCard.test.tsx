import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PinCard } from './PinCard'

vi.mock('../../shared/api', () => ({
  getPlacePhotoUrl: () => 'https://example.com/img.jpg',
  api: { placeImage: () => Promise.resolve(null) },
}))

vi.mock('./pincard-utils', () => ({
  computeAnalysisInsights: () => [],
}))

vi.mock('../../shared/useSheetDismiss', () => ({
  useSheetDismiss: () => {},
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

const TRENDING_VIEW_KEY = 'ur_trending_views'

const place: any = {
  id: 'p1',
  title: 'Blue Note Jazz',
  category: 'event',
  lat: 35.67,
  lon: 139.65,
  rating: 4.5,
  place_id: 'p1',
}

const defaultProps = {
  place,
  city: 'Tokyo',
  isSelected: false,
  isFavourited: false,
  onAdd: vi.fn(),
  onClose: vi.fn(),
  onFavourite: vi.fn(),
  details: { place_id: 'p1', name: 'Blue Note Jazz', address: 'Tokyo', lat: 35.67, lon: 139.65, rating: 4.5, rating_count: 120, weekday_text: [], photo_refs: [], photo_ref: undefined, price_level: undefined, website: undefined, phone: undefined },
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('PinCard — trending/offbeat badge blocks', () => {
  it('shows trending block when ourPickBadge is trending and not locked', () => {
    render(<PinCard {...defaultProps} ourPickBadge="trending" userTier="free" />)
    expect(screen.getByText('Trending now')).toBeTruthy()
  })

  it('shows offbeat block when ourPickBadge is hidden_gem', () => {
    render(<PinCard {...defaultProps} ourPickBadge="hidden_gem" userTier="free" />)
    expect(screen.getByText('Hidden gem')).toBeTruthy()
  })

  it('shows badgeReason text in trending block', () => {
    render(<PinCard {...defaultProps} ourPickBadge="trending" badgeReason="Reviews up 3x this week" userTier="free" />)
    // badgeReason appears in both the top banner and the body block
    expect(screen.getAllByText('Reviews up 3x this week').length).toBeGreaterThan(0)
  })

  it('shows badgeReason text in offbeat block', () => {
    render(<PinCard {...defaultProps} ourPickBadge="hidden_gem" badgeReason="Off the tourist trail" userTier="free" />)
    // badgeReason appears in both the top banner and the body block
    expect(screen.getAllByText('Off the tourist trail').length).toBeGreaterThan(0)
  })

  it('locks trending block after 3 views for free user', () => {
    localStorage.setItem(TRENDING_VIEW_KEY, '3')
    render(<PinCard {...defaultProps} ourPickBadge="trending" userTier="free" />)
    expect(screen.getByText('Trending insights are Pro')).toBeTruthy()
    expect(screen.queryByText('Trending now')).toBeNull()
  })

  it('does not lock for pro user even after 3 stored views', () => {
    localStorage.setItem(TRENDING_VIEW_KEY, '10')
    render(<PinCard {...defaultProps} ourPickBadge="trending" userTier="pro" />)
    expect(screen.getByText('Trending now')).toBeTruthy()
    expect(screen.queryByText('Trending insights are Pro')).toBeNull()
  })

  it('does not lock offbeat/hidden_gem for free user', () => {
    localStorage.setItem(TRENDING_VIEW_KEY, '10')
    render(<PinCard {...defaultProps} ourPickBadge="hidden_gem" userTier="free" />)
    expect(screen.getByText('Hidden gem')).toBeTruthy()
    expect(screen.queryByText('Trending insights are Pro')).toBeNull()
  })

  it('shows Go Pro CTA button when trending is locked', () => {
    localStorage.setItem(TRENDING_VIEW_KEY, '3')
    render(<PinCard {...defaultProps} ourPickBadge="trending" userTier="free" />)
    expect(screen.getByText('Go Pro · $9.99/mo')).toBeTruthy()
  })
})
