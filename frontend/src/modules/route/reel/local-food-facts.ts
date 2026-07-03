export interface LocalFoodFact {
  dish: string;     // e.g. "Masala dosa"
  context: string;  // e.g. "A South Indian staple — crispy rice crepe with spiced potato filling"
  where: string;    // e.g. "Best near MTR or any Darshini-style restaurant"
}

const FACTS: Record<string, LocalFoodFact> = {
  'bangalore':     { dish: 'Masala dosa',         context: 'A South Indian staple — crispy rice crepe with spiced potato filling, served with sambar and coconut chutney.',       where: 'Any Darshini-style restaurant or MTR' },
  'mumbai':        { dish: 'Vada pav',             context: 'The city\'s street food icon — a spiced potato fritter in a bread roll, eaten by millions every day.',               where: 'Street stalls outside any railway station' },
  'delhi':         { dish: 'Chole bhature',        context: 'Puffed fried bread with spiced chickpea curry — the classic Delhi breakfast that keeps you full until evening.',        where: 'Old Delhi\'s Paranthe Wali Gali or any halwai' },
  'tokyo':         { dish: 'Tonkotsu ramen',        context: 'Rich pork bone broth, thin noodles, soft-boiled egg — a dish that takes 12+ hours to make and seconds to finish.',   where: 'Ramen alleys in Shinjuku or Hakata area' },
  'kyoto':         { dish: 'Kaiseki',               context: 'Multi-course haute cuisine built around seasonal ingredients — the meal equivalent of a tea ceremony.',               where: 'Nishiki Market area or a traditional ryokan' },
  'paris':         { dish: 'Steak frites',          context: 'The honest Paris brasserie meal — pan-seared entrecôte, thin crispy frites, a glass of Côtes du Rhône.',             where: 'Any neighbourhood brasserie away from tourist squares' },
  'rome':          { dish: 'Cacio e pepe',          context: 'Three ingredients, infinite precision: pasta, pecorino, black pepper. The Roman simplicity test for any trattoria.',  where: 'Testaccio neighbourhood or Trastevere trattorias' },
  'barcelona':     { dish: 'Pa amb tomàquet',       context: 'Bread rubbed with ripe tomato and olive oil — the Catalan staple that pairs with everything.',                        where: 'Any bar with a terrace in the Gothic Quarter' },
  'istanbul':      { dish: 'Simit',                 context: 'Sesame-crusted bread rings sold by street carts — the city\'s morning ritual since the 16th century.',               where: 'Any street cart near the Bosphorus or Grand Bazaar' },
  'new york':      { dish: 'Bagel with lox',        context: 'New York\'s defining breakfast — a hand-rolled bagel, cream cheese, cured salmon. Simple perfection.',               where: 'Any classic Jewish deli in the Lower East Side' },
  'mexico city':   { dish: 'Tacos al pastor',       context: 'Pork shaved from a vertical spit, pineapple, cilantro, onion — originally Lebanese, now definitively Mexican.',      where: 'Late-night taquerías near La Condesa or Roma Norte' },
  'bangkok':       { dish: 'Pad krapao',            context: 'Stir-fried meat with holy basil and bird\'s eye chili — Thailand\'s most-ordered dish, available everywhere.',        where: 'Any street cart or shophouse restaurant' },
  'singapore':     { dish: 'Hainanese chicken rice', context: 'Poached chicken, fragrant rice cooked in chicken stock, three dipping sauces — the dish that defines the city.',   where: 'Maxwell Food Centre or Tian Tian Hainanese Chicken Rice' },
  'hong kong':     { dish: 'Dim sum',               context: 'Small steamed and fried dishes shared over tea — a weekend ritual that families return to every Sunday.',            where: 'Tim Ho Wan or any cha chaan teng' },
  'london':        { dish: 'Fish and chips',        context: 'Battered cod, thick-cut chips, malt vinegar and mushy peas — still the best in a newspaper cone by the Thames.',    where: 'Poppies in Spitalfields or Rock & Sole Plaice in Covent Garden' },
  'lisbon':        { dish: 'Pastel de nata',        context: 'Custard tart in a flaky pastry shell, dusted with cinnamon — invented by monks in Belém in the 18th century.',       where: 'Pastéis de Belém or any neighbourhood pastelaria' },
  'copenhagen':    { dish: 'Smørrebrød',            context: 'Open-faced rye bread with pickled herring, egg, or roast beef — Danish lunch architecture elevated to art.',         where: 'Torvehallerne market or traditional lunch restaurants' },
  'amsterdam':     { dish: 'Stroopwafel',           context: 'Two waffle layers bonded by caramel syrup — best placed on a hot cup of coffee to soften the filling.',             where: 'Any Albert Heijn supermarket or Stroopwafel Bakery at the Nieuwmarkt' },
  'dubai':         { dish: 'Shawarma',              context: 'Levantine spiced meat rolled in flatbread with garlic sauce — the midnight staple of Dubai\'s side streets.',        where: 'Al Ustad Special Kabab in Deira or any Al Safadi branch' },
  'sydney':        { dish: 'Meat pie',              context: 'Australia\'s answer to fast food — beef filling in a shortcrust pastry shell, eaten with a squeeze of tomato sauce.', where: 'Harry\'s Cafe de Wheels near the Woolloomooloo finger wharf' },
};

export function getLocalFoodFact(city: string): LocalFoodFact | null {
  const key = city.toLowerCase().replace(/\s+/g, ' ').trim();
  return FACTS[key] ?? null;
}
