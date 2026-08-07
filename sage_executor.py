"""
sage_executor.py — Ejecutor headless de Claude Code para agentes SAGE

Prerequisito: ANTHROPIC_API_KEY exportada en el entorno, o claude autenticado via OAuth.
  export ANTHROPIC_API_KEY=sk-ant-...

Flags headless usados:
  claude -p / --print              → modo no-interactivo, retorna output y sale
  --output-format json             → respuesta en JSON estructurado
  --dangerously-skip-permissions   → sin prompts de confirmación (necesario en VPS)
  --allowedTools "..."             → whitelist explícita de herramientas
  --no-session-persistence         → no persiste sesiones entre invocaciones

Ciclo de vida:
  Harness.next_task(agent) → Executor.run(task) → ContextBuilder → invoke_claude() → parse → VaultClient.log()
"""
import json
import subprocess
import time
import shlex
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Any

# ─── Constantes ───────────────────────────────────────────────────────────────

CLAUDE_BIN = "claude"
DEFAULT_TIMEOUT = 120       # segundos por tarea
MAX_RETRIES = 3
BACKOFF_BASE = 2            # backoff exponencial: 2^attempt segundos

# Herramientas permitidas en invocaciones headless (mínimo necesario)
DEFAULT_ALLOWED_TOOLS = "Read,Grep,Glob,Bash"


# ─── ADE-0005-0001-001: Investigación de modo headless ───────────────────────
#
# Flags documentados:
#   -p / --print               → non-interactive, retorna output y sale
#   --output-format text|json|stream-json
#   --input-format text|stream-json
#   --dangerously-skip-permissions → bypass de confirmaciones (VPS headless)
#   --allowedTools "Read Bash..."  → whitelist de herramientas
#   --no-session-persistence       → sin persistencia de sesión
#   --system-prompt "..."          → system prompt adicional
#   --add-dir <path>               → directorios adicionales accesibles
#
# Invocación mínima headless:
#   claude -p --output-format json --dangerously-skip-permissions "prompt"
#
# Autenticación: ANTHROPIC_API_KEY en env, o claude autenticado via /login.
#   En VPS sin sesión interactiva → usar ANTHROPIC_API_KEY.


# ─── ADE-0005-0001-002: Wrapper de invocación headless ───────────────────────

def invoke_claude(
    prompt: str,
    context_files: list[str] = None,
    cwd: str = None,
    timeout: int = DEFAULT_TIMEOUT,
    allowed_tools: str = DEFAULT_ALLOWED_TOOLS,
    output_format: str = "json",
    system_prompt: str = None,
    extra_dirs: list[str] = None,
) -> dict:
    """
    Invoca Claude Code en modo headless y retorna el resultado.

    Returns:
        {
          "ok": bool,
          "output": str,          # texto de la respuesta
          "parsed": dict|None,    # si output_format=json, el objeto parseado
          "exit_code": int,
          "duration_s": float,
          "error": str|None,
        }
    """
    # ADE-0005-0001-003: inyectar archivos de contexto al prompt
    full_prompt = _build_prompt_with_context(prompt, context_files or [])

    cmd = [CLAUDE_BIN, "--print", f"--output-format={output_format}", "--no-session-persistence"]

    if allowed_tools:
        cmd += ["--allowedTools", allowed_tools]
    if system_prompt:
        cmd += ["--system-prompt", system_prompt]
    if extra_dirs:
        for d in extra_dirs:
            cmd += ["--add-dir", d]

    # Prompt via stdin (robusto con --allowedTools y prompts multilinea)
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            input=full_prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd or "/root",
        )
        duration = time.time() - start
        raw = result.stdout.strip()
        stderr = result.stderr.strip()

        if result.returncode != 0:
            return {
                "ok": False,
                "output": raw,
                "parsed": None,
                "exit_code": result.returncode,
                "duration_s": round(duration, 2),
                "error": stderr or f"exit code {result.returncode}",
            }

        # ADE-0005-0001-004: parsear output estructurado
        parsed = _parse_output(raw, output_format)
        return {
            "ok": True,
            "output": parsed.get("result", raw) if isinstance(parsed, dict) else raw,
            "parsed": parsed,
            "exit_code": 0,
            "duration_s": round(duration, 2),
            "error": None,
        }

    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "output": "",
            "parsed": None,
            "exit_code": -1,
            "duration_s": round(time.time() - start, 2),
            "error": f"timeout after {timeout}s",
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "output": "",
            "parsed": None,
            "exit_code": -2,
            "duration_s": 0,
            "error": "claude binary not found — install Claude Code CLI",
        }
    except Exception as e:
        return {
            "ok": False,
            "output": "",
            "parsed": None,
            "exit_code": -3,
            "duration_s": round(time.time() - start, 2),
            "error": str(e),
        }


