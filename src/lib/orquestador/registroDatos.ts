// Agentes con función real, leídos de la ficha en la base (AgenteFicha + AgenteComunicacion) en vez del código.
// Si la base no responde, se usa el registro fijo de registro.ts para no dejar al portal sin saber qué agentes existen.
import { prisma } from '@/lib/prisma';
import { AGENTES_FUNCIONALES, NOMBRE_AGENTE, type InfoAgente } from '@/lib/orquestador/registro';

const TTL_MS = 8_000;
interface Vista { datos: Record<string, InfoAgente>; nombres: Record<string, string>; hasta: number }
let cache: Vista | null = null;

interface Fila {
  slug: string; name: string; herramientas: string[] | null; funciones: string[] | null; canales: string[] | null;
  bot: string | null; etiquetas: Record<string, string> | null; colabora: string[] | null;
}

async function cargar(): Promise<Vista> {
  if (cache && cache.hasta > Date.now()) return cache;
  try {
    const filas = await prisma.$queryRaw<Fila[]>`
      select a.slug, a.name, f.herramientas, f.funciones, f.canales, f.bot, f."etiquetasAcciones" as etiquetas,
        (select array_agg(c.destino) from "AgenteComunicacion" c where c."agenteSlug" = a.slug and c."tipoDestino" = 'AGENTE') as colabora
      from "AgenteFicha" f join "Agent" a on a.slug = f.slug`;
    const datos: Record<string, InfoAgente> = {};
    const nombres: Record<string, string> = {};
    for (const f of filas) {
      nombres[f.slug] = f.name;
      if (!f.herramientas?.length) continue; // sin herramientas = ficha sin función real
      datos[f.slug] = {
        funciones: f.funciones ?? [],
        canales: f.canales ?? [],
        bot: f.bot ?? undefined,
        colabora: f.colabora ?? [],
        acciones: f.herramientas.map(clave => ({ clave, etiqueta: f.etiquetas?.[clave] ?? clave })),
      };
    }
    cache = { datos, nombres, hasta: Date.now() + TTL_MS };
    return cache;
  } catch (e) {
    console.error('[agentes] no pude leer las fichas; uso el registro fijo:', e instanceof Error ? e.message : e);
    return { datos: AGENTES_FUNCIONALES, nombres: NOMBRE_AGENTE, hasta: 0 };
  }
}

export async function agentesFuncionales(): Promise<Record<string, InfoAgente>> {
  return (await cargar()).datos;
}

export async function nombreAgente(slug: string): Promise<string> {
  return (await cargar()).nombres[slug] || NOMBRE_AGENTE[slug] || slug;
}

export function olvidarRegistro() { cache = null; }
