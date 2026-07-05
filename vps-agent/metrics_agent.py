#!/usr/bin/env python3
"""
ArchiTechIA VPS Metrics Agent
Expone métricas del sistema en HTTP para el portal de observabilidad.

Instalación:
  pip install psutil
  python3 metrics_agent.py

Como servicio systemd (recomendado):
  ver: vps-agent/metrics_agent.service
"""

import http.server
import json
import os
import shutil
import time
import subprocess
import threading
from datetime import datetime, timezone

try:
    import psutil
except ImportError:
    raise SystemExit("Falta psutil: ejecutá  pip install psutil")

# ── Configuración ────────────────────────────────────────────────────────────
PORT         = int(os.environ.get("METRICS_PORT", "9100"))
TOKEN        = os.environ.get("METRICS_TOKEN", "")   # Obligatorio en producción
HISTORY_FILE = "/tmp/metrics_history.jsonl"
MAX_SNAPSHOTS = 7 * 24 * 12                          # 7 días a 5 min = 2016 entradas

# Servicios a monitorear (ajustá a los que corren en tu VPS)
SERVICES = [
    "nginx",
    "postgresql",
    "architechIA",   # nombre del servicio de tu app Next.js
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def service_status(name: str) -> dict:
    """Devuelve el estado de un servicio systemd."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", name],
            capture_output=True, text=True, timeout=3
        )
        active = result.stdout.strip() == "active"
        return {"name": name, "active": active, "status": result.stdout.strip()}
    except Exception:
        return {"name": name, "active": False, "status": "unknown"}


def io_rates() -> dict:
    """Velocidades de red y disco en un único sleep de 0.5s."""
    n1 = psutil.net_io_counters()
    d1 = psutil.disk_io_counters()
    time.sleep(0.5)
    n2 = psutil.net_io_counters()
    d2 = psutil.disk_io_counters()
    e  = 0.5
    dr = ((d2.read_bytes  - d1.read_bytes)  / e / 1_048_576) if d1 and d2 else 0
    dw = ((d2.write_bytes - d1.write_bytes) / e / 1_048_576) if d1 and d2 else 0
    return {
        "net": {
            "rx_mbps": round((n2.bytes_recv - n1.bytes_recv) / e / 1_048_576, 3),
            "tx_mbps": round((n2.bytes_sent - n1.bytes_sent) / e / 1_048_576, 3),
        },
        "disk_io": {
            "read_mbps":  round(dr, 3),
            "write_mbps": round(dw, 3),
        },
    }


def swap_info() -> dict:
    """Uso de memoria swap."""
    s = psutil.swap_memory()
    return {
        "total_mb": round(s.total / 1_048_576),
        "used_mb":  round(s.used  / 1_048_576),
        "percent":  s.percent,
    }


def proc_stats() -> dict:
    """Total de procesos y zombies."""
    try:
        all_procs = list(psutil.process_iter(["status"]))
        return {
            "total":   len(all_procs),
            "zombies": sum(1 for p in all_procs if p.info.get("status") == psutil.STATUS_ZOMBIE),
        }
    except Exception:
        return {"total": 0, "zombies": 0}


def docker_containers() -> list:
    """Contenedores Docker corriendo (requiere que docker esté instalado)."""
    try:
        fmt = '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","ports":"{{.Ports}}"}'
        out = subprocess.run(
            ["docker", "ps", "--format", fmt],
            capture_output=True, text=True, timeout=5
        )
        if out.returncode != 0:
            return []
        result = []
        for line in out.stdout.strip().split("\n"):
            line = line.strip()
            if line:
                try:
                    result.append(json.loads(line))
                except Exception:
                    pass
        return result
    except Exception:
        return []


def disk_breakdown() -> list:
    """Uso de disco por directorio clave. Evita duplicar particiones."""
    DIRS = ["/", "/var", "/var/log", "/opt", "/home", "/tmp", "/var/lib"]
    seen_totals: set = set()
    result = []
    for d in DIRS:
        try:
            u = shutil.disk_usage(d)
            key = round(u.total / 1_073_741_824, 1)
            if key in seen_totals:
                continue
            seen_totals.add(key)
            result.append({
                "path":     d,
                "total_gb": round(u.total / 1_073_741_824, 1),
                "used_gb":  round(u.used  / 1_073_741_824, 1),
                "free_gb":  round(u.free  / 1_073_741_824, 1),
                "percent":  round(u.used / u.total * 100, 1) if u.total > 0 else 0,
            })
        except Exception:
            pass
    return result


def disk_children(path: str, limit: int = 10) -> list:
    """Subdirectorios de un path ordenados por tamaño (du -b --max-depth=1)."""
    try:
        out = subprocess.run(
            ["du", "-b", "--max-depth=1", path],
            capture_output=True, text=True, timeout=20
        )
        if out.returncode != 0:
            return []
        items = []
        for line in out.stdout.strip().split("\n"):
            parts = line.split("\t", 1)
            if len(parts) != 2:
                continue
            size_bytes, dir_path = int(parts[0]), parts[1].strip()
            if dir_path == path:
                continue
            items.append({
                "name":    dir_path.split("/")[-1] or dir_path,
                "path":    dir_path,
                "used_gb": round(size_bytes / 1_073_741_824, 2),
            })
        items.sort(key=lambda x: x["used_gb"], reverse=True)
        return items[:limit]
    except Exception:
        return []


def net_connections() -> dict:
    """Conexiones de red activas via psutil."""
    try:
        conns = psutil.net_connections()
        return {
            "total":       len(conns),
            "established": sum(1 for c in conns if c.status == "ESTABLISHED"),
            "listening":   sum(1 for c in conns if c.status == "LISTEN"),
        }
    except Exception:
        return {"total": 0, "established": 0, "listening": 0}


def disk_categories() -> list:
    """Tamaño real de directorios clave usando `du -sb`. Muestra qué ocupa espacio."""
    DIRS = [
        ("/usr",      "Sistema OS"),
        ("/var/lib",  "Datos de apps"),
        ("/var/log",  "Logs"),
        ("/opt",      "Aplicaciones"),
        ("/home",     "Usuarios"),
        ("/tmp",      "Temporales"),
        ("/root",     "Root"),
    ]
    result = []
    for path, label in DIRS:
        try:
            out = subprocess.run(
                ["du", "-sb", path],
                capture_output=True, text=True, timeout=15
            )
            if out.returncode == 0 and out.stdout.strip():
                bytes_used = int(out.stdout.split()[0])
                if bytes_used > 0:
                    entry = {
                        "path":     path,
                        "label":    label,
                        "used_gb":  round(bytes_used / 1_073_741_824, 2),
                        "children": [],
                    }
                    # Drill-down para directorios con más de 0.5 GB
                    if bytes_used > 536_870_912:
                        entry["children"] = disk_children(path)
                    result.append(entry)
        except Exception:
            pass
    result.sort(key=lambda x: x["used_gb"], reverse=True)
    return result


def collect() -> dict:
    """Recopila todas las métricas del sistema."""
    boot_time = psutil.boot_time()
    uptime_s  = int(time.time() - boot_time)

    mem  = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # Baseline CPU antes del sleep
    psutil.cpu_percent(percpu=False)
    psutil.cpu_percent(percpu=True)

    # Un solo sleep de 0.5s cubre red, disco y CPU
    rates     = io_rates()
    cpu       = psutil.cpu_percent(percpu=False)
    cpu_cores = psutil.cpu_percent(percpu=True)

    try:
        load_avg = list(os.getloadavg())
    except AttributeError:
        load_avg = [0, 0, 0]

    top_procs = []
    for p in sorted(psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]),
                    key=lambda p: p.info.get("cpu_percent") or 0, reverse=True)[:10]:
        top_procs.append({
            "pid":  p.info["pid"],
            "name": p.info["name"],
            "cpu":  round(p.info.get("cpu_percent") or 0, 1),
            "mem":  round(p.info.get("memory_percent") or 0, 1),
        })

    return {
        "ts":       datetime.now(timezone.utc).isoformat(),
        "uptime_s": uptime_s,
        "cpu": {
            "percent":  round(cpu, 1),
            "load_avg": [round(x, 2) for x in load_avg],
            "count":    psutil.cpu_count(logical=True),
            "per_core": [round(p, 1) for p in cpu_cores],
        },
        "ram": {
            "total_mb": round(mem.total    / 1_048_576),
            "used_mb":  round(mem.used     / 1_048_576),
            "avail_mb": round(mem.available / 1_048_576),
            "percent":  mem.percent,
        },
        "swap":    swap_info(),
        "disk": {
            "total_gb":  round(disk.total / 1_073_741_824, 1),
            "used_gb":   round(disk.used  / 1_073_741_824, 1),
            "free_gb":   round(disk.free  / 1_073_741_824, 1),
            "percent":   disk.percent,
            "breakdown":  disk_breakdown(),
            "categories": disk_categories(),
        },
        "disk_io":     rates["disk_io"],
        "net":         rates["net"],
        "connections": net_connections(),
        "procs":       proc_stats(),
        "docker":      docker_containers(),
        "services":    [service_status(s) for s in SERVICES],
        "top_procs":   top_procs,
    }


# ── Historial de métricas ─────────────────────────────────────────────────────
def save_snapshot() -> None:
    """Guarda un snapshot mínimo de métricas en el historial JSONL."""
    try:
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        swap = psutil.swap_memory()
        n1   = psutil.net_io_counters()
        time.sleep(1)
        n2   = psutil.net_io_counters()
        snap = {
            "ts":   datetime.now(timezone.utc).isoformat(),
            "cpu":  round(psutil.cpu_percent(interval=None), 1),
            "ram":  round(mem.percent, 1),
            "disk": round(disk.percent, 1),
            "rx":   round((n2.bytes_recv - n1.bytes_recv) / 1_048_576, 3),
            "tx":   round((n2.bytes_sent - n1.bytes_sent) / 1_048_576, 3),
            "swap": round(swap.percent, 1),
        }
        lines: list[str] = []
        try:
            with open(HISTORY_FILE, "r") as f:
                lines = f.readlines()
        except FileNotFoundError:
            pass
        lines.append(json.dumps(snap) + "\n")
        if len(lines) > MAX_SNAPSHOTS:
            lines = lines[-MAX_SNAPSHOTS:]
        with open(HISTORY_FILE, "w") as f:
            f.writelines(lines)
    except Exception as e:
        print(f"[history] Error saving snapshot: {e}", flush=True)


def _history_loop() -> None:
    """Hilo daemon: guarda un snapshot cada 5 minutos."""
    # Primera captura al arrancar
    time.sleep(10)
    save_snapshot()
    while True:
        time.sleep(300)
        save_snapshot()


def read_history() -> list:
    """Lee el historial JSONL y devuelve lista de snapshots."""
    try:
        with open(HISTORY_FILE, "r") as f:
            lines = f.readlines()
        result = []
        for line in lines:
            line = line.strip()
            if line:
                try:
                    result.append(json.loads(line))
                except Exception:
                    pass
        return result
    except FileNotFoundError:
        return []


# ── HTTP handler ───────────────────────────────────────────────────────────────
class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silenciar logs por defecto

    def _auth_ok(self) -> bool:
        if not TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {TOKEN}"

    def do_GET(self):
        if self.path not in ("/metrics", "/metrics/", "/logs", "/logs/", "/history", "/history/"):
            self.send_error(404)
            return

        if not self._auth_ok():
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"unauthorized"}')
            return

        if self.path in ("/history", "/history/"):
            try:
                body = json.dumps({"snapshots": read_history()}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_error(500, str(e))
            return

        if self.path in ("/logs", "/logs/"):
            try:
                log_path = "/tmp/agent.log"
                try:
                    with open(log_path, "r", errors="replace") as f:
                        all_lines = f.readlines()
                    lines = [l.rstrip() for l in all_lines[-100:]]
                except FileNotFoundError:
                    lines = ["(archivo de log no encontrado — iniciá el agente con nohup ... > /tmp/agent.log 2>&1)"]
                body = json.dumps({"lines": lines}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_error(500, str(e))
            return

        try:
            t0   = time.time()
            data = collect()
            ms   = round((time.time() - t0) * 1000)
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            print(f"{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} GET /metrics 200 {ms}ms cpu={data['cpu']['percent']}% ram={data['ram']['percent']}%", flush=True)
        except Exception as e:
            self.send_error(500, str(e))


if __name__ == "__main__":
    if not TOKEN:
        print("⚠  METRICS_TOKEN no configurado — el endpoint es público")
    print(f"✓  Metrics agent corriendo en http://0.0.0.0:{PORT}/metrics")
    print(f"✓  Historial en /history (snapshots cada 5 min → {HISTORY_FILE})")
    threading.Thread(target=_history_loop, daemon=True, name="history").start()
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), MetricsHandler)
    srv.serve_forever()