def _build_prompt_with_context(prompt: str, context_files: list[str]) -> str:
    """ADE-0005-0001-003: Construye el prompt inyectando el contenido de archivos de contexto."""
    if not context_files:
        return prompt
    parts = []
    for fpath in context_files:
        p = Path(fpath)
        if p.exists():
            content = p.read_text(encoding="utf-8", errors="replace")
            parts.append(f"<context file='{fpath}'>\n{content}\n</context>")
    if parts:
        context_block = "\n\n".join(parts)
        return f"{context_block}\n\n---\n\n{prompt}"
    return prompt


def _parse_output(raw: str, fmt: str) -> Any:
    """ADE-0005-0001-004: Parsea la respuesta de Claude Code."""
    if fmt == "json":
        # Claude --output-format json retorna un objeto con "result", "session_id", etc.
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Si no es JSON puro, busca el bloque JSON en el output
            for line in raw.splitlines():
                line = line.strip()
                if line.startswith("{"):
                    try:
                        return json.loads(line)
                    except Exception:
                        continue
            return {"result": raw}  # fallback: texto plano
    return raw  # "text" format → string directo


# ─── ADE-0005-0002: Context Builder ──────────────────────────────────────────

class ContextBuilder:
    """
    Construye un bloque de contexto markdown para inyectar al agente.
    Combina: commits recientes + archivos modificados + notas del vault.
    """

    def __init__(self, repo_path: str = None, vault_path: str = "/root/sage-vault"):
        self.repo_path = repo_path
        self.vault_path = Path(vault_path)

    def recent_commits(self, n: int = 5) -> list[dict]:
        """ADE-0005-0002-001: Retorna los N commits más recientes del repo."""
        if not self.repo_path:
            return []
        try:
            result = subprocess.run(
                ["git", "log", f"-{n}", "--pretty=format:%H|%an|%ai|%s"],
                capture_output=True, text=True, cwd=self.repo_path, timeout=10,
            )
            commits = []
            for line in result.stdout.strip().splitlines():
                parts = line.split("|", 3)
                if len(parts) == 4:
                    commits.append({"hash": parts[0][:8], "author": parts[1], "date": parts[2][:10], "message": parts[3]})
            return commits
        except Exception:
            return []

    def modified_files(self, commit: str = "HEAD", base: str = "HEAD~1") -> list[dict]:
        """ADE-0005-0002-002: Archivos modificados entre dos commits con diff resumido."""
        if not self.repo_path:
            return []
        try:
            # Lista de archivos modificados
            result = subprocess.run(
                ["git", "diff", "--name-status", base, commit],
                capture_output=True, text=True, cwd=self.repo_path, timeout=10,
            )
            files = []
            for line in result.stdout.strip().splitlines():
                parts = line.split("\t", 1)
                if len(parts) == 2:
                    status, path = parts
                    # Diff resumido (+/- lines)
                    stat = subprocess.run(
                        ["git", "diff", "--stat", base, commit, "--", path],
                        capture_output=True, text=True, cwd=self.repo_path, timeout=5,
                    )
                    summary = stat.stdout.strip().splitlines()[-1] if stat.stdout.strip() else ""
                    files.append({"status": status, "path": path, "summary": summary})
            return files
        except Exception:
            return []

    def build_repo_context(self, n_commits: int = 3) -> str:
        """ADE-0005-0002-003: Resumen markdown de contexto del repo listo para inyectar."""
        if not self.repo_path:
            return ""

        lines = [f"## Contexto del repositorio: {self.repo_path}\n"]

        commits = self.recent_commits(n_commits)
        if commits:
            lines.append("### Commits recientes")
            for c in commits:
                lines.append(f"- `{c['hash']}` ({c['date']}) {c['author']}: {c['message']}")
            lines.append("")

        modified = self.modified_files()
        if modified:
            lines.append("### Archivos modificados (HEAD vs HEAD~1)")
            for f in modified:
                lines.append(f"- [{f['status']}] {f['path']} — {f['summary']}")
            lines.append("")

        return "\n".join(lines)

    def build_vault_context(self, agent_id: str, notes: list[str] = None) -> str:
        """Lee notas del vault del agente y las incluye como contexto."""
        lines = [f"## Memoria del agente {agent_id}\n"]
        notes_path = self.vault_path / "agents" / agent_id
        if not notes_path.exists():
            return ""
        # Perfil del agente
        perfil = notes_path / "perfil.md"
        if perfil.exists():
            lines.append("### Perfil")
            lines.append(perfil.read_text(encoding="utf-8")[:500])
            lines.append("")
        # Notas específicas solicitadas
        for note in (notes or []):
            note_file = notes_path / note
            if note_file.exists():
                lines.append(f"### {note}")
                lines.append(note_file.read_text(encoding="utf-8")[:800])
                lines.append("")
        return "\n".join(lines)

    def build(self, agent_id: str = None, repo_path: str = None, vault_notes: list[str] = None) -> str:
        """ADE-0005-0002-004: Context completo = repo + vault, listo para inyectar al prompt."""
        parts = []
        if repo_path:
            self.repo_path = repo_path
        repo_ctx = self.build_repo_context()
        if repo_ctx:
            parts.append(repo_ctx)
        if agent_id:
            vault_ctx = self.build_vault_context(agent_id, vault_notes)
            if vault_ctx:
                parts.append(vault_ctx)
        return "\n---\n".join(parts)


