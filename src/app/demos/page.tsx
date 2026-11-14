'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Bot, Building2, CalendarClock, FileSearch, Truck, BarChart3, Database, Workflow, ShieldCheck, ArrowUpRight, Loader2 } from 'lucide-react'

// Vitrina pública de demos, MVPs y casos. Hereda el diseño de la landing (architechia.co): negro, naranja, Space Grotesk e Inter.
// Solo muestra lo que se marcó como público en el catálogo interno.

const LANDING = 'https://architechia.co'
const CONTACTO = `${LANDING}/#contacto`

const ICONOS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles, bot: Bot, edificio: Building2, calendario: CalendarClock, documentos: FileSearch, logistica: Truck, analitica: BarChart3, datos: Database, flujo: Workflow, seguridad: ShieldCheck,
}

type Demo = { slug: string; nombre: string; resumen: string; sector: string; servicio: string; tipo: string; url: string | null; icono: string; vivo: boolean | null }

const SERVICIOS: { k: string; t: string }[] = [
  { k: 'todo', t: 'Todas' }, { k: 'agentes', t: 'Agentes de IA' }, { k: 'automatizacion', t: 'Automatización' }, { k: 'datos', t: 'Datos y analítica' }, { k: 'otro', t: 'Otros' },
]
const SERVICIO_TXT: Record<string, string> = { agentes: 'Agentes de IA', automatizacion: 'Automatización', datos: 'Datos y analítica', otro: 'Otros' }
const TIPO: Record<string, string> = { DEMO: 'Demo en vivo', MVP: 'MVP', CASO_REAL: 'Caso real' }

const FUENTES = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');"

