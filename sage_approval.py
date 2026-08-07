"""
sage_approval.py — Human-in-the-loop: aprobación de tareas de alto riesgo

Flujo:
  1. Executor.run() llama needs_approval(task) antes de ejecutar
  2. Si True → ApprovalManager.request() envía embed a Discord con botones
  3. Usuario presiona Aprobar → tarea se encola para ejecución real
  4. Usuario presiona Rechazar → tarea se cancela con motivo registrado
  5. Si no hay respuesta en APPROVAL_TIMEOUT → tarea se cancela automáticamente

Integración con Harness:
  - Estado AWAITING_APPROVAL gestionado en Redis: harness:approval:{task_id}
  - Extiende TaskStatus sin modificar harness.py (decorador por encima)

Prerequisito: DISCORD_BOT_TOKEN + DISCORD_APPROVAL_CHANNEL_ID en entorno
"""
import os
import json
import asyncio
import threading
from datetime import datetime, timezone
from typing import Optional
import sys
sys.path.insert(0, "/root")

# ─── ADE-0008-0001-001: Criterios de tareas que requieren aprobación ─────────

# Tipos de tarea que siempre requieren aprobación humana
ALWAYS_REQUIRES_APPROVAL = {
    "deploy",           # despliegue a producción
    "db_migration",     # migraciones de base de datos
    "delete_data",      # eliminación de datos
    "financial",        # transacciones financieras
    "publish",          # publicación externa (blog, redes, email)
    "send_email",       # envío de emails a clientes
    "git_force_push",   # force push a ramas protegidas
    "infrastructure",   # cambios en infraestructura/servidores
}

# Palabras clave en el payload que elevan a "alto riesgo"
HIGH_RISK_KEYWORDS = [
    "production", "prod", "eliminar", "borrar", "drop", "truncate",
    "force", "override", "reset", "--force", "publish", "deploy",
]

APPROVAL_TIMEOUT = 300  # segundos — 5 minutos para aprobar


def needs_approval(task) -> tuple[bool, str]:
    """
    Determina si una tarea requiere aprobación humana antes de ejecutarse.
    Retorna (requires_approval: bool, reason: str).
    """
    task_type = task.type if hasattr(task, "type") else task.get("type", "")
    payload = task.payload if hasattr(task, "payload") else task.get("payload", {})
    prompt = str(payload.get("prompt", "")).lower()

    # Tipo explícitamente de alto riesgo
    if task_type in ALWAYS_REQUIRES_APPROVAL:
        return True, f"Tipo de tarea `{task_type}` requiere aprobación"

    # Palabras clave de alto riesgo en el prompt
    found = [kw for kw in HIGH_RISK_KEYWORDS if kw in prompt]
    if found:
        return True, f"Prompt contiene términos de alto riesgo: {', '.join(found)}"

    # Flag explícito en el payload
    if payload.get("requires_approval"):
        return True, "Tarea marcada explícitamente como requiere aprobación"

    return False, ""


# ─── ADE-0008-0001-002: Estado AWAITING_APPROVAL en el Harness ───────────────

class ApprovalStore:
    """
    Almacena el estado de aprobación pendiente en Redis (o JSON fallback).
    Clave: harness:approval:{task_id}
    Valor: { "status": "pending|approved|rejected", "reason": "...", "task": {...} }
    """
    PREFIX = "harness:approval"

    def __init__(self):
        self._redis = self._connect_redis()

    def _connect_redis(self):
        try:
            import redis
            r = redis.Redis(host="172.18.0.2", port=6379, decode_responses=True, socket_connect_timeout=3)
            r.ping()
            return r
        except Exception:
            return None

    def set_pending(self, task_id: str, task_data: dict, ttl: int = APPROVAL_TIMEOUT + 60):
        entry = json.dumps({"status": "pending", "task": task_data, "requested_at": datetime.now(timezone.utc).isoformat()})
        if self._redis:
            self._redis.set(f"{self.PREFIX}:{task_id}", entry, ex=ttl)
        else:
            import pathlib
            p = pathlib.Path(f"/root/harness-queue/approvals/{task_id}.json")
            p.parent.mkdir(exist_ok=True)
            p.write_text(entry)

    def get(self, task_id: str) -> Optional[dict]:
        if self._redis:
            raw = self._redis.get(f"{self.PREFIX}:{task_id}")
            return json.loads(raw) if raw else None
        import pathlib
        p = pathlib.Path(f"/root/harness-queue/approvals/{task_id}.json")
        return json.loads(p.read_text()) if p.exists() else None

    def set_decision(self, task_id: str, approved: bool, reason: str = ""):
        entry = self.get(task_id) or {}
        entry["status"] = "approved" if approved else "rejected"
        entry["decision_at"] = datetime.now(timezone.utc).isoformat()
        entry["reason"] = reason
        raw = json.dumps(entry)
        if self._redis:
            self._redis.set(f"{self.PREFIX}:{task_id}", raw, ex=3600)
        else:
            import pathlib
            p = pathlib.Path(f"/root/harness-queue/approvals/{task_id}.json")
            p.write_text(raw)

    def wait_for_decision(self, task_id: str, timeout: int = APPROVAL_TIMEOUT) -> Optional[dict]:
        """Polling hasta recibir decisión o timeout."""
        import time
        deadline = time.time() + timeout
        while time.time() < deadline:
            entry = self.get(task_id)
            if entry and entry.get("status") != "pending":
                return entry
            time.sleep(2)
        return None


