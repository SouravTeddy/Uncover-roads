const preloaded = new Set<string>();

export function preloadImages(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url || preloaded.has(url)) continue;
    preloaded.add(url);
    const img = new Image();
    img.src = url;
  }
}

export function isPreloaded(url: string | null | undefined): boolean {
  return !!url && preloaded.has(url);
}

export function getPreloadedUrls(): string[] {
  return [...preloaded];
}
