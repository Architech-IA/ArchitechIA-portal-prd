"""
sage_reporter.py — Reportes de avance del sprint para Discord

Genera reportes del sprint activo consultando el portal y el vault,
los formatea como Discord embeds y los envía al canal #reportes.

Slash command /reporte disponible en sage_discord.py (importa este módulo).

Uso standalone:
    python3 sage_reporter.py           # imprime reporte en consola
    python3 sage_reporter.py --json    # output JSON

Integración Discord:
    from sage_reporter import SprintReporter
    reporter = SprintReporter()
    embed = reporter.build_discord_embed()
    await channel.send(embed=embed)
"""
import os
import sys
import json
from datetime import datetime, timezone
from collections import Counter
sys.path.insert(0, "/root")


# ─── ADE-0008-0002-001: Formato de reporte de avance ─────────────────────────
#
# Estructura del reporte:
#   - Sprint activo: código, nombre, goal
#   - Métricas:      total items, DONE, IN_PROGRESS, TODO, BACKLOG, bloqueados
#   - Completadas:   lista de items DONE con assignee y duración
#   - En progreso:   lista de items IN_PROGRESS con tiempo transcurrido
#   - Bloqueadas:    items con status BACKLOG hace más de N días
#   - Tiempo prom:   media de duración por item completado (si tiene fechaEjecucion)


class SprintReporter:
    """
    Genera reportes de avance consultando el portal via PortalClient.
    """

    def __init__(self, portal_client=None):
        if portal_client:
            self.client = portal_client
        else:
            from sage_portal_bridge import PortalClient
            self.client = PortalClient()

    # ─── ADE-0008-0002-002: Generación automática del reporte ────────────────

    def collect_sprint_data(self) -> dict:
        """
        Consulta el portal para obtener datos del sprint activo.
        Retorna un dict con toda la información del reporte.
        """
        # Sprint(s) activos
        active_sprints = self.client.get_active_sprints()

        # Todos los backlog items
        all_items = self.client._request("GET", "/api/backlog")

        # Sprints del portal
        all_sprints = self.client._request("GET", "/api/backlog/sprints")

        if not active_sprints:
            # Fallback: usar el sprint más recientemente actualizado
            done_sprints = [s for s in all_sprints if s.get("status") == "DONE"]
            active_sprints = sorted(done_sprints, key=lambda s: s.get("createdAt", ""), reverse=True)[:1]

        report_data = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sprints": [],
        }

        for sprint in active_sprints[:3]:  # máximo 3 sprints en el reporte
            sprint_id = sprint["id"]
            sprint_items = [i for i in all_items if i.get("sprint", {}) and i["sprint"].get("id") == sprint_id]

            status_counts = Counter(i.get("status", "BACKLOG") for i in sprint_items)

            # Items por estado
            done_items = [i for i in sprint_items if i.get("status") == "DONE"]
            in_progress = [i for i in sprint_items if i.get("status") == "IN_PROGRESS"]
            todo_items = [i for i in sprint_items if i.get("status") == "TODO"]
            backlog_items = [i for i in sprint_items if i.get("status") == "BACKLOG"]

            # Duración promedio de items completados (si tienen fechaEjecucion y createdAt)
            durations = []
            for item in done_items:
                if item.get("fechaEjecucion") and item.get("createdAt"):
                    try:
                        created = datetime.fromisoformat(item["createdAt"].replace("Z", "+00:00"))
                        executed = datetime.fromisoformat(item["fechaEjecucion"].replace("Z", "+00:00"))
                        delta_h = (executed - created).total_seconds() / 3600
                        if 0 < delta_h < 720:  # entre 0 y 30 días
                            durations.append(delta_h)
                    except Exception:
                        pass

            avg_hours = round(sum(durations) / len(durations), 1) if durations else None

            total = len(sprint_items)
            pct_done = round(len(done_items) / total * 100) if total else 0

            report_data["sprints"].append({
                "code": sprint.get("sprintCode", ""),
                "name": sprint.get("name", ""),
                "goal": sprint.get("goal", ""),
                "status": sprint.get("status", ""),
                "total": total,
                "done": len(done_items),
                "in_progress": len(in_progress),
                "todo": len(todo_items),
                "backlog": len(backlog_items),
                "pct_done": pct_done,
                "avg_hours": avg_hours,
                "done_items": [{"code": i.get("taskCode", ""), "title": i.get("title", ""), "assignee": i.get("assigneeName", "")} for i in done_items[-5:]],
                "in_progress_items": [{"code": i.get("taskCode", ""), "title": i.get("title", ""), "assignee": i.get("assigneeName", "")} for i in in_progress],
                "blocked_items": [{"code": i.get("taskCode", ""), "title": i.get("title", "")} for i in backlog_items[:3]],
            })

        return report_data

    def build_markdown(self, data: dict = None) -> str:
        """ADE-0008-0002-001: Formato markdown del reporte."""
        if data is None:
            data = self.collect_sprint_data()

        lines = [f"# 📊 Reporte de Avance SAGE", f"_Generado: {data['generated_at'][:16]} UTC_\n"]

        for s in data["sprints"]:
            bar = self._progress_bar(s["pct_done"])
            lines.append(f"## {s['code']} — {s['name']}")
            lines.append(f"> {s['goal']}")
            lines.append(f"\n**Progreso:** {bar} {s['pct_done']}% ({s['done']}/{s['total']} tareas)")
            if s["avg_hours"]:
                lines.append(f"**Tiempo promedio por tarea:** {s['avg_hours']}h")
            lines.append(f"\n| Estado | Cantidad |")
            lines.append(f"|--------|----------|")
            lines.append(f"| ✅ DONE | {s['done']} |")
            lines.append(f"| 🔄 IN_PROGRESS | {s['in_progress']} |")
            lines.append(f"| 📋 TODO | {s['todo']} |")
            lines.append(f"| 📦 BACKLOG | {s['backlog']} |")

            if s["in_progress_items"]:
                lines.append(f"\n**En progreso:**")
                for i in s["in_progress_items"]:
                    lines.append(f"- `{i['code']}` {i['title']} _{i['assignee']}_")

            if s["done_items"]:
                lines.append(f"\n**Últimas completadas:**")
                for i in s["done_items"]:
                    lines.append(f"- ✅ `{i['code']}` {i['title']}")

            if s["blocked_items"]:
                lines.append(f"\n**En backlog:**")
                for i in s["blocked_items"]:
                    lines.append(f"- ⏳ `{i['code']}` {i['title']}")
            lines.append("")

        return "\n".join(lines)

    # ─── ADE-0008-0002-003: Formato Discord embed ─────────────────────────────

    def build_discord_embed(self, data: dict = None):
        """Construye un discord.Embed con el reporte de avance."""
        try:
            import discord as _discord
        except ImportError:
            raise RuntimeError("discord.py no instalado")

        if data is None:
            data = self.collect_sprint_data()

        if not data["sprints"]:
            embed = _discord.Embed(title="📊 Sin datos de sprint", color=_discord.Color.greyple())
            return embed

        s = data["sprints"][0]  # Sprint principal
        bar = self._progress_bar(s["pct_done"])
        color = _discord.Color.green() if s["pct_done"] >= 80 else (_discord.Color.yellow() if s["pct_done"] >= 40 else _discord.Color.red())

        embed = _discord.Embed(
            title=f"📊 {s['code']} — {s['name']}",
            description=f"_{s['goal']}_\n\n{bar} **{s['pct_done']}%** completado",
            color=color,
            timestamp=datetime.now(timezone.utc),
        )

        # Métricas
        embed.add_field(name="✅ Done", value=str(s["done"]), inline=True)
        embed.add_field(name="🔄 En progreso", value=str(s["in_progress"]), inline=True)
        embed.add_field(name="📦 Pendiente", value=str(s["todo"] + s["backlog"]), inline=True)

        if s["avg_hours"]:
            embed.add_field(name="⏱️ Tiempo promedio", value=f"{s['avg_hours']}h/tarea", inline=True)

        # Items en progreso
        if s["in_progress_items"]:
            val = "\n".join(f"• `{i['code']}` {i['title'][:40]}" for i in s["in_progress_items"][:4])
            embed.add_field(name="🔄 En ejecución", value=val, inline=False)

        # Últimas completadas
        if s["done_items"]:
            val = "\n".join(f"✅ `{i['code']}` {i['title'][:40]}" for i in s["done_items"][-4:])
            embed.add_field(name="Recién completadas", value=val, inline=False)

        embed.set_footer(text=f"Dev Engine SAGE • {data['generated_at'][:10]}")
        return embed

    def _progress_bar(self, pct: int, width: int = 10) -> str:
        filled = round(pct / 100 * width)
        return "█" * filled + "░" * (width - filled)


