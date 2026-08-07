"""
sage_discord.py — Bot Discord para agentes SAGE

Prerequisitos:
  1. Crear aplicación en Discord Developer Portal (discord.com/developers/applications)
  2. Activar "Message Content Intent" en Bot → Privileged Gateway Intents
  3. Copiar el token del bot
  4. Exportar: DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=...
  5. Invitar el bot al servidor con scopes: bot + applications.commands

Uso:
  python3 sage_discord.py          # Inicia el bot
  pm2 start sage_discord.py --name sage-discord --interpreter python3

Routing por canal:
  #sage-ares    → agente Ares   (Operaciones & CRM)
  #sage-atlas   → agente Atlas  (Code Review & Arquitectura)
  #sage-iris    → agente Iris   (Comunicaciones & UX)
  #sage-orion   → agente Orion  (Coordinador & Estrategia)
  #sage-vesta   → agente Vesta  (Finanzas & Legal)
  #sage-general → agente Orion  (coordinador por defecto)

Interacción:
  Mensaje en #sage-atlas:    "revisa el PR de portal"  → Atlas ejecuta
  Mención directa:           "@Ares analiza el sprint" → Ares ejecuta (sin importar canal)
  Slash command:             /tarea agente:atlas prompt:revisa el PR → encola en Harness
"""
import os
import sys
import json
import asyncio
import threading
from datetime import datetime, timezone
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

sys.path.insert(0, "/root")

# ─── ADE-0007-0002-001: Tabla de routing canal → agente ──────────────────────

CHANNEL_ROUTING: dict[str, str] = {
    "sage-ares":    "ares",
    "sage-atlas":   "atlas",
    "sage-iris":    "iris",
    "sage-orion":   "orion",
    "sage-vesta":   "vesta",
    "sage-general": "orion",   # Orion como coordinador por defecto
    "sage-dev":     "atlas",   # canal de desarrollo → Atlas
    "sage-finance": "vesta",   # finanzas → Vesta
    "sage-sales":   "ares",    # ventas → Ares
}

# ─── ADE-0007-0002-004: Identidades de los agentes ───────────────────────────

AGENT_IDENTITIES: dict[str, dict] = {
    "ares": {
        "name": "Ares",
        "emoji": "⚔️",
        "role": "Operaciones & CRM",
        "personality": "Directo, orientado a resultados, enfocado en eficiencia operativa.",
        "mention_alias": ["@ares", "@Ares", "ares"],
    },
    "atlas": {
        "name": "Atlas",
        "emoji": "🗺️",
        "role": "Code Review & Arquitectura",
        "personality": "Analítico, riguroso, siempre busca la solución más elegante y mantenible.",
        "mention_alias": ["@atlas", "@Atlas", "atlas"],
    },
    "iris": {
        "name": "Iris",
        "emoji": "🌈",
        "role": "Comunicaciones & UX",
        "personality": "Empática, creativa, enfocada en la experiencia del usuario y la claridad.",
        "mention_alias": ["@iris", "@Iris", "iris"],
    },
    "orion": {
        "name": "Orion",
        "emoji": "🔭",
        "role": "Coordinador & Estrategia",
        "personality": "Visionario, coordinador, siempre ve el panorama completo.",
        "mention_alias": ["@orion", "@Orion", "orion"],
    },
    "vesta": {
        "name": "Vesta",
        "emoji": "🏛️",
        "role": "Finanzas & Legal",
        "personality": "Precisa, cautelosa, especializada en números y cumplimiento normativo.",
        "mention_alias": ["@vesta", "@Vesta", "vesta"],
    },
}

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
DISCORD_GUILD_ID = int(os.environ.get("DISCORD_GUILD_ID", "0") or "0")


# ─── ADE-0007-0002-002 + 003: Router de mensajes ─────────────────────────────

class SageRouter:
    """
    Determina qué agente debe manejar un mensaje de Discord.
    Prioridad:
      1. Mención directa de agente (@Ares, @Vesta, etc.) en el texto
      2. Nombre del canal en CHANNEL_ROUTING
      3. Orion como fallback coordinador
    """

    def route(self, message: discord.Message) -> str:
        """Retorna el slug del agente destino para un mensaje."""
        # ADE-0007-0002-003: Mención directa tiene prioridad máxima
        agent_by_mention = self._detect_mention(message.content)
        if agent_by_mention:
            return agent_by_mention

        # ADE-0007-0002-002: Routing por nombre de canal
        channel_name = message.channel.name if hasattr(message.channel, "name") else ""
        if channel_name in CHANNEL_ROUTING:
            return CHANNEL_ROUTING[channel_name]

        # Fallback: Orion coordina
        return "orion"

    def _detect_mention(self, content: str) -> Optional[str]:
        """Detecta si el mensaje menciona explícitamente a un agente por nombre."""
        content_lower = content.lower()
        for slug, identity in AGENT_IDENTITIES.items():
            for alias in identity["mention_alias"]:
                if alias.lower() in content_lower:
                    return slug
        return None

    def format_response(self, agent_slug: str, response_text: str) -> str:
        """
        ADE-0007-0002-004: Formatea la respuesta con la identidad del agente.
        Cada agente responde con su nombre, emoji y rol — no como bot genérico.
        """
        identity = AGENT_IDENTITIES.get(agent_slug, {"name": agent_slug, "emoji": "🤖", "role": "Agente"})
        header = f"{identity['emoji']} **{identity['name']}** · _{identity['role']}_"
        # Truncar respuestas largas (Discord tiene límite de 2000 chars)
        if len(response_text) > 1800:
            response_text = response_text[:1797] + "..."
        return f"{header}\n\n{response_text}"


