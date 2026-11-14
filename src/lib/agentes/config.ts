// Control de agentes: pausar, bloquear acciones y reglas adicionales, con historial. La configuración se lee en cada
// pedido (con una caché de unos segundos), así que un cambio desde el Directory rige sin desplegar.
import { prisma } from '@/lib/prisma';
import { AGENTES_FUNCIONALES, NOMBRE_AGENTE } from '@/lib/orquestador/registro';
import { CONFIG_POR_DEFECTO, evaluar, bloqueReglas, resumenCambio, type ConfigAgente, type Veredicto } from './nucleo';

const TTL_MS = 8_000;
const cache = new Map<string, { cfg: ConfigAgente; hasta: number }>();

export async function obtenerConfig(slug: string): Promise<ConfigAgente> {
  const c = cache.get(slug);
  if (c && c.hasta > Date.now()) return c.cfg;
  let cfg = CONFIG_POR_DEFECTO;
  try {
    const f = (await prisma.$queryRaw<{ activo: boolean; accionesBloqueadas: string[]; reglas: string }[]>`select activo, "accionesBloqueadas", reglas from "AgenteConfig" where slug = ${slug}`)[0];
    if (f) cfg = { activo: f.activo, accionesBloqueadas: f.accionesBloqueadas ?? [], reglas: f.reglas ?? '' };
  } catch (e) {
    // Si no se puede leer, el agente sigue con su configuración por defecto (no se bloquea el servicio por un fallo de lectura)
    console.error('[agentes] no pude leer la configuración de', slug, e instanceof Error ? e.message : e);
  }
  cache.set(slug, { cfg, hasta: Date.now() + TTL_MS });
  return cfg;
}

export async function puedeActuar(slug: string, accion: string): Promise<Veredicto> {
  return evaluar(NOMBRE_AGENTE[slug] || slug, await obtenerConfig(slug), accion);
}

// Texto para sumar al final del prompt del agente (vacío si no hay reglas adicionales)
export async function reglasExtra(slug: string): Promise<string> {
  return bloqueReglas(await obtenerConfig(slug));
}

export function accionesDe(slug: string): string[] {
  return (AGENTES_FUNCIONALES[slug]?.acciones ?? []).map(a => a.clave);
}

export async function guardarConfig(slug: string, nueva: ConfigAgente, porNombre: string, porId: string): Promise<string> {
  const antes = await obtenerConfig(slug);
  const resumen = resumenCambio(antes, nueva);
  if (resumen === 'sin cambios') return resumen;
  await prisma.$executeRaw`insert into "AgenteConfig" (slug, activo, "accionesBloqueadas", reglas, "actualizadoPor", "updatedAt")
    values (${slug}, ${nueva.activo}, ${nueva.accionesBloqueadas}::text[], ${nueva.reglas}, ${porId}, now())
    on conflict (slug) do update set activo = excluded.activo, "accionesBloqueadas" = excluded."accionesBloqueadas", reglas = excluded.reglas, "actualizadoPor" = excluded."actualizadoPor", "updatedAt" = now()`;
  await prisma.$executeRaw`insert into "AgenteConfigHistorial" (slug, "porNombre", resumen, antes, despues) values (${slug}, ${porNombre}, ${resumen}, ${JSON.stringify(antes)}, ${JSON.stringify(nueva)})`;
  cache.delete(slug);
  return resumen;
}

export async function historialConfig(slug: string) {
  return prisma.$queryRaw<{ id: string; porNombre: string; resumen: string; antes: string; createdAt: Date }[]>`
    select id, "porNombre", resumen, antes, "createdAt" from "AgenteConfigHistorial" where slug = ${slug} order by "createdAt" desc limit 15`;
}
