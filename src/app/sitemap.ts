import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ride.myraahi.co.in').replace(/\/$/, '');
  const entries: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [
    ['/', 'daily', 1],
    ['/outstation', 'daily', 0.9],
    ['/offers', 'daily', 0.7],
    ['/contact', 'monthly', 0.5],
    ['/terms', 'monthly', 0.3],
    ['/privacy', 'monthly', 0.3],
  ];
  return entries.map(([path, changeFrequency, priority]) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