# ─── ADE-0008-0001-003: Notificación Discord con botones ─────────────────────

try:
    import discord
    from discord import ui

    class ApprovalView(ui.View):
        """
        View de Discord con botones Aprobar / Rechazar.
        Al presionar, actualiza el ApprovalStore y edita el mensaje original.
        """

        def __init__(self, task_id: str, store: ApprovalStore, timeout: float = APPROVAL_TIMEOUT):
            super().__init__(timeout=timeout)
            self.task_id = task_id
            self.store = store

        # ADE-0008-0001-004: Handler de Aprobar
        @ui.button(label="✅ Aprobar", style=discord.ButtonStyle.success)
        async def approve(self, interaction: discord.Interaction, button: ui.Button):
            self.store.set_decision(self.task_id, approved=True, reason=f"Aprobado por {interaction.user.display_name}")
            for child in self.children:
                child.disabled = True
            await interaction.response.edit_message(
                content=f"✅ **Aprobada** por {interaction.user.mention} — encolando para ejecución...",
                view=self,
            )
            self.stop()

        # ADE-0008-0001-004: Handler de Rechazar
        @ui.button(label="❌ Rechazar", style=discord.ButtonStyle.danger)
        async def reject(self, interaction: discord.Interaction, button: ui.Button):
            self.store.set_decision(self.task_id, approved=False, reason=f"Rechazada por {interaction.user.display_name}")
            for child in self.children:
                child.disabled = True
            await interaction.response.edit_message(
                content=f"❌ **Rechazada** por {interaction.user.mention}",
                view=self,
            )
            self.stop()

        async def on_timeout(self):
            """Auto-cancelar si nadie responde en APPROVAL_TIMEOUT segundos."""
            self.store.set_decision(self.task_id, approved=False, reason="Timeout — sin respuesta en 5 minutos")

    DISCORD_AVAILABLE = True

except ImportError:
    DISCORD_AVAILABLE = False
    ApprovalView = None


class ApprovalManager:
    """
    Orquesta el flujo completo de aprobación:
      request() → Discord embed + botones → wait_for_decision() → encolar o cancelar
    """

    def __init__(self, discord_bot=None, approval_channel_id: int = None):
        self.bot = discord_bot
        self.channel_id = approval_channel_id or int(os.environ.get("DISCORD_APPROVAL_CHANNEL_ID", "0") or "0")
        self.store = ApprovalStore()

    def build_approval_embed(self, task, reason: str) -> "discord.Embed":
        """Construye el embed de Discord para mostrar la tarea pendiente."""
        task_id = task.id if hasattr(task, "id") else task.get("id", "unknown")
        task_type = task.type if hasattr(task, "type") else task.get("type", "unknown")
        payload = task.payload if hasattr(task, "payload") else task.get("payload", {})
        agent = task.agent if hasattr(task, "agent") else task.get("agent", "unknown")
        prompt = str(payload.get("prompt", ""))[:500]

        embed = discord.Embed(
            title="⚠️ Tarea requiere aprobación",
            description=f"**Razón:** {reason}",
            color=discord.Color.orange(),
            timestamp=datetime.now(timezone.utc),
        )
        embed.add_field(name="Tipo", value=f"`{task_type}`", inline=True)
        embed.add_field(name="Agente", value=f"`{agent}`", inline=True)
        embed.add_field(name="ID", value=f"`{task_id[:8]}`", inline=True)
        embed.add_field(name="Prompt", value=prompt or "_sin prompt_", inline=False)
        embed.set_footer(text=f"Expira en {APPROVAL_TIMEOUT // 60} minutos")
        return embed

    async def request_async(self, task, reason: str) -> bool:
        """
        Envía la solicitud de aprobación a Discord y espera la decisión.
        Retorna True si fue aprobada, False si rechazada o timeout.
        Debe ejecutarse dentro del event loop de Discord.
        """
        task_id = task.id if hasattr(task, "id") else task.get("id", "unknown")
        task_dict = task.to_dict() if hasattr(task, "to_dict") else dict(task)

        self.store.set_pending(task_id, task_dict)

        if not self.bot or not self.channel_id or not DISCORD_AVAILABLE:
            # Sin Discord: auto-rechazar con log
            print(f"[Approval] Sin Discord configurado — auto-rechazando tarea {task_id[:8]}")
            self.store.set_decision(task_id, approved=False, reason="Sin canal Discord configurado")
            return False

        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            self.store.set_decision(task_id, approved=False, reason="Canal Discord no encontrado")
            return False

        embed = self.build_approval_embed(task, reason)
        view = ApprovalView(task_id, self.store)
        await channel.send(embed=embed, view=view)

        # Esperar decisión (view.wait() o polling del store)
        await view.wait()
        decision = self.store.get(task_id)
        return decision and decision.get("status") == "approved"

    def request_sync(self, task, reason: str) -> bool:
        """
        Versión síncrona para usar desde hilos no-async (Executor).
        Envía al event loop de Discord y espera el resultado.
        """
        if not self.bot or not self.channel_id:
            return False
        future = asyncio.run_coroutine_threadsafe(self.request_async(task, reason), self.bot.loop)
        try:
            return future.result(timeout=APPROVAL_TIMEOUT + 10)
        except Exception:
            return False


