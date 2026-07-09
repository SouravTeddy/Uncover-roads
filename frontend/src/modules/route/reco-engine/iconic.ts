import type { EngineItineraryStop } from '../../../shared/types';

interface IconicPlace {
  name: string;
  keywords: string[]; // lowercased substrings matched against stop names
}

const ICONIC_MUST_SEES: Record<string, IconicPlace[]> = {
  paris: [
    { name: 'Eiffel Tower',          keywords: ['eiffel'] },
    { name: 'The Louvre',            keywords: ['louvre'] },
  ],
  rome: [
    { name: 'Colosseum',             keywords: ['colosseo', 'colosseum'] },
    { name: 'Vatican',               keywords: ['vatican', 'sistine'] },
  ],
  barcelona: [
    { name: 'Sagrada Família',       keywords: ['sagrada', 'familia'] },
    { name: 'Park Güell',            keywords: ['güell', 'guell'] },
  ],
  london: [
    { name: 'Tower of London',       keywords: ['tower of london'] },
    { name: 'Westminster',           keywords: ['westminster', 'big ben'] },
  ],
  tokyo: [
    { name: 'Senso-ji Temple',       keywords: ['senso', 'asakusa'] },
    { name: 'Shibuya Crossing',      keywords: ['shibuya crossing'] },
  ],
  newyork: [
    { name: 'Central Park',          keywords: ['central park'] },
    { name: 'Empire State Building', keywords: ['empire state'] },
  ],
  new_york: [
    { name: 'Central Park',          keywords: ['central park'] },
    { name: 'Empire State Building', keywords: ['empire state'] },
  ],
  amsterdam: [
    { name: 'Rijksmuseum',           keywords: ['rijksmuseum'] },
    { name: 'Anne Frank House',      keywords: ['anne frank'] },
  ],
  istanbul: [
    { name: 'Hagia Sophia',          keywords: ['hagia sophia', 'aya sofya'] },
    { name: 'Grand Bazaar',          keywords: ['grand bazaar', 'kapalı çarşı'] },
  ],
  dubai: [
    { name: 'Burj Khalifa',          keywords: ['burj khalifa'] },
    { name: 'Dubai Museum',          keywords: ['dubai museum', 'dubai creek'] },
  ],
  singapore: [
    { name: 'Gardens by the Bay',    keywords: ['gardens by the bay', 'supertree'] },
    { name: 'Marina Bay Sands',      keywords: ['marina bay sands'] },
  ],
  bangkok: [
    { name: 'Grand Palace',          keywords: ['grand palace', 'wat phra kaew'] },
    { name: 'Wat Pho',               keywords: ['wat pho', 'reclining buddha'] },
  ],
  kyoto: [
    { name: 'Fushimi Inari Shrine',  keywords: ['fushimi inari'] },
    { name: 'Kinkaku-ji',            keywords: ['kinkaku', 'golden pavilion'] },
  ],
  berlin: [
    { name: 'Brandenburg Gate',      keywords: ['brandenburger tor', 'brandenburg gate'] },
    { name: 'Berlin Wall Memorial',  keywords: ['berlin wall', 'mauer', 'east side gallery'] },
  ],
  prague: [
    { name: 'Prague Castle',         keywords: ['prague castle', 'pražský hrad'] },
    { name: 'Charles Bridge',        keywords: ['charles bridge', 'karlův most'] },
  ],
  lisbon: [
    { name: 'Belém Tower',           keywords: ['belém', 'belem'] },
    { name: 'Jerónimos Monastery',   keywords: ['jerónimos', 'jeronimos'] },
  ],
  athens: [
    { name: 'Acropolis',             keywords: ['acropolis', 'parthenon'] },
  ],
  cairo: [
    { name: 'The Pyramids of Giza',  keywords: ['giza', 'pyramid', 'sphinx'] },
  ],
  mexico_city: [
    { name: 'Teotihuacán',           keywords: ['teotihuacan', 'teotihuacán'] },
    { name: 'Museo Nacional de Antropología', keywords: ['museo nacional', 'antropología'] },
  ],
  mexicocity: [
    { name: 'Teotihuacán',           keywords: ['teotihuacan', 'teotihuacán'] },
    { name: 'Museo Nacional de Antropología', keywords: ['museo nacional', 'antropología'] },
  ],
  rio_de_janeiro: [
    { name: 'Christ the Redeemer',   keywords: ['cristo redentor', 'christ the redeemer', 'corcovado'] },
    { name: 'Sugarloaf Mountain',    keywords: ['sugarloaf', 'pão de açúcar'] },
  ],
  riodejaneiro: [
    { name: 'Christ the Redeemer',   keywords: ['cristo redentor', 'christ the redeemer', 'corcovado'] },
    { name: 'Sugarloaf Mountain',    keywords: ['sugarloaf', 'pão de açúcar'] },
  ],
  marrakech: [
    { name: 'Djemaa el-Fna',         keywords: ['djemaa', 'jemaa el', 'djemâa'] },
    { name: 'Bahia Palace',          keywords: ['bahia palace', 'palais bahia'] },
  ],
  mumbai: [
    { name: 'Gateway of India',      keywords: ['gateway of india'] },
    { name: 'Elephanta Caves',       keywords: ['elephanta'] },
  ],
  sydney: [
    { name: 'Sydney Opera House',    keywords: ['opera house'] },
    { name: 'Harbour Bridge',        keywords: ['harbour bridge', 'harbor bridge'] },
  ],
  vienna: [
    { name: 'Schönbrunn Palace',     keywords: ['schönbrunn', 'schonbrunn'] },
    { name: 'St. Stephen\'s Cathedral', keywords: ['stephansdom', 'st stephen'] },
  ],
  florence: [
    { name: 'Uffizi Gallery',        keywords: ['uffizi'] },
    { name: 'Cathedral of Santa Maria', keywords: ['duomo', 'santa maria del fiore'] },
  ],
};

function cityKey(city: string): string {
  return city.toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Returns the first iconic place not found in ANY stop across all provided stops,
 * or null if all iconics are covered or the city has no table entry.
 *
 * Pass all itinerary stops (across all days) so a landmark added to day 2
 * doesn't surface an iconic-gap reco on day 1.
 */
export function detectIconicGap(
  allStops: EngineItineraryStop[],
  city: string,
): IconicPlace | null {
  const key = cityKey(city);
  const iconics = ICONIC_MUST_SEES[key];
  if (!iconics || iconics.length === 0) return null;

  const stopNames = allStops.map(s => s.name.toLowerCase());

  for (const iconic of iconics) {
    const covered = iconic.keywords.some(kw => stopNames.some(n => n.includes(kw)));
    if (!covered) return iconic;
  }
  return null;
}
