// node --experimental-strip-types destinoOficina.test.mjs
import { destinoEnOficina as d } from '../src/lib/destinoOficina.ts'
let ok = 0, mal = 0
const igual = (entrada, esperado) => {
  const real = d(entrada)
  if (real === esperado) { ok++ } else { mal++; console.log('✗', entrada, '\n   esperado:', esperado, '\n   real    :', real) }
}
igual('/backlog', '/oficina?view=backlog')
igual('/backlog/sprint', '/oficina?view=backlog&tab=sprint')
igual('/backlog/epics', '/oficina?view=backlog&tab=epics')
igual('/backlog/solution', '/oficina?view=backlog&tab=solution')
igual('/backlog/control', '/oficina?view=backlog&tab=control')
igual('/backlog/control/multi?ids=a,b', '/oficina?view=backlog&tab=control&multi=1&ids=a%2Cb')
igual('/backlog/control/3f1a-9c', '/oficina?view=backlog&tab=control&sprint=3f1a-9c')
igual('/solutions', '/oficina?view=solutions')
// lo que NO se debe tocar
igual('/solutions/pilots/abc', '/solutions/pilots/abc')
igual('/solutions/productos', '/solutions/productos')
igual('/leads/lista', '/leads/lista')
igual('/oficina?view=proyectos&p=1', '/oficina?view=proyectos&p=1')
igual('/backlog/otra-cosa/mas', '/backlog/otra-cosa/mas')
// el multi lee ids de la URL de la Oficina: ids con comas debe volver a leerse igual
const url = new URL('http://x' + d('/backlog/control/multi?ids=a,b,c'))
if (url.searchParams.get('ids') === 'a,b,c' && url.searchParams.get('multi') === '1') ok++; else { mal++; console.log('✗ ids no se leen igual') }
console.log(`${ok} ok · ${mal} fallas`)
process.exit(mal ? 1 : 0)
