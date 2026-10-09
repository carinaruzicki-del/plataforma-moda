import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cada tienda vive en su subdominio: alma.nuestramarca.com.ar → /t/alma.
 * En desarrollo (localhost) no hay subdominios y la ruta /t/<subdominio> se usa directo.
 * Los dominios propios de los comercios llegan en la etapa 3.
 */
const PLATFORM_DOMAIN = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000').toLowerCase();

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase();
  const url = req.nextUrl;
  if (host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}` || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return NextResponse.next();
  }
  if (host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    const sub = host.slice(0, -(PLATFORM_DOMAIN.length + 1));
    if (sub && !sub.includes('.') && !url.pathname.startsWith('/t/')) {
      url.pathname = `/t/${sub}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
