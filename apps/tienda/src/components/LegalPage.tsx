'use client';

import { formatCuit, formatPesos, PLATFORM_NAME, TAX_STATUS_LABEL, WITHDRAWAL_DAYS } from '@plataforma/core';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';

/**
 * Textos legales de la tienda, armados con sus propios datos. Son la base que pide la ley
 * (Ley 24.240, CCyC arts. 1100–1116, Res. 424/2020 y 271/2020, Ley 25.326). La tienda puede
 * mejorar los plazos pero nunca bajar los mínimos legales.
 */
export function LegalPage() {
  const { store, href } = useStore();
  if (!store) return null;
  const f = store.fiscal;
  const seller = f ? `${f.legalName}, CUIT ${formatCuit(f.cuit)}, con domicilio en ${f.address}` : `${store.name}`;
  const contact = [store.contact.email, store.contact.whatsapp && `WhatsApp ${store.contact.whatsapp}`].filter(Boolean).join(' · ');
  const zones = store.flatShipping?.enabled ? store.flatShipping.zones : [];

  return (
    <article className="legal">
      <h1>Cómo comprar, envíos, cambios y términos</h1>
      <nav className="chips" aria-label="Secciones">
        {[
          ['como-comprar', 'Cómo comprar'],
          ['envios', 'Envíos'],
          ['cambios', 'Cambios y devoluciones'],
          ['arrepentimiento', 'Arrepentimiento'],
          ['terminos', 'Términos'],
          ['privacidad', 'Privacidad'],
        ].map(([id, l]) => <a key={id} className="chip" href={`#${id}`}>{l}</a>)}
      </nav>

      <section id="como-comprar">
        <h2>Cómo comprar</h2>
        <ol>
          <li>Elegí tus prendas en el catálogo o pedile ideas a <Link className="link" href={href('/que-me-pongo')}>¿Qué me pongo?</Link>. Revisá la guía de talles.</li>
          <li>Elegí el talle y tocá «Sumar al carrito».</li>
          <li>En el carrito poné tu código postal: ves el costo de envío antes de pagar.</li>
          <li>Completá tus datos. No hace falta crear una cuenta.</li>
          <li>Pagá con Mercado Pago: tarjeta de crédito o débito, dinero en cuenta o efectivo.</li>
          <li>Te llega un email con el número de pedido. Lo seguís en <Link className="link" href={href('/pedido')}>Mis pedidos</Link>.</li>
        </ol>
        {contact && <p>¿Dudas? Escribinos: {contact}.</p>}
      </section>

      <section id="envios">
        <h2>Envíos</h2>
        {zones.length > 0 ? (
          <ul>
            {zones.map((z) => (
              <li key={z.id}>
                <b>{z.name}</b>: {z.price ? formatPesos(z.price) : 'gratis'}
                {z.eta ? ` · ${z.eta}` : ''}
                {z.freeFrom ? ` · gratis en compras desde ${formatPesos(z.freeFrom)}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>Por ahora esta tienda no hace envíos a domicilio.</p>
        )}
        {store.pickup?.enabled && <p>Retiro en el local: {store.pickup.address} · {store.pickup.hours}. Te avisamos por email cuando esté listo.</p>}
        <p>Despachamos dentro de los 3 días hábiles de acreditado el pago y te mandamos el número de seguimiento. Si no recibís tu pedido en el plazo informado, escribinos y lo resolvemos.</p>
      </section>

      <section id="cambios">
        <h2>Cambios y devoluciones</h2>
        <p><b>Cambios por talle o color:</b> tenés 30 días corridos desde que recibís el pedido. La prenda tiene que estar sin uso, sin lavar y con etiquetas.</p>
        <p><b>Prendas con falla:</b> tenés la garantía legal de 6 meses (Ley 24.240, art. 11). Te la cambiamos o te devolvemos el dinero, y el envío corre por nuestra cuenta.</p>
        <p><b>Reintegros:</b> por el mismo medio de pago. Los plazos de acreditación dependen de tu banco o tarjeta.</p>
      </section>

      <section id="arrepentimiento">
        <h2>Botón de arrepentimiento</h2>
        <p>
          Podés arrepentirte de tu compra dentro de los {WITHDRAWAL_DAYS} días corridos desde que recibiste el producto, sin explicar el motivo
          (Ley 24.240, art. 34, y Código Civil y Comercial, art. 1110). No necesitás registrarte: usá el{' '}
          <Link className="link" href={href('/arrepentimiento')}>Botón de arrepentimiento</Link> o el botón dentro de tu pedido.
          Te mandamos un código de trámite. La devolución es sin costo para vos y te reintegramos el total pagado, incluido el envío.
        </p>
      </section>

      <section id="terminos">
        <h2>Términos de la tienda</h2>
        <p>
          Esta tienda es operada por {seller}{f ? ` (${TAX_STATUS_LABEL[f.taxStatus]})` : ''}. Es la única vendedora de los productos publicados y responsable
          de su calidad, entrega, garantía y atención. Los precios están en pesos e incluyen IVA. Las promociones valen hasta agotar stock o la fecha indicada.
        </p>
        <p>
          La tienda funciona con la tecnología de {PLATFORM_NAME}, que no participa en la venta. Los pagos los procesa Mercado Pago:
          la tienda no ve ni guarda los datos de tu tarjeta.
        </p>
        <p>
          Si tenés un reclamo que no resolvimos, podés acudir a la{' '}
          <a className="link" href="https://www.argentina.gob.ar/servicio/iniciar-un-reclamo-ante-defensa-del-consumidor" target="_blank" rel="noreferrer">Ventanilla Federal de Reclamos de Defensa del Consumidor</a>{' '}
          o a la oficina de Defensa del Consumidor de tu localidad.
        </p>
      </section>

      <section id="privacidad">
        <h2>Privacidad</h2>
        <p>
          Responsable de tus datos: {seller}. Usamos tu nombre, email, teléfono y dirección solo para preparar, cobrar y enviar tu pedido y para atenderte.
          Si usás ¿Qué me pongo?, tus talles y gustos se guardan en tu dispositivo (o en tu cuenta, si tenés). No vendemos tus datos.
        </p>
        <p>
          Los compartimos solo con quien hace falta para tu compra: Mercado Pago, la empresa de envío y el proveedor de servidores
          ({PLATFORM_NAME} usa Google Firebase, con servidores en Brasil y Estados Unidos).
        </p>
        <p>
          Podés pedir ver, corregir o borrar tus datos escribiendo a {store.contact.email || 'la tienda'}. Desde tu cuenta también podés borrar tus direcciones.
        </p>
        <p className="small muted">
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses,
          salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA
          INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
          quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
        <p className="small muted">Usamos solo el almacenamiento necesario para que funcionen el carrito y tu sesión. No usamos cookies de publicidad.</p>
      </section>
    </article>
  );
}
