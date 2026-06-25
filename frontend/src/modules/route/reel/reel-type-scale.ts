/** Shared reel font scale — single source of truth for all reel card components */
export const FS = {
  micro:  10,   // uppercase eyebrow labels — "DAY 2", "ARRIVING AT"
  xs:     12,   // chip/badge text, icon detail labels
  sm:     15,   // secondary/meta text, transit details, location
  md:     17,   // body copy, primary info rows, timing
  title:  40,   // stop/city name (Cormorant Garamond)
  hero:   46,   // day-transition big city names
} as const;
