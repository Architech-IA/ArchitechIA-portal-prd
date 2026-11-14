// Memoria conversacional corta de los agentes: los últimos mensajes de cada conversación (agente + clave), con caducidad.
// No es memoria larga: sirve para que «el jueves a las 3» complete lo que se pidió antes, o «muévela una hora más tarde» sepa cuál.
import { prisma } from '@/lib/prisma';
import { recortarHistorial, MEMORIA_TTL_MIN, MEMORIA_MAX_CHARS, type MensajeMemoria } from './nucleo';

export async function cargarHistorial(agente: string, clave: string) {
  try {
    const desde = new Date(Date.now() - MEMORIA_TTL_MIN * 60_000);
    const filas = await prisma.$queryRaw<{ rol: string; contenido: string; createdAt: Date }[]>`
      select rol, contenido, "createdAt" from "AgenteMemoria" where agente = ${agente} and clave = ${clave} and "createdAt" >= ${desde} order by "createdAt" desc limit 24`;
    return recortarHistorial(filas.map(f => ({ rol: f.rol as MensajeMemoria['rol'], contenido: f.contenido, createdAt: f.createdAt })), new Date());
  } catch (e) {
    console.error('[memoria] no pude leer el historial:', e instanceof Error ? e.message : e);
    return []; // sin memoria el agente sigue funcionando, solo que sin contexto previo
  }
}

export async function guardarTurno(agente: string, clave: string, usuario: string, asistente: string) {
  try {
    await prisma.$executeRaw`insert into "AgenteMemoria" (agente, clave, rol, contenido, "createdAt") values
      (${agente}, ${clave}, 'user', ${usuario.slice(0, MEMORIA_MAX_CHARS)}, now()),
      (${agente}, ${clave}, 'assistant', ${asistente.slice(0, MEMORIA_MAX_CHARS)}, now() + interval '1 millisecond')`;
    // Limpieza oportunista: nada de más de un día
    await prisma.$executeRaw`delete from "AgenteMemoria" where "createdAt" < now() - interval '1 day'`;
  } catch (e) {
    console.error('[memoria] no pude guardar el turno:', e instanceof Error ? e.message : e);
  }
}

export async function olvidar(agente: string, clave: string): Promise<number> {
  return prisma.$executeRaw`delete from "AgenteMemoria" where agente = ${agente} and clave = ${clave}`;
}
