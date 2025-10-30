import { NextResponse } from 'next/server';

export async function GET() {
  const robotsTxt = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Disallow admin and api routes
Disallow: /api/

# Sitemap
Sitemap: ${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml
`;

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
