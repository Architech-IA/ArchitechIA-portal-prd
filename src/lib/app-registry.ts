import type { AppTypeDefinition } from '@/lib/app-types';
import AppConfigForm from '@/components/apps/shared/AppConfigForm';
import AppRuntimePlaceholder from '@/components/apps/shared/AppRuntimePlaceholder';
import CRMRuntime from '@/components/apps/crm/CRMRuntime';
import LandingRuntime from '@/components/apps/landing/LandingRuntime';

export const APP_REGISTRY: Record<string, AppTypeDefinition> = {
  crm: {
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
  'landing-page': {
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
  webpage: {
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
  dashboard: {
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
};

export const APP_SLUGS = Object.keys(APP_REGISTRY) as (keyof typeof APP_REGISTRY)[];

export function getAppTypeDefinition(slug: string): AppTypeDefinition | undefined {
  return APP_REGISTRY[slug];
}

export function buildInitialConfig(definition: AppTypeDefinition): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  Object.entries(definition.schema.properties).forEach(([key, prop]) => {
    if (key in definition.defaultConfig) {
      config[key] = definition.defaultConfig[key];
    } else if (prop.default !== undefined) {
      config[key] = prop.default;
    }
  });
  return config;
}

export function parseJsonConfig(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export { AppConfigForm, AppRuntimePlaceholder, CRMRuntime, LandingRuntime };
