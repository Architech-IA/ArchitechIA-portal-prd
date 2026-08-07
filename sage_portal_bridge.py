"""
sage_portal_bridge.py — Bridge HTTP entre agentes SAGE y el portal ArchiTechIA

Permite a los agentes:
  - Leer tareas del backlog asignadas a ellos
  - Filtrar por sprint activo
  - Actualizar el estado de una tarea (TODO → IN_PROGRESS → DONE)
  - Registrar el resultado de ejecución

Autenticación: x-api-key header con INTERNAL_API_KEY del portal.
  Configurar: PORTAL_API_KEY=<valor> en el entorno, o pasarlo al constructor.
  El valor se puede leer del .env del portal en el VPS:
    grep INTERNAL_API_KEY /root/portal-architechia/.env | cut -d= -f2

Uso:
    from sage_portal_bridge import PortalClient
    client = PortalClient()
    tasks = client.get_assigned_tasks(agent_slug="atlas")
    client.mark_in_progress(task)
    client.mark_done(task, resultado="análisis completado", duration_s=12.3)
"""
import os
import json
import time
from datetime import datetime, timezone
from typing import Optional
import urllib.request
import urllib.parse
import urllib.error

# ─── Config ───────────────────────────────────────────────────────────────────

PORTAL_URL = os.environ.get("PORTAL_URL", "http://localhost:3003")
PORTAL_API_KEY_PATH = "/root/portal-architechia/.env"

# Mapa slug de agente → assigneeName en el portal
AGENT_NAMES = {
    "ares":   "SAGE-Ares",
    "atlas":  "SAGE-Atlas",
    "iris":   "SAGE-Iris",
    "orion":  "SAGE-Orion",
    "vesta":  "SAGE-Vesta",
    "freddy": "Freddy Orozco",  # usuario humano
}


def _load_api_key() -> str:
    """Lee PORTAL_API_KEY del entorno o del .env del portal."""
    key = os.environ.get("PORTAL_API_KEY") or os.environ.get("INTERNAL_API_KEY")
    if key:
        return key.strip()
    # Leer del .env del portal (VPS)
    try:
        with open(PORTAL_API_KEY_PATH) as f:
            for line in f:
                if line.startswith("INTERNAL_API_KEY="):
                    return line.split("=", 1)[1].strip().strip("'\"")
    except Exception:
        pass
    raise RuntimeError("PORTAL_API_KEY no configurada. Exportar PORTAL_API_KEY=... o verificar .env del portal.")


# ─── ADE-0006-0001-001: Cliente HTTP para la API del portal ───────────────────

