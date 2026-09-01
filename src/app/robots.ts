import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ride.myraahi.co.in';
  const publicDiscovery = process.env.NEXT_PUBLIC_PUBLIC_DISCOVERY_ENABLED === 'true';
  return publicDiscovery
    ? { rules: [{ userAgent: '*', allow: '/' }], host: siteUrl }
    : { rules: [{ userAgent: '*', disallow: '/' }], host: siteUrl };
}