"""
sage_locks.py — Locks distribuidos y canal de coordinación para agentes SAGE
Usa Redis (172.18.0.2:6379) como backend de coordinación.

Estrategia de locks:
  - Recurso de vault:   sage:lock:vault:<agent_id>:<note_path>
  - Tarea compartida:   sage:lock:task:<task_id>
  - Recurso externo:    sage:lock:resource:<resource_name>

Reglas:
  - TTL máximo: 60s para operaciones rápidas, 300s para ejecuciones largas
  - El lock incluye el agent_id como valor para identificar al dueño
  - Deadlock: lock con TTL expirado o dueño que ya no existe → limpiar
  - Pub/sub: canal sage:events para notificaciones cross-agent
"""
import time
import json
import threading
from datetime import datetime, timezone
from typing import Optional, Callable
import redis

REDIS_HOST = "172.18.0.2"
REDIS_PORT = 6379
LOCK_PREFIX = "sage:lock"
EVENT_CHANNEL = "sage:events"


def _redis() -> redis.Redis:
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, socket_connect_timeout=3)


# ─── Lock distribuido ─────────────────────────────────────────────────────────

class ResourceLock:
    """
    Lock distribuido sobre un recurso arbitrario usando Redis SET NX EX.
    Uso como context manager:
        with ResourceLock("vault", "ares/clientes/acme") as lock:
            # recurso protegido
    """

    def __init__(self, resource_type: str, resource_id: str, owner: str = "harness", ttl: int = 60):
        self.key = f"{LOCK_PREFIX}:{resource_type}:{resource_id.replace('/', ':')}"
        self.owner = owner
        self.ttl = ttl
        self.r = _redis()
        self._acquired = False

    def acquire(self) -> bool:
        """Intenta adquirir el lock. Retorna True si lo obtuvo."""
        value = json.dumps({"owner": self.owner, "acquired_at": datetime.now(timezone.utc).isoformat()})
        result = self.r.set(self.key, value, nx=True, ex=self.ttl)
        self._acquired = bool(result)
        return self._acquired

    def acquire_wait(self, timeout: float = 10.0, interval: float = 0.2) -> bool:
        """Espera hasta obtener el lock o hasta que expire el timeout."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.acquire():
                return True
            time.sleep(interval)
        return False

    def release(self):
        """Libera el lock solo si somos el dueño."""
        current = self.r.get(self.key)
        if current:
            try:
                data = json.loads(current)
                if data.get("owner") == self.owner:
                    self.r.delete(self.key)
                    self._acquired = False
            except Exception:
                pass

    def extend(self, extra_ttl: int = 60):
        """Extiende el TTL del lock si aún somos dueños."""
        current = self.r.get(self.key)
        if current:
            try:
                data = json.loads(current)
                if data.get("owner") == self.owner:
                    self.r.expire(self.key, extra_ttl)
            except Exception:
                pass

    def info(self) -> Optional[dict]:
        """Retorna metadata del lock actual."""
        raw = self.r.get(self.key)
        if not raw:
            return None
        data = json.loads(raw)
        ttl = self.r.ttl(self.key)
        data["ttl_remaining"] = ttl
        data["key"] = self.key
        return data

    def __enter__(self):
        if not self.acquire_wait():
            raise TimeoutError(f"No se pudo adquirir lock sobre '{self.key}' en el tiempo límite")
        return self

    def __exit__(self, *args):
        self.release()


# ─── Detección y limpieza de deadlocks ───────────────────────────────────────

def scan_locks() -> list[dict]:
    """Lista todos los locks activos con su TTL y dueño."""
    r = _redis()
    keys = r.keys(f"{LOCK_PREFIX}:*")
    locks = []
    for key in keys:
        raw = r.get(key)
        ttl = r.ttl(key)
        if raw:
            try:
                data = json.loads(raw)
                locks.append({"key": key, "owner": data.get("owner"), "acquired_at": data.get("acquired_at"), "ttl_remaining": ttl})
            except Exception:
                locks.append({"key": key, "raw": raw, "ttl_remaining": ttl})
    return locks


def scan_deadlocks() -> list[dict]:
    """
    Detecta locks huérfanos o expirados problemáticos.
    Un lock es sospechoso si:
      - TTL = -1 (no tiene expiración → nunca se libera)
      - TTL = -2 (ya expiró pero aún aparece en scan)
    """
    r = _redis()
    keys = r.keys(f"{LOCK_PREFIX}:*")
    suspects = []
    for key in keys:
        ttl = r.ttl(key)
        if ttl == -1:  # Sin TTL — lock huérfano
            raw = r.get(key)
            suspects.append({"key": key, "issue": "no_ttl", "raw": raw})
    return suspects


def force_release(key: str) -> bool:
    """Fuerza la liberación de un lock huérfano (uso de emergencia)."""
    r = _redis()
    result = r.delete(key)
    return bool(result)


def cleanup_orphaned_locks() -> int:
    """Limpia automáticamente locks sin TTL (huérfanos). Retorna cuántos limpió."""
    suspects = scan_deadlocks()
    cleaned = 0
    for lock in suspects:
        if force_release(lock["key"]):
            cleaned += 1
    return cleaned


# ─── Canal pub/sub de coordinación ───────────────────────────────────────────

class AgentChannel:
    """
    Canal pub/sub Redis para notificaciones cross-agent.
    Los agentes publican eventos y se suscriben para recibirlos.

    Eventos estándar:
      { "type": "task_ready", "from": "atlas", "to": "ares", "payload": {...} }
      { "type": "resource_released", "from": "ares", "resource": "vault:clientes/acme" }
      { "type": "broadcast", "from": "harness", "message": "..." }
    """

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.r = _redis()

    def publish(self, event_type: str, payload: dict = None, to: str = None):
        """Publica un evento en el canal sage:events."""
        event = {
            "type": event_type,
            "from": self.agent_id,
            "to": to,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.r.publish(EVENT_CHANNEL, json.dumps(event))
        return event

    def subscribe(self, callback: Callable[[dict], None], event_types: list[str] = None):
        """
        Suscribe al canal en un hilo separado.
        callback(event_dict) se llama por cada evento recibido.
        event_types filtra por tipo si se especifica.
        Retorna el thread (llamar .stop() para detener).
        """
        pubsub = self.r.pubsub()
        pubsub.subscribe(EVENT_CHANNEL)
        stop_event = threading.Event()

        def _listen():
            for message in pubsub.listen():
                if stop_event.is_set():
                    break
                if message["type"] == "message":
                    try:
                        event = json.loads(message["data"])
                        # Filtrar por destinatario o broadcast
                        if event.get("to") and event["to"] != self.agent_id:
                            continue
                        # Filtrar por tipo si se especificó
                        if event_types and event.get("type") not in event_types:
                            continue
                        callback(event)
                    except Exception:
                        pass

        t = threading.Thread(target=_listen, daemon=True)
        t.stop = lambda: stop_event.set()  # type: ignore
        t.start()
        return t

    def notify(self, to: str, message: str, payload: dict = None):
        """Shorthand: notifica directamente a otro agente."""
        return self.publish("direct_message", payload={"message": message, **(payload or {})}, to=to)
