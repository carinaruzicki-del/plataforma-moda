import { productInputSchema, type Product } from '@plataforma/core';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { parse, requireMember, wrap } from './callable';
import { db } from './firebase';
import { UserError } from './orders/plan';
import { paths } from './repo';

/**
 * Guardar una prenda pasa por el servidor (y no directo desde la app) porque el stock se
 * comparte con las compras en curso: las unidades apartadas por pedidos sin pagar se
 * conservan aunque la dueña edite el stock al mismo tiempo.
 */
export const saveProduct = onCall(
  wrap(async (req) => {
    const { storeId, productId, product } = parse(
      z.object({ storeId: z.string().min(1), productId: z.string().min(1).optional(), product: z.unknown() }),
      req.data,
    );
    await requireMember(req, storeId);
    const input = parse(productInputSchema, product);

    for (const m of [...input.media]) {
      if (!m.path.startsWith(`stores/${storeId}/media/`)) throw new UserError('Hay un archivo que no es de esta tienda.', 'invalid-argument');
    }

    const ref = productId ? paths.product(storeId, productId) : db.collection(`stores/${storeId}/products`).doc();
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const sections = input.sectionIds.length
        ? await tx.getAll(...input.sectionIds.map((id) => db.doc(`stores/${storeId}/sections/${id}`)))
        : [];
      const snap = await tx.get(ref);
      if (productId && !snap.exists) throw new UserError('No encontramos esa prenda.', 'not-found');
      const prev = snap.data() as Product | undefined;

      const variants = input.variants.map((v) => {
        const old = prev?.variants.find((x) => x.sku === v.sku);
        return { ...v, reserved: old?.reserved ?? 0 };
      });
      // Un talle con unidades apartadas no se puede borrar hasta que se resuelvan esos pedidos.
      for (const old of prev?.variants ?? []) {
        if (old.reserved > 0 && !variants.some((v) => v.sku === old.sku)) {
          throw new UserError(`El talle ${old.size} tiene compras en curso; esperá a que se resuelvan para borrarlo.`);
        }
      }

      const data: Omit<Product, 'id'> = {
        ...input,
        storeId,
        sectionIds: input.sectionIds.filter((_, i) => sections[i]?.exists),
        variants,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      tx.set(ref, data);
    });

    return { productId: ref.id };
  }),
);

export const deleteProduct = onCall(
  wrap(async (req) => {
    const { storeId, productId } = parse(z.object({ storeId: z.string().min(1), productId: z.string().min(1) }), req.data);
    await requireMember(req, storeId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(paths.product(storeId, productId));
      const p = snap.data() as Product | undefined;
      if (!p) return;
      if (p.variants.some((v) => v.reserved > 0)) {
        throw new UserError('Esta prenda tiene compras en curso. Ocultala y borrala cuando se resuelvan.');
      }
      tx.delete(snap.ref);
    });
    return { ok: true };
  }),
);