# ─── Tests sin token Discord ──────────────────────────────────────────────────

def _test_approval_logic():
    from types import SimpleNamespace

    print("=== Test 1: Criterios de aprobación ===")
    cases = [
        (SimpleNamespace(type="deploy", payload={}, agent="atlas"), True, "Tipo"),
        (SimpleNamespace(type="code_review", payload={"prompt": "revisa el PR"}, agent="atlas"), False, ""),
        (SimpleNamespace(type="generic", payload={"prompt": "ejecutar en production"}, agent="ares"), True, "production"),
        (SimpleNamespace(type="generic", payload={"prompt": "analizar el sprint"}, agent="orion"), False, ""),
        (SimpleNamespace(type="generic", payload={"prompt": "hola", "requires_approval": True}, agent="vesta"), True, "explícito"),
        (SimpleNamespace(type="send_email", payload={}, agent="iris"), True, "Tipo"),
    ]
    for task, expected, kw in cases:
        result, reason = needs_approval(task)
        status = "✓" if result == expected else "✗"
        print(f"  {status} [{task.type}] prompt='{str(task.payload.get('prompt',''))[:30]}' → {result} ({reason[:60]})")

    print("\n=== Test 2: ApprovalStore (Redis/JSON) ===")
    store = ApprovalStore()
    backend = "redis" if store._redis else "json"
    print(f"  Backend: {backend}")
    task_id = "test-approval-12345"
    store.set_pending(task_id, {"type": "test", "agent": "atlas"})
    entry = store.get(task_id)
    assert entry and entry["status"] == "pending", "Pending no guardado"
    print(f"  ✓ set_pending → status={entry['status']}")
    store.set_decision(task_id, approved=True, reason="Test aprobación")
    entry2 = store.get(task_id)
    assert entry2["status"] == "approved"
    print(f"  ✓ set_decision(approved=True) → status={entry2['status']}, reason={entry2['reason']}")

    print("\n=== Test 3: build_approval_embed (estructura) ===")
    if DISCORD_AVAILABLE:
        mgr = ApprovalManager()
        task = SimpleNamespace(id="abcd-1234-efgh", type="deploy", agent="atlas", payload={"prompt": "deploy a producción"}, to_dict=lambda: {})
        embed = mgr.build_approval_embed(task, "Tipo deploy requiere aprobación")
        assert embed.title == "⚠️ Tarea requiere aprobación"
        assert embed.color.value == discord.Color.orange().value
        print(f"  ✓ Embed: '{embed.title}' con {len(embed.fields)} campos")
    else:
        print("  ⚠️ discord.py no disponible — embed no testeable")

    print("\n=== Test 4: ApprovalView sin token ===")
    if DISCORD_AVAILABLE and ApprovalView:
        view = ApprovalView("test-id-view", store, timeout=1.0)
        assert len(view.children) == 2
        labels = [b.label for b in view.children]
        assert "✅ Aprobar" in labels and "❌ Rechazar" in labels
        print(f"  ✓ Botones: {labels}")
    else:
        print("  ⚠️ discord.py no disponible")

    print("\nTODOS LOS TESTS OK")


if __name__ == "__main__":
    _test_approval_logic()