const CSS = `
.lp{--black-deep:#0a0a0a;--black-card:#111111;--black-border:#1e1e1e;--orange:#E84700;--orange-light:#FF5C1A;--orange-glow:rgba(232,71,0,.25);--orange-faint:rgba(232,71,0,.08);--white:#fff;--white-muted:rgba(255,255,255,.7);--tr:.3s cubic-bezier(.4,0,.2,1);
  background:var(--black-deep);color:var(--white);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;min-height:100vh;position:relative;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.lp *,.lp *::before,.lp *::after{box-sizing:border-box}
.lp a{color:inherit;text-decoration:none}
.lp h1,.lp h2,.lp h3,.lp p{margin:0}
.lp :focus-visible{outline:2px solid var(--orange);outline-offset:3px;border-radius:4px}
.lp .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(232,71,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(232,71,0,.04) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 40%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 40%,transparent 100%)}
.lp .wrap{width:100%;max-width:1200px;margin:0 auto;padding:0 24px;position:relative;z-index:1}
.lp .tag{display:inline-flex;align-items:center;gap:6px;background:var(--orange-faint);border:1px solid rgba(232,71,0,.3);color:var(--orange-light);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:6px 14px;border-radius:50px}
.lp #nav{position:fixed;top:0;left:0;right:0;z-index:1000;transition:var(--tr);padding:20px 0}
.lp #nav.sc{background:rgba(0,0,0,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--black-border);padding:12px 0}
.lp .nav-in{display:flex;align-items:center;justify-content:space-between}
.lp .nav-in img{height:40px;width:auto;display:block}
.lp .links{display:flex;align-items:center;gap:32px;list-style:none;margin:0;padding:0}
.lp .links a{font-size:14px;font-weight:500;color:var(--white-muted);transition:var(--tr);position:relative}
.lp .links a:hover,.lp .links a.on{color:var(--white)}
.lp .links a:not(.cta)::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:2px;background:var(--orange);transition:var(--tr)}
.lp .links a:not(.cta):hover::after,.lp .links a.on::after{width:100%}
.lp .links a.cta{background:var(--orange);color:#fff;padding:10px 24px;border-radius:8px;font-weight:600;font-size:13px;white-space:nowrap}
.lp .links a.cta:hover{background:var(--orange-light);transform:translateY(-1px);box-shadow:0 8px 24px var(--orange-glow)}
.lp .hero{position:relative;padding:150px 0 40px;overflow:hidden}
.lp .glow{position:absolute;top:-30%;left:50%;transform:translateX(-50%);width:900px;height:700px;background:radial-gradient(ellipse at center,rgba(232,71,0,.18) 0%,transparent 65%);pointer-events:none}
.lp .hero-c{position:relative;z-index:2;max-width:740px}
.lp .h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(40px,6vw,68px);font-weight:700;line-height:1.05;letter-spacing:-.03em;margin:24px 0}
.lp .acc{background:linear-gradient(90deg,var(--orange),var(--orange-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.lp .sub{font-size:18px;color:var(--white-muted);max-width:560px;line-height:1.7}
.lp .filtros{display:flex;flex-wrap:wrap;gap:10px;margin:36px 0 32px}
.lp .fl{font:500 13px 'Inter',sans-serif;padding:8px 18px;border-radius:50px;border:1px solid var(--black-border);background:transparent;color:var(--white-muted);cursor:pointer;transition:var(--tr)}
.lp .fl:hover{border-color:rgba(232,71,0,.5);color:#fff}
.lp .fl.on{background:var(--orange-faint);border-color:rgba(232,71,0,.4);color:var(--orange-light)}
.lp .rej{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.lp .card{background:var(--black-card);border:1px solid var(--black-border);border-radius:20px;padding:32px 28px;position:relative;overflow:hidden;transition:var(--tr);display:flex;flex-direction:column}
.lp .card:hover{border-color:rgba(232,71,0,.4);transform:translateY(-4px);box-shadow:0 24px 60px rgba(0,0,0,.4),0 0 0 1px rgba(232,71,0,.1)}
.lp .cg{position:absolute;top:-40%;right:-20%;width:300px;height:300px;background:radial-gradient(circle,rgba(232,71,0,.12),transparent 70%);pointer-events:none;transition:var(--tr)}
.lp .card:hover .cg{filter:brightness(2.5)}
.lp .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;position:relative}
.lp .ico{width:56px;height:56px;border-radius:14px;background:var(--orange-faint);border:1px solid rgba(232,71,0,.25);display:flex;align-items:center;justify-content:center;color:var(--orange-light)}
.lp .tp{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:50px;border:1px solid var(--black-border);color:var(--white-muted)}
.lp .tp.d{background:var(--orange-faint);border-color:rgba(232,71,0,.3);color:var(--orange-light)}
.lp .card h2{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.01em;margin-bottom:12px;position:relative}
.lp .desc{color:var(--white-muted);font-size:15px;line-height:1.7;margin-bottom:16px;position:relative}
.lp .meta{font-size:12px;color:rgba(255,255,255,.4);margin-top:auto;padding-bottom:20px;position:relative}
.lp .acts{display:flex;flex-wrap:wrap;gap:10px;position:relative}
.lp .bp{display:inline-flex;align-items:center;gap:6px;background:var(--orange);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px;transition:var(--tr)}
.lp .bp:hover{background:var(--orange-light);transform:translateY(-2px);box-shadow:0 12px 32px var(--orange-glow)}
.lp .bs{display:inline-flex;align-items:center;gap:6px;background:transparent;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px;border:1px solid var(--black-border);transition:var(--tr)}
.lp .bs:hover{border-color:var(--orange);color:var(--orange);transform:translateY(-2px)}
.lp .nd{font-size:13px;color:var(--white-muted);padding:11px 4px}
.lp .vacio{text-align:center;color:var(--white-muted);padding:56px 0;font-size:16px}
.lp .cta-box{margin:72px 0 96px;background:var(--black-card);border:1px solid var(--black-border);border-radius:20px;padding:44px 40px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;position:relative;overflow:hidden}
.lp .cta-box h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(24px,3vw,34px);font-weight:700;letter-spacing:-.02em;margin-bottom:8px;position:relative}
.lp .cta-box p{color:var(--white-muted);font-size:16px;position:relative}
.lp footer{border-top:1px solid var(--black-border);padding:48px 0;position:relative;z-index:1}
.lp .f-in{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.lp .f-logo{display:flex;align-items:center;gap:10px}
.lp .f-logo img{height:32px;width:auto}
.lp .f-logo span{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700}
.lp .f-logo .oi{color:var(--orange)}
.lp .f-links{display:flex;gap:24px;flex-wrap:wrap}
.lp .f-links a{font-size:13px;color:var(--white-muted);transition:var(--tr)}
.lp .f-links a:hover{color:var(--orange)}
.lp .f-copy{font-size:12px;color:rgba(255,255,255,.3)}
@media(max-width:1000px){.lp .rej{grid-template-columns:1fr 1fr}.lp .links li:not(:last-child){display:none}}
@media(max-width:640px){.lp .rej{grid-template-columns:1fr}.lp .hero{padding-top:120px}.lp .cta-box{padding:32px 24px}.lp .f-in{flex-direction:column;align-items:flex-start}.lp .bp,.lp .bs{justify-content:center}}
`

