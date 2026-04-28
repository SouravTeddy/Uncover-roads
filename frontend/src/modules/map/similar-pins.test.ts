import { describe, it, expect } from 'vitest';
import { buildConnectorLines } from './SimilarPins';

describe('buildConnectorLines', () => {
  const source = { lat: 35.71, lon: 139.79 };
  const targets = [
    { id: 'ref-1', lat: 35.72, lon: 139.80 },
    { id: 'ref-2', lat: 35.70, lon: 139.78 },
  ];

  it('returns one line per target', () => {
    const lines = buildConnectorLines(source, targets);
    expect(lines).toHaveLength(2);
  });

  it('each line has from and to coords', () => {
    const lines = buildConnectorLines(source, targets);
    expect(lines[0].from).toEqual(source);
    expect(lines[0].to).toEqual({ lat: 35.72, lon: 139.80 });
  });

  it('returns empty array for empty targets', () => {
    expect(buildConnectorLines(source, [])).toEqual([]);
  });
});
