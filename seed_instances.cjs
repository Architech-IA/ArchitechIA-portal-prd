const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const ownerId = 'cms80vrth0001l06u1rip4c4v'

  const types = await prisma.appType.findMany()
  console.log('AppTypes encontrados:', types.length)

  const demos = {
    'crm':                 { name: 'CRM Demo',               description: 'Demo de gestión de relaciones con clientes, leads y oportunidades.' },
    'landing-page':        { name: 'Landing Page Demo',       description: 'Demo de página de aterrizaje para campañas de marketing.' },
    'webpage':             { name: 'Webpage Demo',            description: 'Demo de sitio web corporativo multi-página.' },
    'dashboard':           { name: 'Tablero Analítico Demo',  description: 'Demo de visualización de KPIs y métricas de negocio.' },
    'ai-chatbot':          { name: 'AI Chatbot Demo',         description: 'Demo de asistente virtual con IA para atención al cliente.' },
    'bi-dashboard':        { name: 'Dashboard BI Demo',       description: 'Demo de business intelligence con métricas en tiempo real.' },
    'rpa-invoicing':       { name: 'RPA Facturación Demo',    description: 'Demo de automatización del flujo de recepción y aprobación de facturas.' },
    'customer-portal':     { name: 'Customer Portal Demo',    description: 'Demo de portal de clientes para proyectos, facturas y tickets.' },
    'helpdesk':            { name: 'Helpdesk Demo',           description: 'Demo de sistema de tickets de soporte con SLA y prioridades.' },
    'security-dashboard':  { name: 'Security Dashboard Demo', description: 'Demo de panel de ciberseguridad con activos, amenazas e incidentes.' },
    'integration-hub':     { name: 'Integration Hub Demo',    description: 'Demo de panel de integraciones entre sistemas y APIs.' },
    'project-manager':     { name: 'Project Manager Demo',    description: 'Demo de gestión de proyectos con tablero Kanban y hitos.' },
    'secop-ai-analyzer':   { name: 'SECOP AI Analyzer Demo',  description: 'Demo de análisis de contratación pública SECOP II con IA.' },
  }

  for (const type of types) {
    const info = demos[type.slug] || { name: type.name + ' Demo', description: type.description }
    const slug = type.slug + '-demo'

    const existing = await prisma.appInstance.findUnique({ where: { slug } })
    if (existing) { console.log('Ya existe:', slug); continue }

    const instance = await prisma.appInstance.create({
      data: {
        name: info.name,
        description: info.description,
        slug,
        appTypeId: type.id,
        status: 'ACTIVE',
        config: type.defaultConfig || {},
        ownerId,
      }
    })
    console.log('OK', instance.slug, '-', instance.name)
  }

  console.log('Done')
}

main().catch(console.error).finally(() => prisma.$disconnect())
