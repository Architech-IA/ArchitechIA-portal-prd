import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creando datos iniciales para ArchiTechIA Portal...');

  // ── Usuarios ──────────────────────────────────────────────────────
  const [adminHash, partnerHash] = await Promise.all([
    hash('admin123',   12),
    hash('partner123', 12),
  ]);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@architechia.co' },
    update: {},
    create: {
      name:     'Admin ArchiTechIA',
      email:    'admin@architechia.co',
      password: adminHash,
      role:     'ADMIN',
    },
  });

  const partner1 = await prisma.user.upsert({
    where:  { email: 'santiago.ortega@architechia.co' },
    update: {},
    create: {
      name:     'Santiago Ortega',
      email:    'santiago.ortega@architechia.co',
      password: partnerHash,
      role:     'GERENTE_COMERCIAL',
    },
  });

  const partner2 = await prisma.user.upsert({
    where:  { email: 'daniel.martinez@architechia.co' },
    update: {},
    create: {
      name:     'Daniel Martínez',
      email:    'daniel.martinez@architechia.co',
      password: partnerHash,
      role:     'GERENTE_ADMINISTRATIVO',
    },
  });

  const partner3 = await prisma.user.upsert({
    where:  { email: 'freddy.orozco@architechia.co' },
    update: {},
    create: {
      name:     'Freddy Orozco',
      email:    'freddy.orozco@architechia.co',
      password: partnerHash,
      role:     'GERENTE_OPERACIONES',
    },
  });

  console.log('✓ Usuarios creados');

  // ── Leads ─────────────────────────────────────────────────────────
  const lead1 = await prisma.lead.create({
    data: {
      companyName:    'TechCorp Solutions',
      contactName:    'Roberto Sánchez',
      email:          'roberto@techcorp.com',
      phone:          '+57 312 345 6789',
      status:         'QUALIFIED',
      source:         'LinkedIn',
      estimatedValue: 15000,
      notes:          'Interesados en automatización de procesos con IA',
      scope:          'Automatización de procesos internos con IA — alcance nacional, sector tecnología',
      userId:         admin.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      companyName:    'InnovateLab',
      contactName:    'Laura Fernández',
      email:          'laura@innovatelab.com',
      status:         'PROPOSAL_SENT',
      source:         'Referido',
      estimatedValue: 25000,
      notes:          'Necesitan sistema de agentic AI para atención al cliente',
      scope:          'Sistema agentic AI para atención al cliente — implementación internacional',
      userId:         partner1.id,
    },
  });

  const lead3 = await prisma.lead.create({
    data: {
      companyName:    'DataFlow Analytics',
      contactName:    'Miguel Torres',
      email:          'miguel@dataflow.com',
      status:         'NEGOTIATION',
      source:         'Web',
      estimatedValue: 35000,
      notes:          'Proyecto grande de automatización de reporting',
      scope:          'Automatización de reporting corporativo — alcance multinacional, múltiples países',
      userId:         partner2.id,
    },
  });

  const lead4 = await prisma.lead.create({
    data: {
      companyName:    'CloudSync Pro',
      contactName:    'Patricia Ruiz',
      email:          'patricia@cloudsync.com',
      status:         'NEW',
      source:         'Evento',
      estimatedValue: 12000,
      scope:          'Migración a la nube — alcance local, una sola sede',
      userId:         partner3.id,
    },
  });

  console.log('✓ Leads creados');

  // ── Propuestas ────────────────────────────────────────────────────
  const proposal1 = await prisma.proposal.create({
    data: {
      title:       'Automatización de Atención al Cliente',
      description: 'Implementación de chatbot inteligente con IA generativa para InnovateLab',
      status:      'SENT',
      amount:      25000,
      leadId:      lead2.id,
      userId:      partner1.id,
      sentDate:    new Date('2025-04-10'),
    },
  });

  const proposal2 = await prisma.proposal.create({
    data: {
      title:       'Sistema de Reporting Automatizado',
      description: 'Pipeline de datos con IA para generación automática de informes',
      status:      'UNDER_REVIEW',
      amount:      35000,
      leadId:      lead3.id,
      userId:      partner2.id,
      sentDate:    new Date('2025-04-08'),
    },
  });

  await prisma.proposal.create({
    data: {
      title:       'Workflow Automation - TechCorp',
      description: 'Automatización de flujos de trabajo internos con n8n e IA',
      status:      'DRAFT',
      amount:      15000,
      leadId:      lead1.id,
      userId:      admin.id,
    },
  });

  console.log('✓ Propuestas creadas');

  // ── Proyectos ─────────────────────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      name:        'Portal Interno ArchiTechIA',
      description: 'Desarrollo del portal interno de gestión para la startup',
      status:      'IN_PROGRESS',
      priority:    'MEDIUM',
      progress:    50,
      startDate:   new Date('2025-03-15'),
      endDate:     new Date('2025-05-01'),
      users: {
        create: [
          { userId: partner1.id, role: 'OWNER'   },
          { userId: admin.id,    role: 'PARTNER'  },
          { userId: partner3.id, role: 'PARTNER'  },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name:        'ORTEGA & ASOCIADOS - Automatización de Citas',
      description: 'Flujo de automatización para asignación y clasificación de citas según especialidad',
      status:      'PLANNING',
      priority:    'HIGH',
      progress:    75,
      startDate:   new Date('2025-04-01'),
      endDate:     new Date('2025-04-30'),
      users: {
        create: [
          { userId: partner2.id, role: 'OWNER'   },
          { userId: partner1.id, role: 'PARTNER'  },
        ],
      },
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name:        'Producto - Security Agentic AI',
      description: 'Piloto de agente de seguridad basado en IA con análisis de cámaras',
      status:      'IN_PROGRESS',
      priority:    'MEDIUM',
      progress:    5,
      startDate:   new Date('2025-04-01'),
      endDate:     new Date('2025-05-31'),
      users: {
        create: [
          { userId: partner3.id, role: 'OWNER'  },
          { userId: admin.id,    role: 'VIEWER' },
        ],
      },
    },
  });

  console.log('✓ Proyectos creados');

  // ── Hitos ─────────────────────────────────────────────────────────
  await prisma.milestone.createMany({
    data: [
      { name: 'Diseño UI/UX',        status: 'COMPLETED',   dueDate: new Date('2025-03-25'), completedDate: new Date('2025-03-24'), projectId: project1.id },
      { name: 'Backend API',         status: 'COMPLETED',   dueDate: new Date('2025-04-05'), completedDate: new Date('2025-04-04'), projectId: project1.id },
      { name: 'Frontend Dashboard',  status: 'IN_PROGRESS', dueDate: new Date('2025-04-20'), projectId: project1.id },
      { name: 'Testing y QA',        status: 'PENDING',     dueDate: new Date('2025-04-28'), projectId: project1.id },
    ],
  });

  console.log('✓ Hitos creados');

  // ── Actividades ───────────────────────────────────────────────────
  await prisma.activity.createMany({
    data: [
      { type: 'CREATED',             description: 'Creó el lead TechCorp Solutions',          entityType: 'lead',     entityId: lead1.id,     userId: admin.id    },
      { type: 'CREATED',             description: 'Creó la propuesta de automatización',       entityType: 'proposal', entityId: proposal1.id, userId: partner1.id },
      { type: 'STATUS_CHANGED',      description: 'Cambió estado del lead a Calificado',       entityType: 'lead',     entityId: lead1.id,     userId: admin.id    },
      { type: 'PROPOSAL_SENT',       description: 'Envió propuesta a InnovateLab',             entityType: 'proposal', entityId: proposal1.id, userId: partner1.id },
      { type: 'CREATED',             description: 'Inició proyecto Portal Interno',            entityType: 'project',  entityId: project1.id,  userId: admin.id    },
      { type: 'MILESTONE_COMPLETED', description: 'Completó hito: Diseño UI/UX',              entityType: 'project',  entityId: project1.id,  userId: partner3.id },
      { type: 'UPDATED',             description: 'Actualizó progreso del proyecto al 50%',   entityType: 'project',  entityId: project1.id,  userId: admin.id    },
      { type: 'NOTE_ADDED',          description: 'Agregó nota: Cliente interesado en demo',  entityType: 'lead',     entityId: lead3.id,     userId: partner2.id },
    ],
  });

  console.log('✓ Actividades creadas');

  // ── Meetings ───────────────────────────────────────────────────────
  await prisma.meeting.createMany({
    data: [
      { title: 'Sprint Planning — Portal Interno', type: 'INTERNAL_DAILY', date: new Date('2025-04-22T15:00:00Z'), location: 'Oficina', attendees: 'Santiago Ortega, Daniel Martínez, Freddy Orozco', status: 'COMPLETED', notes: 'Se definieron prioridades del sprint: dashboard KPIs, filtros avanzados y pipeline Kanban.', userId: partner1.id },
      { title: 'Demo con InnovateLab', type: 'COMMERCIAL', date: new Date('2025-04-25T20:00:00Z'), location: 'Google Meet', link: 'https://meet.google.com/abc-defg-hij', attendees: 'Laura Fernández, Santiago Ortega', status: 'SCHEDULED', userId: partner1.id },
      { title: 'Revisión de Arquitectura — Security Agentic AI', type: 'INTERNAL_WORKSHOP', date: new Date('2025-04-28T14:00:00Z'), location: 'Virtual', attendees: 'Freddy Orozco, Admin ArchiTechIA', status: 'SCHEDULED', notes: 'Revisar diseño de agentes, flujo de datos y requisitos de seguridad para el piloto.', userId: partner3.id },
      { title: 'Cita Discovery — DataFlow Analytics', type: 'ADVISORY', date: new Date('2025-05-02T16:00:00Z'), location: 'Cliente', attendees: 'Miguel Torres, Daniel Martínez', status: 'SCHEDULED', userId: partner2.id },
    ],
  });
  console.log('✓ Meetings creados');

  // ── Tipos de Mini-Apps ────────────────────────────────────────────
  const appTypes = [
    {
      slug: 'crm',
      name: 'CRM',
      description: 'Gestión de relaciones con clientes, leads y oportunidades comerciales.',
      icon: 'Users',
      color: 'from-blue-500 to-indigo-600',
      category: 'comercial',
      schema: {
        type: 'object',
        properties: {
          companyName: { type: 'string', title: 'Nombre de la empresa' },
          modules: {
            type: 'array',
            title: 'Módulos activos',
            items: { type: 'string', enum: ['contacts', 'deals', 'tasks', 'reports'] },
          },
          pipelineStages: {
            type: 'array',
            title: 'Etapas del pipeline',
            items: { type: 'string' },
          },
          theme: { type: 'string', title: 'Tema', enum: ['light', 'dark'], default: 'dark' },
        },
        required: ['companyName'],
      },
      defaultConfig: {
        modules: ['contacts', 'deals'],
        pipelineStages: ['Nuevo', 'Contactado', 'Propuesta', 'Negociación', 'Cerrado'],
        theme: 'dark',
      },
    },
    {
      slug: 'landing-page',
      name: 'Landing Page',
      description: 'Página de aterrizaje para campañas de marketing y captación de leads.',
      icon: 'Layout',
      color: 'from-pink-500 to-rose-600',
      category: 'marketing',
      schema: {
        type: 'object',
        properties: {
          headline: { type: 'string', title: 'Título principal' },
          subheadline: { type: 'string', title: 'Subtítulo' },
          ctaText: { type: 'string', title: 'Texto del botón CTA', default: 'Solicitar demo' },
          formFields: {
            type: 'array',
            title: 'Campos del formulario',
            items: { type: 'string' },
          },
          primaryColor: { type: 'string', title: 'Color primario', default: '#FF5A00' },
        },
        required: ['headline'],
      },
      defaultConfig: {
        ctaText: 'Solicitar demo',
        formFields: ['Nombre', 'Email', 'Empresa'],
        primaryColor: '#FF5A00',
      },
    },
    {
      slug: 'webpage',
      name: 'Webpage',
      description: 'Sitio web corporativo o de producto con múltiples páginas.',
      icon: 'Globe',
      color: 'from-cyan-500 to-blue-600',
      category: 'marketing',
      schema: {
        type: 'object',
        properties: {
          siteName: { type: 'string', title: 'Nombre del sitio' },
          pages: {
            type: 'array',
            title: 'Páginas',
            items: { type: 'string' },
          },
          navigation: {
            type: 'array',
            title: 'Navegación',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                href: { type: 'string' },
              },
              required: ['label', 'href'],
            },
          },
          seoTitle: { type: 'string', title: 'SEO Title' },
          seoDescription: { type: 'string', title: 'SEO Description' },
        },
        required: ['siteName'],
      },
      defaultConfig: {
        pages: ['Inicio', 'Nosotros', 'Servicios', 'Contacto'],
        navigation: [
          { label: 'Inicio', href: '/' },
          { label: 'Nosotros', href: '/nosotros' },
          { label: 'Servicios', href: '/servicios' },
          { label: 'Contacto', href: '/contacto' },
        ],
      },
    },
    {
      slug: 'dashboard',
      name: 'Tablero Analítico',
      description: 'Visualización de KPIs, métricas y datos de negocio.',
      icon: 'BarChart3',
      color: 'from-emerald-500 to-teal-600',
      category: 'data',
      schema: {
        type: 'object',
        properties: {
          dataSources: {
            type: 'array',
            title: 'Fuentes de datos',
            items: { type: 'string' },
          },
          widgets: {
            type: 'array',
            title: 'Widgets',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['chart', 'kpi', 'table'] },
                title: { type: 'string' },
                dataSource: { type: 'string' },
              },
              required: ['type', 'title'],
            },
          },
          refreshInterval: { type: 'number', title: 'Intervalo de refresco (seg)', default: 60 },
        },
      },
      defaultConfig: {
        dataSources: ['Ventas', 'Leads', 'Proyectos'],
        widgets: [
          { type: 'kpi', title: 'Leads activos', dataSource: 'Leads' },
          { type: 'chart', title: 'Pipeline mensual', dataSource: 'Ventas' },
        ],
        refreshInterval: 60,
      },
    },
  ];

  for (const appType of appTypes) {
    await prisma.appType.upsert({
      where: { slug: appType.slug },
      update: {},
      create: appType,
    });
  }

  console.log('✓ Tipos de mini-apps creados');

  console.log('\n✅ Base de datos lista!\n');
  console.log('Credenciales:');
  console.log('  admin@architechia.co        / admin123');
  console.log('  santiago.ortega@architechia.co / partner123');
  console.log('  daniel.martinez@architechia.co / partner123');
  console.log('  freddy.orozco@architechia.co   / partner123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

