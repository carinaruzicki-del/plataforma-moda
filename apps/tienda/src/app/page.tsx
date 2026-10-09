import Link from 'next/link';

/** Portada de la plataforma (la de cada tienda está en /t/<subdominio> o en su subdominio). */
export default function PlatformHome() {
  return (
    <main className="wrap center">
      <span className="eyebrow">Plataforma de tiendas de moda</span>
      <h1 style={{ fontSize: 'clamp(34px, 6vw, 60px)', maxWidth: 760 }}>Tu tienda de ropa online, con un asesor que arma looks con tus prendas.</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Cargá tu colección, cobrá con Mercado Pago y dejá que tus clientas descubran qué ponerse con lo que tenés en stock.
      </p>
      <p className="small muted">
        Para ver una tienda en desarrollo, entrá a <Link className="link" href="/t/demo">/t/&lt;dirección-de-la-tienda&gt;</Link>.
      </p>
    </main>
  );
}
