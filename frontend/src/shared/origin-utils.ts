import type { OriginType } from './types';

/**
 * Maps a Google Places `types` array to our internal OriginType.
 * Priority: hotel > airport > custom (street addresses, premises, unknowns).
 * The 'ask_home' intermediate state from the legacy flow has been removed —
 * home detection is no longer part of the origin flow.
 */
export function classifyOriginType(types: string[] = []): OriginType {
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('airport')) return 'airport';
  return 'custom';
}
