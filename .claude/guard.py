#!/usr/bin/env python3
"""
Guard para Claude Code — bloquea comandos destructivos en producción.
Ubicación: /root/portal-architechia/.claude/guard.py
"""
import sys
import json
import os

BLOCKED = [
    # Prisma destructivos
    ("prisma db push --force-reset",    "BLOQUEADO: --force-reset destruye TODOS los datos de producción. Usá ALTER TABLE directo."),
    ("prisma db push --accept-data-loss","BLOQUEADO: --accept-data-loss puede borrar datos de producción. Usá ALTER TABLE directo."),
    ("prisma migrate reset",             "BLOQUEADO: migrate reset destruye datos de producción."),
    # SQL directo destructivo
    ("drop schema",                      "BLOQUEADO: DROP SCHEMA elimina todas las tablas. Confirmá con el usuario."),
    ("drop table",                       "BLOQUEADO: DROP TABLE elimina datos permanentemente. Confirmá con el usuario."),
    ("truncate ",                        "BLOQUEADO: TRUNCATE elimina todos los registros. Confirmá con el usuario."),
    # Git destructivo
    ("git reset --hard",                 "BLOQUEADO: git reset --hard descarta cambios permanentemente. Confirmá con el usuario."),
    ("git push --force",                 "BLOQUEADO: force push a main puede destruir historial. Confirmá con el usuario."),
    ("git push -f ",                     "BLOQUEADO: force push a main puede destruir historial. Confirmá con el usuario."),
    ("git clean -f",                     "BLOQUEADO: git clean -f elimina archivos sin seguimiento. Confirmá con el usuario."),
    # rm peligroso sobre directorios críticos
    ("rm -rf /root/portal-architechia",  "BLOQUEADO: rm -rf sobre el directorio del portal. Confirmá con el usuario."),
    ("rm -rf /root/backups",             "BLOQUEADO: rm -rf sobre directorio de backups."),
]

def main():
    # Leer input del tool use (JSON desde stdin o env)
    raw = os.environ.get("CLAUDE_TOOL_INPUT", "")
    if not raw:
        try:
            raw = sys.stdin.read()
        except Exception:
            raw = ""

    try:
        data = json.loads(raw)
        command = data.get("command", "").lower()
    except Exception:
        command = raw.lower()

    for pattern, message in BLOCKED:
        if pattern.lower() in command:
            print(f"\n🚨 {message}\n", file=sys.stderr)
            print(f"Comando bloqueado: {command[:200]}", file=sys.stderr)
            sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