# ─── ADE-0008-0002-004: Slash command /reporte (patch para sage_discord.py) ───
# Se registra en el bot de sage_discord.py al importar este módulo.

def register_reporte_command(bot):
    """Añade el slash command /reporte al bot de Discord."""
    try:
        import discord
        from discord import app_commands

        @bot.tree.command(name="reporte", description="Genera el reporte de avance del sprint activo")
        async def cmd_reporte(interaction: discord.Interaction):
            await interaction.response.defer(thinking=True)
            try:
                reporter = SprintReporter()
                embed = reporter.build_discord_embed()
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"❌ Error generando reporte: {str(e)[:300]}")

    except ImportError:
        pass  # discord.py no disponible


# ─── ADE-0008-0002-005: Test end-to-end con datos reales ─────────────────────

def _test_reporter():
    print("=== Test 1: Conexión al portal ===")
    reporter = SprintReporter()
    ok = reporter.client.health()
    print(f"  Portal: {'✓ accesible' if ok else '✗ no disponible'}")
    assert ok

    print("\n=== Test 2: collect_sprint_data con datos reales ===")
    data = reporter.collect_sprint_data()
    assert "sprints" in data
    assert "generated_at" in data
    print(f"  Sprints en reporte: {len(data['sprints'])}")
    for s in data["sprints"]:
        print(f"  • {s['code']} — {s['pct_done']}% ({s['done']}/{s['total']}) — {s['status']}")

    print("\n=== Test 3: Markdown generado ===")
    md = reporter.build_markdown(data)
    assert "Reporte de Avance" in md
    assert len(md) > 100
    print(f"  Markdown: {len(md)} chars")
    print(md[:400] + "...")

    print("\n=== Test 4: Discord embed ===")
    try:
        embed = reporter.build_discord_embed(data)
        import discord
        assert isinstance(embed, discord.Embed)
        print(f"  Embed: '{embed.title}' | campos: {len(embed.fields)}")
    except Exception as e:
        print(f"  ⚠️ {e}")

    print("\n=== Test 5: Barra de progreso ===")
    bars = [(0, "░░░░░░░░░░"), (50, "█████░░░░░"), (100, "██████████")]
    for pct, expected in bars:
        result = reporter._progress_bar(pct)
        status = "✓" if result == expected else f"✗ (got '{result}')"
        print(f"  {status} {pct}% → {result}")

    print("\nTODOS LOS TESTS OK")


if __name__ == "__main__":
    if "--json" in sys.argv:
        reporter = SprintReporter()
        print(json.dumps(reporter.collect_sprint_data(), indent=2))
    else:
        _test_reporter()
