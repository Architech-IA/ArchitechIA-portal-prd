import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creando tipos de mini-apps...');

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
            items: { type: 'string', enum: ['dashboard', 'contacts', 'deals', 'tasks', 'reports'] },
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
        modules: ['dashboard', 'contacts', 'deals'],
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
          companyName: { type: 'string', title: 'Nombre de la empresa' },
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
        headline: 'Transforma tu negocio con IA',
        subheadline: 'Automatiza procesos, toma mejores decisiones y escala tu operación con agentes inteligentes.',
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
                label: { type: 'string', title: 'Etiqueta' },
                href: { type: 'string', title: 'URL' },
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
                type: { type: 'string', title: 'Tipo', enum: ['chart', 'kpi', 'table'] },
                title: { type: 'string', title: 'Título' },
                dataSource: { type: 'string', title: 'Fuente de datos' },
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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