# ─── ADE-0005-0003: Executor base con timeout, reintentos y logs ──────────────

class Executor:
    """
    ADE-0005-0003-001: Executor base.
    Recibe una Task del Harness, construye el contexto, lanza Claude Code headless,
    registra el resultado en el vault, y reporta al Harness.

    Uso típico:
        from harness import Harness, Task
        from sage_executor import Executor

        h = Harness()
        task = h.next_task("atlas")
        if task:
            ex = Executor(agent_id="atlas")
            result = ex.run(task, harness=h)
    """

    def __init__(
        self,
        agent_id: str,
        vault_path: str = "/root/sage-vault",
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = MAX_RETRIES,
    ):
        self.agent_id = agent_id
        self.vault_path = Path(vault_path)
        self.timeout = timeout
        self.max_retries = max_retries
        self.context_builder = ContextBuilder(vault_path=vault_path)

    def run(self, task, harness=None, repo_path: str = None) -> dict:
        """
        ADE-0005-0003-001+002+003: Ejecuta la tarea con timeout y reintentos backoff.
        Registra el log en el vault. Reporta DONE/FAILED al harness si se pasa.
        """
        payload = task.payload if hasattr(task, "payload") else task.get("payload", {})
        prompt = payload.get("prompt", f"Ejecutar tarea: {task.type if hasattr(task, 'type') else task.get('type')}")
        context_files = payload.get("context_files", [])
        task_repo = repo_path or payload.get("repo_path")

        # Construir contexto
        context_md = self.context_builder.build(agent_id=self.agent_id, repo_path=task_repo)

        if context_md:
            full_prompt = f"{context_md}\n\n---\n\n{prompt}"
        else:
            full_prompt = prompt

        attempt = 0
        last_result = None

        while attempt <= self.max_retries:
            if attempt > 0:
                # ADE-0005-0003-003: backoff exponencial
                wait = BACKOFF_BASE ** attempt
                time.sleep(wait)

            result = invoke_claude(
                prompt=full_prompt,
                context_files=context_files,
                cwd=task_repo or "/root",
                timeout=self.timeout,  # ADE-0005-0003-002: timeout por tarea
                allowed_tools=DEFAULT_ALLOWED_TOOLS,
            )
            last_result = result
            last_result["attempt"] = attempt + 1

            if result["ok"]:
                break
            attempt += 1

        # ADE-0005-0003-004: Log en vault
        self._log_execution(task, last_result)

        # Reportar al harness
        if harness:
            if last_result["ok"]:
                harness.complete(task, result=last_result)
            else:
                harness.fail(task, error=last_result.get("error", "unknown"), retry=False)

        return last_result

    def _log_execution(self, task, result: dict):
        """ADE-0005-0003-004: Guarda log de ejecución en el vault del agente."""
        try:
            task_id = task.id if hasattr(task, "id") else task.get("id", "unknown")
            task_type = task.type if hasattr(task, "type") else task.get("type", "generic")
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            log_path = self.vault_path / "agents" / self.agent_id / "logs" / f"{today}.md"
            log_path.parent.mkdir(parents=True, exist_ok=True)

            status = "OK" if result["ok"] else "FAIL"
            duration = result.get("duration_s", 0)
            attempt = result.get("attempt", 1)
            error = result.get("error", "")
            output_preview = str(result.get("output", ""))[:300]

            entry = (
                f"\n## [{status}] {task_type} — {task_id[:8]}\n"
                f"- **Tiempo**: {datetime.now(timezone.utc).strftime('%H:%M:%S')} UTC\n"
                f"- **Duración**: {duration}s | **Intento**: {attempt}/{self.max_retries + 1}\n"
                f"- **Error**: {error or 'ninguno'}\n"
                f"- **Output** (preview):\n```\n{output_preview}\n```\n"
            )

            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)
        except Exception:
            pass  # log failures no deben interrumpir la tarea


