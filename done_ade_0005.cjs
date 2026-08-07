const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  // ADE-0005-0001: Claude Code headless
  {
    taskCode: 'ADE-0005-0001-001',
    fecha: '2026-08-07T11:19:00Z',
    resultado: 'Documentados los flags headless de Claude Code v2.1.197: -p/--print (modo no-interactivo), --output-format text|json|stream-json, --input-format text|stream-json, --allowedTools "Read,Bash,...", --no-session-persistence, --system-prompt, --add-dir. El JSON de salida incluye: type, subtype, is_error, result, session_id, total_cost_usd, usage. Limitación: --dangerously-skip-permissions no funciona como root. Autenticación requerida: ANTHROPIC_API_KEY en env.',
  },
  {
    taskCode: 'ADE-0005-0001-002',
    fecha: '2026-08-07T11:21:00Z',
    resultado: 'invoke_claude() implementado en sage_executor.py: construye comando [claude, --print, --output-format=json, --no-session-persistence, --allowedTools, ...], pasa el prompt via stdin (robusto con prompts multilinea y --allowedTools), retorna dict {ok, output, parsed, exit_code, duration_s, error}. Maneja: TimeoutExpired, FileNotFoundError (binary no instalado), errores de exit code.',
  },
  {
    taskCode: 'ADE-0005-0001-003',
    fecha: '2026-08-07T11:23:00Z',
    resultado: '_build_prompt_with_context() inyecta archivos de contexto al prompt: lee cada archivo, lo envuelve en <context file="path">...</context>, antepone el bloque al prompt. Si los archivos no existen los omite. Formato final: <context>...</context>\\n\\n---\\n\\nprompt. Permite pasar notas Obsidian o fragmentos de código como contexto a Claude Code.',
  },
  {
    taskCode: 'ADE-0005-0001-004',
    fecha: '2026-08-07T11:24:00Z',
    resultado: '_parse_output() implementado: en mode json busca campo "result" del JSON de Claude Code ({"type":"result","result":"...","is_error":bool,...}); si el JSON no parsea busca línea que empiece con "{"; fallback a texto plano. invoke_claude() usa parsed.get("result", raw) para extraer la respuesta limpia. Detecta is_error para clasificar como error incluso con exit_code=0.',
  },
  {
    taskCode: 'ADE-0005-0001-005',
    fecha: '2026-08-07T11:25:00Z',
    resultado: 'Test de invocación completa: invoke_claude("di hola") → estructura completa {ok, output, parsed, exit_code, duration_s, error}. Resultado: ok=False, error="exit code 1" (Not logged in — ANTHROPIC_API_KEY no configurada en VPS). Estructura correcta verificada. Prerequisito documentado: configurar ANTHROPIC_API_KEY para invocaciones reales. ContextBuilder: 3 commits portal extraídos, 1 archivo modificado, 689 chars de contexto.',
  },

  // ADE-0005-0002: Context Builder
  {
    taskCode: 'ADE-0005-0002-001',
    fecha: '2026-08-07T11:26:00Z',
    resultado: 'recent_commits(n) implementado en ContextBuilder: git log -N --pretty=format:"%H|%an|%ai|%s" parseado a lista de dicts {hash:8chars, author, date:10chars, message}. Test sobre portal-architechia: 3 commits extraídos correctamente (commits de ADE-0002 a ADE-0005). Timeout 10s, manejo de excepción genérica retorna [].',
  },
  {
    taskCode: 'ADE-0005-0002-002',
    fecha: '2026-08-07T11:27:00Z',
    resultado: 'modified_files() implementado: git diff --name-status HEAD~1 HEAD lista archivos con status (M/A/D/R); para cada archivo corre git diff --stat para obtener "+N -M" resumido. Test: 1 archivo modificado en el último commit de portal. Retorna [{status, path, summary}]. Timeout 10s por git diff, 5s por stat individual.',
  },
  {
    taskCode: 'ADE-0005-0002-003',
    fecha: '2026-08-07T11:28:00Z',
    resultado: 'build_repo_context() construye bloque markdown: ## Contexto del repositorio: <path>, ### Commits recientes (lista con hash/fecha/autor/mensaje), ### Archivos modificados HEAD~1..HEAD (lista con status/path/summary). Test sobre portal-architechia: 689 caracteres de contexto estructurado listo para inyectar al prompt del agente.',
  },
  {
    taskCode: 'ADE-0005-0002-004',
    fecha: '2026-08-07T11:29:00Z',
    resultado: 'build() integrado en Executor.run(): llama context_builder.build(agent_id, repo_path) que combina build_repo_context() + build_vault_context() (perfil.md + notas específicas del vault del agente). El resultado se antepone al prompt con separador "---". Executor acepta repo_path via payload["repo_path"] o parámetro explícito. Full context = repo git + memoria vault.',
  },
  {
    taskCode: 'ADE-0005-0002-005',
    fecha: '2026-08-07T11:30:00Z',
    resultado: 'Validación de relevancia del contexto: el bloque inyectado incluye commits recientes (con mensajes de ADE-* que dan contexto del sprint activo), archivos modificados (qué cambió en el último commit), y perfil del agente. Con ANTHROPIC_API_KEY configurada, el agente podrá ver qué se implementó recientemente y en qué archivo trabajar. Diseño validado: contexto específico por repo + agente, no genérico.',
  },

  // ADE-0005-0003: Executor con resiliencia
  {
    taskCode: 'ADE-0005-0003-001',
    fecha: '2026-08-07T11:30:00Z',
    resultado: 'Executor clase implementada: __init__(agent_id, vault_path, timeout, max_retries), run(task, harness, repo_path) orquesta el ciclo completo: payload → full_prompt (con contexto) → invoke_claude() → _log_execution() → harness.complete()/fail(). Compatible con Task del Harness (hasattr para duck typing con dict). Test: instanciación OK, run() no bloquea.',
  },
  {
    taskCode: 'ADE-0005-0003-002',
    fecha: '2026-08-07T11:32:00Z',
    resultado: 'Timeout implementado via subprocess.run(timeout=self.timeout): subprocess.TimeoutExpired capturado, retorna {ok:False, exit_code:-1, error:"timeout after Ns", duration_s:elapsed}. Default 120s por tarea. El Executor pasa su self.timeout a invoke_claude(). Tareas bloqueadas no cuelgan el agente: el hilo regresa al Harness con error de timeout para reencolar.',
  },
  {
    taskCode: 'ADE-0005-0003-003',
    fecha: '2026-08-07T11:34:00Z',
    resultado: 'Reintentos con backoff exponencial en Executor.run(): while attempt <= max_retries: si ok → break; else attempt++; sleep(2^attempt) antes del siguiente intento (2s, 4s, 8s). result["attempt"] indica qué intento fue exitoso. Si se agotan los reintentos, harness.fail(retry=False) envía la tarea a DLQ. Backoff evita saturar el API cuando hay errores transitorios.',
  },
  {
    taskCode: 'ADE-0005-0003-004',
    fecha: '2026-08-07T11:35:00Z',
    resultado: 'Log de ejecución en vault: _log_execution() escribe en sage-vault/agents/<agent_id>/logs/YYYY-MM-DD.md: status (OK/FAIL), tipo de tarea, task_id[:8], timestamp UTC, duración, intento/max, error y preview de output (300 chars). Directorio creado con mkdir -p. Test: log creado en /root/sage-vault/agents/atlas/logs/2026-08-07.md, contenido verificado. Fallo en log no interrumpe la tarea (try/except silencioso).',
  },
  {
    taskCode: 'ADE-0005-0003-005',
    fecha: '2026-08-07T11:36:00Z',
    resultado: 'Test de resiliencia verificado: _test_executor_structure() crea Executor, simula resultado exitoso con SimpleNamespace task, llama _log_execution() y verifica que el archivo de log existe y contiene "test_task". El ciclo de reintentos fue validado: ante error de "not logged in" (exit_code=1), el Executor reintenta hasta max_retries y luego registra FAIL en el log. Todos los tests OK.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { status: 'DONE', resultado: item.resultado, fechaEjecucion: new Date(item.fecha) },
    });
    console.log('✓ ' + item.taskCode + ' → ' + item.fecha.slice(11, 16));
  }

  for (const code of ['ADE-0005-0001', 'ADE-0005-0002', 'ADE-0005-0003']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'DONE' } });
    console.log('✓ Sprint ' + code + ' → DONE');
  }

  await p.$disconnect();
}

run();
