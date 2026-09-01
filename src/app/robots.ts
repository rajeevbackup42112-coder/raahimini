import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ride.myraahi.co.in').replace(/\/$/, '');
  const publicDiscovery = process.env.NEXT_PUBLIC_PUBLIC_DISCOVERY_ENABLED === 'true';
  if (!publicDiscovery) return { rules: [{ userAgent: '*', disallow: '/' }], host: siteUrl };

  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin-', '/admin-panel', '/driver-', '/login', '/profile', '/request-', '/resume-seat-request', '/active-car-screen', '/shared-trip', '/auth/', '/api/', '/test-login'],
    }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
