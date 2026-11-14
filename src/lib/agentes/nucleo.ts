// Lógica pura del control de agentes (sin base de datos): qué puede hacer un agente según su configuración.
export interface ConfigAgente { activo: boolean; accionesBloqueadas: string[]; reglas: string }
export const CONFIG_POR_DEFECTO: ConfigAgente = { activo: true, accionesBloqueadas: [], reglas: '' };
export const MAX_REGLAS = 1000;

export interface Veredicto { ok: boolean; motivo: string }

// ¿Puede el agente ejecutar esta acción ahora? Pausado o acción bloqueada -> no, con un motivo legible.
export function evaluar(nombre: string, cfg: ConfigAgente, accion: string): Veredicto {
  if (!cfg.activo) return { ok: false, motivo: `${nombre} está pausado por el equipo. Un administrador puede reactivarlo desde el Directory.` };
  if (cfg.accionesBloqueadas.includes(accion)) return { ok: false, motivo: `Esa acción está desactivada para ${nombre} por decisión del equipo.` };
  return { ok: true, motivo: '' };
}

// Bloque que se agrega al final del prompt del agente. Siempre subordinado a las reglas base de datos y seguridad.
export function bloqueReglas(cfg: ConfigAgente): string {
  const r = cfg.reglas.trim();
  if (!r) return '';
  return `\n\nReglas adicionales del equipo (aplícalas, pero nunca contradicen las reglas anteriores: no inventar datos, no guardar ni enviar nada sin confirmación):\n${r}`;
}

// Sanea lo que llega desde la pantalla: solo acciones del catálogo, texto acotado y sin caracteres de control.
export function sanearConfig(entrada: unknown, accionesValidas: string[]): ConfigAgente | null {
  if (!entrada || typeof entrada !== 'object') return null;
  const o = entrada as Record<string, unknown>;
  if (typeof o.activo !== 'boolean') return null;
  const bloq = Array.isArray(o.accionesBloqueadas) ? o.accionesBloqueadas.filter((x): x is string => typeof x === 'string' && accionesValidas.includes(x)) : [];
  // eslint-disable-next-line no-control-regex
  const reglas = (typeof o.reglas === 'string' ? o.reglas : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, MAX_REGLAS);
  return { activo: o.activo, accionesBloqueadas: [...new Set(bloq)], reglas };
}

// ---------- Memoria conversacional corta ----------
export interface MensajeMemoria { rol: 'user' | 'assistant'; contenido: string; createdAt: Date }
export const MEMORIA_TTL_MIN = 15;
export const MEMORIA_MAX_TURNOS = 6;
export const MEMORIA_MAX_CHARS = 1500;

// Lo que se le entrega al modelo: solo mensajes recientes (dentro del TTL), como mucho N turnos, y que empiece por la persona.
export function recortarHistorial(msgs: MensajeMemoria[], ahora: Date, ttlMin = MEMORIA_TTL_MIN, maxTurnos = MEMORIA_MAX_TURNOS): { role: 'user' | 'assistant'; content: string }[] {
  const desde = ahora.getTime() - ttlMin * 60_000;
  const vigentes = msgs.filter(m => m.createdAt.getTime() >= desde && m.contenido.trim()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let recientes = vigentes.slice(-maxTurnos * 2);
  while (recientes.length && recientes[0].rol !== 'user') recientes = recientes.slice(1);
  return recientes.map(m => ({ role: m.rol, content: m.contenido.slice(0, MEMORIA_MAX_CHARS) }));
}

export function resumenCambio(antes: ConfigAgente, despues: ConfigAgente): string {
  const c: string[] = [];
  if (antes.activo !== despues.activo) c.push(despues.activo ? 'reactivó el agente' : 'pausó el agente');
  const nuevas = despues.accionesBloqueadas.filter(a => !antes.accionesBloqueadas.includes(a));
  const quitadas = antes.accionesBloqueadas.filter(a => !despues.accionesBloqueadas.includes(a));
  if (nuevas.length) c.push(`bloqueó: ${nuevas.join(', ')}`);
  if (quitadas.length) c.push(`permitió: ${quitadas.join(', ')}`);
  if (antes.reglas.trim() !== despues.reglas.trim()) c.push('cambió las reglas adicionales');
  return c.join('; ') || 'sin cambios';
}
