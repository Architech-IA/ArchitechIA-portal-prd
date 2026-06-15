// Tipos base para el Mini-Apps Hub

export interface JsonSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: JsonSchemaProperty | { type: string; properties?: Record<string, JsonSchemaProperty>; required?: string[] };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface AppTypeSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface AppTypeDefinition {
  id?: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  schema: AppTypeSchema;
  defaultConfig: Record<string, unknown>;
}

export interface AppInstance {
  id: string;
  appTypeId: string;
  appType: {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
  };
  name: string;
  description: string | null;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  config: Record<string, unknown>;
  leadId: string | null;
  proposalId: string | null;
  projectId: string | null;
  clienteId: string | null;
  ownerId: string;
  owner: { name: string };
  createdAt: string;
  updatedAt: string;
}

export type AppInstanceInput = {
  name: string;
  description?: string;
  slug: string;
  appTypeId: string;
  status?: AppInstance['status'];
  config?: Record<string, unknown>;
  leadId?: string | null;
  proposalId?: string | null;
  projectId?: string | null;
  clienteId?: string | null;
};

export const APP_STATUS_LABELS: Record<AppInstance['status'], { label: string; dot: string; chip: string }> = {
  DRAFT:     { label: 'Borrador',  dot: 'bg-gray-500',   chip: 'bg-gray-500/10 text-gray-300 border-gray-500/30' },
  ACTIVE:    { label: 'Activa',    dot: 'bg-green-500',  chip: 'bg-green-500/10 text-green-400 border-green-500/30' },
  PAUSED:    { label: 'Pausada',   dot: 'bg-yellow-500', chip: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  ARCHIVED:  { label: 'Archivada', dot: 'bg-red-500',    chip: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

export const APP_CATEGORIES: Record<string, { label: string; color: string }> = {
  comercial:  { label: 'Comercial',  color: 'text-blue-400' },
  marketing:  { label: 'Marketing',  color: 'text-pink-400' },
  data:       { label: 'Data',       color: 'text-emerald-400' },
  operacion:  { label: 'Operación',  color: 'text-orange-400' },
};
