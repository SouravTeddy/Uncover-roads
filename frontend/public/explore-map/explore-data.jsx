// explore-data.jsx — Faux Tokyo world model for the Explore map.
// World space is an abstract 1200 × 1600 grid. Neighborhoods are organic
// polygons; POIs are points tagged by category. Spot counts / ranks / empty
// state are all DERIVED in the component from the active filter category.

// deterministic organic polygon around a centroid
function makePoly(cx, cy, r, seed, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const frac = (x) => x - Math.floor(x);
    const j = 0.72 + 0.5 * frac(Math.sin(seed + i * 1.7) * 43758.5453);
    const rad = r * j;
    pts.push([+(cx + Math.cos(ang) * rad).toFixed(1), +(cy + Math.sin(ang) * rad).toFixed(1)]);
  }
  return pts;
}

const NEIGHBORHOODS = [
  { id: 'shinjuku', name: 'Shinjuku',  c: [440, 540], r: 175, seed: 3 },
  { id: 'shibuya',  name: 'Shibuya',   c: [660, 650], r: 165, seed: 11 },
  { id: 'harajuku', name: 'Harajuku',  c: [520, 835], r: 150, seed: 19 },
  { id: 'roppongi', name: 'Roppongi',  c: [870, 705], r: 160, seed: 27 },
  { id: 'yoyogi',   name: 'Yoyogi Park', c: [285, 870], r: 195, seed: 7, park: true },
].map(n => ({ ...n, poly: makePoly(n.c[0], n.c[1], n.r, n.seed) }));

// category → which "filter" surfaces it as the primary result
const POIS = [
  // ── Shinjuku — 3 eateries ──
  { id: 'p1',  cat: 'restaurant', name: 'Omoide Yokochō',       x: 392, y: 500, hood: 'shinjuku', score: 96 },
  { id: 'p2',  cat: 'restaurant', name: 'Tsunahachi Tempura',   x: 486, y: 512, hood: 'shinjuku', score: 92 },
  { id: 'p3',  cat: 'restaurant', name: 'Kanae Sushi',          x: 452, y: 596, hood: 'shinjuku', score: 88 },
  { id: 'p4',  cat: 'viewpoint',  name: 'Metro Gov. Obs.',      x: 372, y: 566, hood: 'shinjuku', score: 90 },
  { id: 'p5',  cat: 'cafe',       name: 'Blue Bottle Shinjuku', x: 500, y: 470, hood: 'shinjuku', score: 80 },

  // ── Shibuya — 4 eateries ──
  { id: 'p6',  cat: 'restaurant', name: 'Uobei Sushi',          x: 620, y: 614, hood: 'shibuya', score: 95 },
  { id: 'p7',  cat: 'restaurant', name: 'Gyukatsu Motomura',    x: 700, y: 628, hood: 'shibuya', score: 93 },
  { id: 'p8',  cat: 'restaurant', name: 'Katsu Midori',         x: 656, y: 690, hood: 'shibuya', score: 89 },
  { id: 'p9',  cat: 'restaurant', name: 'Rokkasen',             x: 612, y: 700, hood: 'shibuya', score: 84 },
  { id: 'p10', cat: 'viewpoint',  name: 'Shibuya Sky',          x: 716, y: 672, hood: 'shibuya', score: 94 },
  { id: 'p11', cat: 'cafe',       name: 'Fuglen Tokyo',         x: 600, y: 656, hood: 'shibuya', score: 82 },

  // ── Harajuku — 2 eateries ──
  { id: 'p12', cat: 'restaurant', name: 'Maisen Tonkatsu',      x: 494, y: 808, hood: 'harajuku', score: 91 },
  { id: 'p13', cat: 'restaurant', name: 'Afuri Ramen',          x: 556, y: 850, hood: 'harajuku', score: 86 },
  { id: 'p14', cat: 'museum',     name: 'Ukiyo-e Ōta',          x: 520, y: 800, hood: 'harajuku', score: 78 },

  // ── Roppongi — 3 eateries ──
  { id: 'p15', cat: 'restaurant', name: 'Gonpachi',             x: 826, y: 668, hood: 'roppongi', score: 90 },
  { id: 'p16', cat: 'restaurant', name: 'Jōmon',                x: 902, y: 692, hood: 'roppongi', score: 88 },
  { id: 'p17', cat: 'restaurant', name: 'Sushi Zanmai',         x: 866, y: 752, hood: 'roppongi', score: 83 },
  { id: 'p18', cat: 'museum',     name: 'Mori Art Museum',      x: 902, y: 716, hood: 'roppongi', score: 92 },

  // ── Yoyogi Park — NO eateries (empty-area demo) ──
  { id: 'p19', cat: 'park',       name: 'Yoyogi Park',          x: 268, y: 858, hood: 'yoyogi', score: 90 },
  { id: 'p20', cat: 'viewpoint',  name: 'Yoyogi Hill',          x: 330, y: 818, hood: 'yoyogi', score: 84 },
  { id: 'p21', cat: 'park',       name: 'Meiji Jingū',          x: 232, y: 930, hood: 'yoyogi', score: 88 },
  { id: 'p22', cat: 'cafe',       name: 'Little Nap Coffee',    x: 320, y: 922, hood: 'yoyogi', score: 79 },
];

const FILTERS = {
  eateries:   { cat: 'restaurant', label: 'Best eateries',  short: 'eateries',  icon: 'restaurant' },
  cafes:      { cat: 'cafe',       label: 'Cozy cafés',      short: 'cafés',     icon: 'coffee' },
  viewpoints: { cat: 'viewpoint',  label: 'Top viewpoints',  short: 'viewpoints', icon: 'viewpoint' },
};

const CAT_COLOR = {
  restaurant: '#bf7a8a', cafe: '#c8a050', park: '#6daa76',
  museum: '#c4a04a', viewpoint: '#7c9fd6',
};

const WORLD = { w: 1200, h: 1600 };

Object.assign(window, { NEIGHBORHOODS, POIS, FILTERS, CAT_COLOR, WORLD });
