// node --experimental-strip-types destinoOficina.test.mjs
import { destinoEnOficina as d } from '../src/lib/destinoOficina.ts'
let ok = 0, mal = 0
const igual = (entrada, esperado) => {
  const real = d(entrada)
  if (real === esperado) { ok++ } else { mal++; console.log('✗', entrada, '\n   esperado:', esperado, '\n   real    :', real) }
}
// backlog
igual('/backlog', '/oficina?view=backlog')
igual('/backlog/sprint', '/oficina?view=backlog&tab=sprint')
igual('/backlog/epics', '/oficina?view=backlog&tab=epics')
igual('/backlog/solution', '/oficina?view=backlog&tab=solution')
igual('/backlog/control', '/oficina?view=backlog&tab=control')
igual('/backlog/control/multi?ids=a,b', '/oficina?view=backlog&tab=control&multi=1&ids=a%2Cb')
igual('/backlog/control/3f1a-9c', '/oficina?view=backlog&tab=control&sprint=3f1a-9c')
// solutions
igual('/solutions', '/oficina?view=solutions')
igual('/solutions/productos', '/oficina?view=solutions&tab=productos')
igual('/solutions/projects', '/oficina?view=solutions&tab=projects')
igual('/solutions/pilots', '/oficina?view=solutions&tab=pilots')
igual('/solutions/partnership', '/oficina?view=solutions&tab=partnership')
igual('/solutions/intern', '/oficina?view=solutions&tab=intern')
igual('/solutions/iniciativas', '/oficina?view=solutions&tab=iniciativas')
igual('/solutions/pilots/cmk123abc', '/oficina?view=solutions&tab=pilots&id=cmk123abc')
// lo que NO se debe tocar
igual('/solutions/otra-cosa', '/solutions/otra-cosa')
igual('/solutions/pilots/abc/mas', '/solutions/pilots/abc/mas')
igual('/leads/lista', '/leads/lista')
igual('/leads/abc/hub', '/leads/abc/hub')
igual('/apps', '/apps')
igual('/oficina?view=proyectos&p=1', '/oficina?view=proyectos&p=1')
igual('/backlog/otra-cosa/mas', '/backlog/otra-cosa/mas')
// el multi lee ids de la URL de la Oficina: ids con comas debe volver a leerse igual
const url = new URL('http://x' + d('/backlog/control/multi?ids=a,b,c'))
if (url.searchParams.get('ids') === 'a,b,c' && url.searchParams.get('multi') === '1') ok++; else { mal++; console.log('✗ ids no se leen igual') }
console.log(`${ok} ok · ${mal} fallas`)
process.exit(mal ? 1 : 0)
