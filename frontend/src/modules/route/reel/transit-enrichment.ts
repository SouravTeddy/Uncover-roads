import type { ReelCard, TransitInfo } from './types';

export async function enrichScenicCardsWithTransit(
  cards: ReelCard[],
  apiBase: string,
  headers: Record<string, string> = {},
): Promise<ReelCard[]> {
  const targets: Array<{
    idx: number;
    originLat: number;
    originLon: number;
    destLat: number;
    destLon: number;
  }> = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.type !== 'scenic' || card.sceneType !== 'walk') continue;

    // scenic cards don't carry lat/lon directly — find the adjacent stop cards
    const prevStop = cards.slice(0, i).reverse().find(c => c.type === 'stop');
    const nextStop = cards.slice(i + 1).find(c => c.type === 'stop');
    if (!prevStop) continue;
    if (!nextStop || nextStop.type !== 'stop') continue;

    const oLat = prevStop.stop.lat;
    const oLon = prevStop.stop.lon;
    const dLat = nextStop.stop.lat;
    const dLon = nextStop.stop.lon;
    if (!oLat || !oLon || !dLat || !dLon) continue;

    targets.push({ idx: i, originLat: oLat, originLon: oLon, destLat: dLat, destLon: dLon });
  }

  if (targets.length === 0) return cards;

  const results = await Promise.allSettled(
    targets.map(t =>
      fetch(
        `${apiBase}/transit-corridor?origin_lat=${t.originLat}&origin_lon=${t.originLon}&dest_lat=${t.destLat}&dest_lon=${t.destLon}`,
        { headers },
      ).then(r => (r.ok ? (r.json() as Promise<TransitInfo>) : null)),
    ),
  );

  const updated = [...cards];
  for (let i = 0; i < targets.length; i++) {
    const { idx } = targets[i];
    const result = results[i];
    const transitInfo: TransitInfo | null =
      result.status === 'fulfilled' ? result.value : null;
    updated[idx] = { ...updated[idx], transitInfo } as ReelCard;
  }
  return updated;
}