class PortalClient:
    """
    Cliente HTTP para la API REST del portal ArchiTechIA.
    Autenticación via x-api-key header (INTERNAL_API_KEY).
    """

    def __init__(self, portal_url: str = PORTAL_URL, api_key: str = None):
        self.base_url = portal_url.rstrip("/")
        self.api_key = api_key or _load_api_key()

    def _request(self, method: str, path: str, body: dict = None) -> dict | list:
        """Ejecuta una llamada HTTP al portal con autenticación."""
        url = f"{self.base_url}{path}"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code} {method} {path}: {e.read().decode()[:200]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Connection error {method} {path}: {e.reason}")

    # ─── ADE-0006-0001-002: Listado de tareas asignadas al agente ─────────────

    def get_assigned_tasks(
        self,
        agent_slug: str = None,
        assignee_name: str = None,
        status: str = "TODO",
    ) -> list[dict]:
        """
        Retorna BacklogItems asignados al agente con el status dado.
        Filtra client-side sobre el GET /api/backlog (no requiere query params).
        """
        items = self._request("GET", "/api/backlog")
        name = assignee_name or AGENT_NAMES.get(agent_slug, agent_slug)
        filtered = [
            i for i in items
            if i.get("assigneeName") == name and i.get("status") == status
        ]
        return filtered

    # ─── ADE-0006-0001-003: Lectura de detalle de tarea ──────────────────────

    def get_task(self, task_code: str) -> Optional[dict]:
        """Retorna el BacklogItem completo dado su taskCode."""
        items = self._request("GET", "/api/backlog")
        for item in items:
            if item.get("taskCode") == task_code:
                return item
        return None

    def get_task_by_id(self, item_id: str) -> Optional[dict]:
        """Retorna el BacklogItem por su ID interno."""
        items = self._request("GET", "/api/backlog")
        for item in items:
            if item.get("id") == item_id:
                return item
        return None

    # ─── ADE-0006-0001-004: Filtrado por sprint activo ───────────────────────

    def get_active_sprints(self) -> list[dict]:
        """Retorna los sprints con status IN_PROGRESS."""
        sprints = self._request("GET", "/api/backlog/sprints")
        return [s for s in sprints if s.get("status") == "IN_PROGRESS"]

    def get_active_sprint_tasks(
        self,
        agent_slug: str = None,
        assignee_name: str = None,
        status: str = "TODO",
    ) -> list[dict]:
        """
        Tareas asignadas al agente en el sprint activo con el status dado.
        Si no hay sprint activo, retorna tareas sin filtro de sprint.
        """
        all_tasks = self.get_assigned_tasks(agent_slug=agent_slug, assignee_name=assignee_name, status=status)
        active_sprints = self.get_active_sprints()
        if not active_sprints:
            return all_tasks  # fallback: todas las asignadas
        active_ids = {s["id"] for s in active_sprints}
        sprint_tasks = [t for t in all_tasks if t.get("sprint", {}) and t["sprint"].get("id") in active_ids]
        return sprint_tasks if sprint_tasks else all_tasks

    # ─── ADE-0006-0002-001: Cambiar estado de tarea ──────────────────────────

    def update_status(self, item_id: str, status: str, extra: dict = None) -> dict:
        """PUT /api/backlog/[id] — actualiza el status y campos opcionales."""
        body = {"status": status, **(extra or {})}
        return self._request("PUT", f"/api/backlog/{item_id}", body)

    # ─── ADE-0006-0002-002: Registrar resultado ──────────────────────────────

    def update_resultado(self, item_id: str, resultado: str) -> dict:
        """PATCH /api/backlog/[id]/resultado — guarda el resultado de la ejecución."""
        return self._request("PATCH", f"/api/backlog/{item_id}/resultado", {"resultado": resultado})

    # ─── ADE-0006-0002-003: Marcado automático al iniciar ────────────────────

    def mark_in_progress(self, task: dict) -> dict:
        """
        Cambia el BacklogItem a IN_PROGRESS y registra fechaEjecucion = ahora.
        task debe tener al menos {"id": "...", "title": "..."}.
        """
        now = datetime.now(timezone.utc).isoformat()
        return self.update_status(
            task["id"],
            status="IN_PROGRESS",
            extra={"title": task.get("title", ""), "fechaEjecucion": now},
        )

    # ─── ADE-0006-0002-004: Marcado automático al finalizar ──────────────────

    def mark_done(self, task: dict, resultado: str = None, duration_s: float = None, failed: bool = False) -> dict:
        """
        Cambia el BacklogItem a DONE (o BACKLOG si failed=True para reintentar).
        Guarda el resultado como campo resultado en el item.
        """
        final_status = "DONE" if not failed else "BACKLOG"
        result_text = resultado or ("Ejecución fallida" if failed else "Completado")
        if duration_s is not None:
            result_text += f" [{duration_s:.1f}s]"

        # Actualizar status + fechaEjecucion
        updated = self.update_status(
            task["id"],
            status=final_status,
            extra={"title": task.get("title", ""), "resultado": result_text},
        )
        return updated

    # ─── Utilidades ──────────────────────────────────────────────────────────

    def health(self) -> bool:
        """Verifica que el portal esté accesible."""
        try:
            self._request("GET", "/api/backlog/sprints")
            return True
        except Exception:
            return False


# ─── ADE-0006-0001-005 / ADE-0006-0002-005: Tests ────────────────────────────

def _test_portal_bridge():
    """Test de ciclo completo: listar → leer → IN_PROGRESS → DONE."""
    print("=== Test 1: Health check ===")
    client = PortalClient()
    ok = client.health()
    print(f"Portal accesible: {ok}")
    assert ok, "Portal no responde"

    print("\n=== Test 2: Listar tareas asignadas a Freddy (humano) ===")
    tasks = client.get_assigned_tasks(agent_slug="freddy", status="DONE")
    print(f"Tareas DONE de Freddy: {len(tasks)}")
    assert isinstance(tasks, list)

    print("\n=== Test 3: Sprints activos ===")
    active = client.get_active_sprints()
    print(f"Sprints IN_PROGRESS: {len(active)}")
    for s in active[:3]:
        print(f"  {s.get('sprintCode')} — {s.get('name')}")

    print("\n=== Test 4: Leer tarea por taskCode ===")
    task = client.get_task("ADE-0006-0001-001")
    assert task is not None, "Tarea ADE-0006-0001-001 no encontrada"
    print(f"Tarea: {task['taskCode']} | status: {task['status']} | assignee: {task.get('assigneeName')}")

    print("\n=== Test 5: Filtrado por sprint activo ===")
    ade_tasks = client.get_assigned_tasks(assignee_name="Freddy Orozco", status="BACKLOG")
    print(f"Tareas BACKLOG de Freddy Orozco: {len(ade_tasks)}")
    if ade_tasks:
        sample = ade_tasks[0]
        sprint_name = sample.get("sprint", {}).get("name") if sample.get("sprint") else "sin sprint"
        print(f"  Ejemplo: {sample.get('taskCode')} en sprint '{sprint_name}'")

    print("\nTODOS LOS TESTS OK")
    return client


if __name__ == "__main__":
    _test_portal_bridge()