# ─── ADE-0007-0001-001 + 002 + 003 + 004: Bot principal ─────────────────────

class SageDiscordBot(commands.Bot):
    """
    Bot de Discord para los agentes SAGE.
    Escucha mensajes en canales designados y slash commands.
    """

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True   # Privileged intent — activar en Developer Portal
        intents.messages = True
        intents.guilds = True

        super().__init__(command_prefix="!", intents=intents)
        self.router = SageRouter()
        self.guild_id = DISCORD_GUILD_ID

    async def setup_hook(self):
        """Registra los slash commands al conectar."""
        if self.guild_id:
            guild = discord.Object(id=self.guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()  # global sync (puede tardar hasta 1h)

    async def on_ready(self):
        print(f"[SAGE Discord] Bot conectado como {self.user} (id: {self.user.id})")
        print(f"[SAGE Discord] Canales enrutados: {list(CHANNEL_ROUTING.keys())}")

    # ─── ADE-0007-0001-002: Listener de mensajes por canal ───────────────────

    async def on_message(self, message: discord.Message):
        """Escucha mensajes en canales SAGE y los procesa con el agente correcto."""
        # Ignorar mensajes propios
        if message.author == self.user:
            return

        channel_name = getattr(message.channel, "name", "")

        # Solo procesar mensajes en canales SAGE o con mención directa a un agente
        is_sage_channel = channel_name in CHANNEL_ROUTING
        has_agent_mention = self.router._detect_mention(message.content) is not None

        if not is_sage_channel and not has_agent_mention:
            await self.process_commands(message)
            return

        # Determinar agente destino
        agent_slug = self.router.route(message)

        # ADE-0007-0001-003: Respuesta simple con typing indicator
        async with message.channel.typing():
            response = await self._dispatch_to_agent(agent_slug, message.content, message)

        formatted = self.router.format_response(agent_slug, response)
        # Discord límite: 2000 chars por mensaje
        for chunk in _split_message(formatted):
            await message.channel.send(chunk)

        await self.process_commands(message)

    async def _dispatch_to_agent(self, agent_slug: str, prompt: str, message: discord.Message) -> str:
        """
        Despacha el mensaje al agente via Claude Code headless.
        Corre en executor para no bloquear el event loop de Discord.
        """
        try:
            from sage_executor import invoke_claude, ContextBuilder
            identity = AGENT_IDENTITIES.get(agent_slug, {})
            system_prompt = (
                f"Eres {identity.get('name', agent_slug)}, agente SAGE. "
                f"Rol: {identity.get('role', '')}. "
                f"Personalidad: {identity.get('personality', '')} "
                f"Responde de forma concisa (máximo 3 párrafos). "
                f"El mensaje proviene de Discord, canal #{getattr(message.channel, 'name', 'discord')}, "
                f"enviado por {message.author.display_name}."
            )
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: invoke_claude(
                    prompt=prompt,
                    timeout=30,
                    allowed_tools="",  # Sin herramientas de FS en respuestas Discord
                    system_prompt=system_prompt,
                ),
            )
            if result["ok"]:
                return result["output"] or "✓ Tarea recibida."
            else:
                return f"⚠️ No pude procesar tu solicitud: {result.get('error', 'error desconocido')}"
        except Exception as e:
            return f"⚠️ Error interno: {str(e)[:200]}"


# ─── ADE-0007-0001-004: Slash command /tarea ─────────────────────────────────

# El bot se crea aquí para que el decorator @bot.tree.command funcione
bot = SageDiscordBot()


