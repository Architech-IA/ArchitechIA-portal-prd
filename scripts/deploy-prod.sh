#!/bin/bash
# Despliegue del portal en MODO PRODUCCIÓN (next start) sin cortar el servicio mientras compila.
#
# Desde el 2026-10-08 el portal corre con `next start` (antes `next dev`, que usaba 3,2 GB de RAM
# y servía cada página en ~0,5-1,1 s). En producción un cambio de código NO se ve hasta
# recompilar. Compilar sobre `.next` mientras el servidor lo está usando lo rompería, así que:
#   1) se compila en `.next-build` (distDir por variable de entorno, ver next.config.ts) con
#      tope de memoria/CPU y baja prioridad — el portal sigue sirviendo desde `.next`;
#   2) recién cuando la compilación salió bien, se hace el cambio (unos segundos de corte);
#   3) si el portal nuevo no responde, se vuelve automáticamente a la versión anterior.
#
# Uso:  /root/portal-architechia/scripts/deploy-prod.sh        (tarda ~6-10 min, casi todo compilando)
set -uo pipefail
cd /root/portal-architechia
export PM2_HOME=/root/.pm2
PM2=/root/.nvm/versions/node/v20.20.2/lib/node_modules/pm2/bin/pm2
NUEVO=.next-build
LOG=/tmp/portal_deploy.log

echo "[$(date -u +%T)] compilando en $NUEVO ..." | tee "$LOG"
rm -rf "$NUEVO"
systemd-run --scope --quiet -p MemoryMax=3500M -p CPUQuota=170% \
  nice -n 5 env NEXT_DIST_DIR="$NUEVO" NODE_OPTIONS=--max-old-space-size=3072 npx next build >> "$LOG" 2>&1
if [ $? -ne 0 ] || [ ! -f "$NUEVO/BUILD_ID" ]; then
  echo "[$(date -u +%T)] FALLÓ la compilación — el portal NO se tocó. Ver $LOG" | tee -a "$LOG"
  rm -rf "$NUEVO"
  exit 1
fi

echo "[$(date -u +%T)] compilación OK — cambiando de versión ..." | tee -a "$LOG"
$PM2 stop portal-architechia > /dev/null 2>&1
rm -rf .next-old
mv .next .next-old
mv "$NUEVO" .next
$PM2 start portal-architechia > /dev/null 2>&1

ok=0
for i in $(seq 1 30); do
  c=$(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:3003/login)
  if [ "$c" = "200" ]; then ok=1; break; fi
  sleep 2
done

if [ "$ok" = "1" ]; then
  echo "[$(date -u +%T)] portal nuevo respondiendo (/login 200 tras ~$((i*2)) s). Versión anterior en .next-old (se borra en el próximo despliegue)." | tee -a "$LOG"
  $PM2 save > /dev/null 2>&1
  exit 0
fi

echo "[$(date -u +%T)] el portal nuevo NO responde — VOLVIENDO a la versión anterior ..." | tee -a "$LOG"
$PM2 stop portal-architechia > /dev/null 2>&1
rm -rf .next-fallido
mv .next .next-fallido
mv .next-old .next
$PM2 start portal-architechia > /dev/null 2>&1
sleep 8
echo "[$(date -u +%T)] revertido; /login → $(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:3003/login). Versión fallida en .next-fallido" | tee -a "$LOG"
exit 2