export default function Vitrina() {
  const [demos, setDemos] = useState<Demo[] | null>(null)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState('todo')
  const [scroll, setScroll] = useState(false)

  useEffect(() => {
    fetch('/api/publico/demos').then(r => (r.ok ? r.json() : Promise.reject())).then(setDemos).catch(() => setError(true))
  }, [])
  useEffect(() => {
    const f = () => setScroll(window.scrollY > 40)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  const visibles = useMemo(() => (demos ?? []).filter(d => filtro === 'todo' || d.servicio === filtro), [demos, filtro])
  const presentes = useMemo(() => new Set((demos ?? []).map(d => d.servicio)), [demos])

  return (
    <div className="lp">
      <style>{FUENTES}</style>
      <style>{CSS}</style>
      <div className="grid-bg" aria-hidden="true" />

      <nav id="nav" className={scroll ? 'sc' : ''} role="navigation" aria-label="Navegación principal">
        <div className="wrap nav-in">
          <a href={LANDING} aria-label="ArchiTechIA inicio"><img src={`${LANDING}/logo.png`} alt="ArchiTechIA" /></a>
          <ul className="links">
            <li><a href={`${LANDING}/#servicios`}>Servicios</a></li>
            <li><a href={`${LANDING}/#casos`}>Casos de uso</a></li>
            <li><a href={`${LANDING}/#proceso`}>Proceso</a></li>
            <li><a href={`${LANDING}/#por-que`}>Nosotros</a></li>
            <li><a href="/demos" className="on" aria-current="page">Demos</a></li>
            <li><a href={CONTACTO} className="cta">Hablar con un experto</a></li>
          </ul>
        </div>
      </nav>

      <header className="hero">
        <div className="glow" aria-hidden="true" />
        <div className="wrap">
          <div className="hero-c">
            <h1 className="h1">Pruébalo antes<br /><span className="acc">de contratarlo.</span></h1>
            <p className="sub">Soluciones de IA y automatización funcionando con datos de ejemplo. Entra, explora y dinos qué cambiarías para tu empresa.</p>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="filtros" role="group" aria-label="Filtrar por servicio">
          {SERVICIOS.filter(s => s.k === 'todo' || presentes.has(s.k)).map(s => (
            <button key={s.k} type="button" className={`fl${filtro === s.k ? ' on' : ''}`} onClick={() => setFiltro(s.k)} aria-pressed={filtro === s.k}>{s.t}</button>))}
        </div>

        {demos === null && !error && <div className="vacio"><Loader2 className="animate-spin" size={22} style={{ display: 'inline-block' }} /></div>}
        {error && <p className="vacio">No pudimos cargar las demos ahora. Vuelve a intentarlo en unos minutos.</p>}
        {demos !== null && demos.length === 0 && <p className="vacio">Estamos preparando las primeras demos. Agenda una reunión y te mostramos lo que ya funciona.</p>}

        <div className="rej">
          {visibles.map(d => {
            const Ico = ICONOS[d.icono] ?? Sparkles
            const caida = !!d.url && d.vivo === false
            return (
              <article key={d.slug} className="card">
                <div className="cg" aria-hidden="true" />
                <div className="top">
                  <div className="ico"><Ico size={26} aria-hidden /></div>
                  <span className={`tp${d.tipo === 'DEMO' ? ' d' : ''}`}>{TIPO[d.tipo] ?? 'Demo en vivo'}</span>
                </div>
                <h2>{d.nombre}</h2>
                {d.resumen && <p className="desc">{d.resumen}</p>}
                <p className="meta">{[d.sector, SERVICIO_TXT[d.servicio]].filter(Boolean).join(' · ')}</p>
                <div className="acts">
                  {d.url && !caida && <a href={d.url} target="_blank" rel="noopener noreferrer" className="bp">Ver demo <ArrowUpRight size={15} aria-hidden /></a>}
                  {caida && <span className="nd">No disponible por ahora</span>}
                  <a href={`${CONTACTO}`} className="bs">Quiero una igual</a>
                </div>
              </article>)
          })}
        </div>

        <section className="cta-box" aria-labelledby="cta-t">
          <div className="cg" aria-hidden="true" />
          <div>
            <h2 id="cta-t">¿No ves lo que necesitas?</h2>
            <p>Cuéntanos tu caso y armamos una demo con tus propios datos.</p>
          </div>
          <a href={CONTACTO} className="bp" style={{ position: 'relative' }}>Hablemos</a>
        </section>
      </main>

      <footer role="contentinfo">
        <div className="wrap f-in">
          <div className="f-logo"><img src={`${LANDING}/logo.png`} alt="ArchiTechIA" /><span>ArchiTech<span className="oi">IA</span></span></div>
          <nav className="f-links" aria-label="Links del footer">
            <a href={`${LANDING}/#servicios`}>Servicios</a>
            <a href={`${LANDING}/#casos`}>Casos de uso</a>
            <a href={`${LANDING}/#proceso`}>Proceso</a>
            <a href={CONTACTO}>Contacto</a>
          </nav>
          <p className="f-copy">© {new Date().getFullYear()} ArchiTechIA. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