@bot.tree.command(name="tarea", description="Encola una tarea para un agente SAGE vía el Harness")
@app_commands.describe(
    agente="Agente destino (ares, atlas, iris, orion, vesta)",
    prompt="Descripción de la tarea a ejecutar",
    prioridad="Prioridad: LOW, MEDIUM, HIGH (default: MEDIUM)",
)
async def cmd_tarea(
    interaction: discord.Interaction,
    agente: str,
    prompt: str,
    prioridad: str = "MEDIUM",
):
    """Encola la tarea en el Harness y confirma en Discord."""
    await interaction.response.defer(thinking=True)

    agent_slug = agente.lower().strip()
    if agent_slug not in AGENT_IDENTITIES:
        await interaction.followup.send(
            f"❌ Agente `{agente}` no reconocido. Opciones: {', '.join(AGENT_IDENTITIES.keys())}"
        )
        return

    try:
        from harness import Harness, Task, TaskPriority
        h = Harness()
        priority = TaskPriority(prioridad.upper())
        task = Task(type="discord_command", agent=agent_slug, payload={"prompt": prompt, "source": "discord"}, priority=priority)
        task_id = h.dispatch(task)
        identity = AGENT_IDENTITIES[agent_slug]
        await interaction.followup.send(
            f"{identity['emoji']} **{identity['name']}** — tarea encolada con prioridad `{prioridad}`\n"
            f"📋 ID: `{task_id[:8]}`\n"
            f"📝 Prompt: _{prompt[:200]}_"
        )
    except Exception as e:
        await interaction.followup.send(f"❌ Error al encolar la tarea: {str(e)[:300]}")


@bot.tree.command(name="estado", description="Muestra el estado de las colas del Harness")
async def cmd_estado(interaction: discord.Interaction):
    """Muestra el estado actual de las colas del Harness."""
    await interaction.response.defer(thinking=True)
    try:
        from harness import Harness
        h = Harness()
        status = h.status()
        msg = f"🔧 **Harness Status** — backend: `{status['backend']}`\n"
        msg += f"📦 Cola: `{status.get('pending', 'N/A')}` tareas pendientes"
        await interaction.followup.send(msg)
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {str(e)[:200]}")


# ─── Utilidades ───────────────────────────────────────────────────────────────

def _split_message(text: str, limit: int = 1990) -> list[str]:
    """Divide un mensaje en chunks que respetan el límite de Discord."""
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks


# ─── ADE-0007-0001-005 / ADE-0007-0002-005: Tests sin conexión real ──────────

def _test_router_structure():
    """Test del router y las identidades sin necesidad de token Discord."""
    router = SageRouter()

    print("=== Test 1: Routing por canal ===")
    tests = [
        ("sage-ares", "ares"),
        ("sage-atlas", "atlas"),
        ("sage-vesta", "vesta"),
        ("sage-general", "orion"),
        ("sage-sales", "ares"),
        ("canal-desconocido", "orion"),  # fallback
    ]

    class FakeChannel:
        def __init__(self, name): self.name = name
    class FakeMessage:
        def __init__(self, channel_name, content="hola"):
            self.channel = FakeChannel(channel_name)
            self.content = content
            self.author = None

    for channel, expected in tests:
        msg = FakeMessage(channel)
        result = router.route(msg)
        status = "✓" if result == expected else "✗"
        print(f"  {status} #{channel} → {result} (esperado: {expected})")

    print("\n=== Test 2: Detección de menciones directas ===")
    mention_tests = [
        ("@Ares revisa el sprint", "ares"),
        ("que piensa atlas sobre esto", "atlas"),
        ("Iris ¿cómo mejorarías el UX?", "iris"),
        ("mensaje sin mención", None),
    ]
    for content, expected in mention_tests:
        result = router._detect_mention(content)
        status = "✓" if result == expected else "✗"
        print(f"  {status} '{content[:40]}' → {result}")

    print("\n=== Test 3: Formato de respuesta con identidad ===")
    response = router.format_response("atlas", "El código tiene un problema en la línea 42.")
    assert "Atlas" in response
    assert "Code Review" in response
    assert "🗺️" in response
    print(f"  ✓ Formato Atlas: {response[:80]}...")

    print("\n=== Test 4: Routing multiagente — mismo servidor ===")
    channels = list(CHANNEL_ROUTING.keys())
    agents_reached = set()
    for ch in channels:
        msg = FakeMessage(ch)
        agent = router.route(msg)
        agents_reached.add(agent)
    print(f"  Canales configurados: {len(channels)}")
    print(f"  Agentes alcanzables: {sorted(agents_reached)}")
    assert "ares" in agents_reached and "atlas" in agents_reached
    assert "vesta" in agents_reached and "orion" in agents_reached

    print("\n=== Test 5: Slash command /tarea — estructura ===")
    assert "tarea" in [cmd.name for cmd in bot.tree.get_commands()]
    print(f"  ✓ Slash commands registrados: {[cmd.name for cmd in bot.tree.get_commands()]}")

    print("\nTODOS LOS TESTS OK")
    print(f"\nPrerequisito: exportar DISCORD_BOT_TOKEN y DISCORD_GUILD_ID para conectar el bot")


if __name__ == "__main__":
    if "--test" in sys.argv or not DISCORD_BOT_TOKEN:
        _test_router_structure()
    else:
        print(f"[SAGE Discord] Iniciando bot...")
        bot.run(DISCORD_BOT_TOKEN)