# ─── ADE-0005-0001-005 / ADE-0005-0002-005 / ADE-0005-0003-005: Tests ────────

def _test_invoke_claude_structure():
    """Verifica que la función retorna la estructura correcta incluso con error de auth."""
    result = invoke_claude("di hola", timeout=10)
    required_keys = {"ok", "output", "parsed", "exit_code", "duration_s", "error"}
    assert required_keys.issubset(result.keys()), f"Faltan claves: {required_keys - result.keys()}"
    assert isinstance(result["ok"], bool)
    assert isinstance(result["duration_s"], float)
    return result


def _test_context_builder():
    """Verifica que ContextBuilder construye contexto correcto para el repo portal."""
    cb = ContextBuilder(repo_path="/root/portal-architechia")
    commits = cb.recent_commits(3)
    assert isinstance(commits, list)
    files = cb.modified_files()
    assert isinstance(files, list)
    ctx = cb.build(agent_id="atlas", repo_path="/root/portal-architechia")
    assert isinstance(ctx, str)
    return {"commits": len(commits), "modified_files": len(files), "context_chars": len(ctx)}


def _test_executor_structure():
    """Verifica que Executor instancia correctamente y el log funciona."""
    from types import SimpleNamespace
    ex = Executor(agent_id="atlas", timeout=8)
    # Test con tarea sintética (sin llamar a claude para no bloquear)
    fake_result = {"ok": True, "output": "test ok", "parsed": None, "exit_code": 0, "duration_s": 1.2, "error": None}
    fake_task = SimpleNamespace(id="test-1234-abcd", type="test_task", payload={})
    ex._log_execution(fake_task, fake_result)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_path = ex.vault_path / "agents" / "atlas" / "logs" / f"{today}.md"
    assert log_path.exists(), f"Log no creado: {log_path}"
    content = log_path.read_text()
    assert "test_task" in content
    return {"log_path": str(log_path), "log_ok": True}


if __name__ == "__main__":
    print("=== Test 1: invoke_claude estructura ===")
    r1 = _test_invoke_claude_structure()
    print("ok:", r1["ok"], "| error:", r1["error"], "| duration:", r1["duration_s"])

    print("\n=== Test 2: ContextBuilder ===")
    r2 = _test_context_builder()
    print("commits:", r2["commits"], "| archivos:", r2["modified_files"], "| context chars:", r2["context_chars"])

    print("\n=== Test 3: Executor estructura + log ===")
    r3 = _test_executor_structure()
    print("log_path:", r3["log_path"], "| log_ok:", r3["log_ok"])

    print("\nTODOS LOS TESTS OK")
