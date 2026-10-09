import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { UserError } from './orders/plan';
import { isMember } from './repo';

/** Convierte errores conocidos en respuestas claras para la app; el resto se registra y se oculta. */
export function wrap<I, O>(fn: (req: CallableRequest<I>) => Promise<O>) {
  return async (req: CallableRequest<I>): Promise<O> => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e instanceof UserError) throw new HttpsError(e.code, e.message);
      if (e instanceof ZodError) {
        throw new HttpsError('invalid-argument', e.issues[0]?.message ?? 'Revisá los datos.', { issues: e.issues });
      }
      logger.error('Error inesperado', { error: e instanceof Error ? e.stack : String(e) });
      throw new HttpsError('internal', 'Algo salió mal. Probá de nuevo en unos minutos.');
    }
  };
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function requireUid(req: CallableRequest<unknown>): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Iniciá sesión para continuar.');
  return uid;
}

export async function requireMember(req: CallableRequest<unknown>, storeId: string, roles?: Array<'duena' | 'empleada'>) {
  const uid = requireUid(req);
  if (!(await isMember(storeId, uid, roles))) {
    throw new HttpsError('permission-denied', 'No tenés permiso para hacer esto en esta tienda.');
  }
  return uid;
}
