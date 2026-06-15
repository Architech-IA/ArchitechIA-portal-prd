'use client';

import { useId } from 'react';
import type { AppTypeSchema, JsonSchemaProperty } from '@/lib/app-types';

interface AppConfigFormProps {
  schema: AppTypeSchema;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export default function AppConfigForm({ schema, config, onChange }: AppConfigFormProps) {
  const baseId = useId();

  const updateField = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  const renderField = (key: string, prop: JsonSchemaProperty) => {
    const value = config[key];
    const inputId = `${baseId}-${key}`;

    if (prop.type === 'string' && prop.enum && prop.enum.length > 0) {
      return (
        <select
          id={inputId}
          value={typeof value === 'string' ? value : (prop.default as string) ?? ''}
          onChange={(e) => updateField(key, e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          {prop.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (prop.type === 'string') {
      return (
        <input
          id={inputId}
          type="text"
          value={typeof value === 'string' ? value : (prop.default as string) ?? ''}
          onChange={(e) => updateField(key, e.target.value)}
          placeholder={prop.title}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
        />
      );
    }

    if (prop.type === 'number') {
      return (
        <input
          id={inputId}
          type="number"
          value={typeof value === 'number' ? value : (prop.default as number) ?? 0}
          onChange={(e) => updateField(key, Number(e.target.value))}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
        />
      );
    }

    if (prop.type === 'array' && prop.items) {
      const items = Array.isArray(value) ? value : ((prop.default as unknown[]) ?? []);

      // Array de strings
      if (typeof prop.items === 'object' && 'type' in prop.items && prop.items.type === 'string') {
        const stringItems = items.map((item) => String(item));
        return (
          <StringArrayEditor
            items={stringItems}
            onChange={(next) => updateField(key, next)}
            placeholder={prop.title}
          />
        );
      }

      // Array de objetos
      if (typeof prop.items === 'object' && 'type' in prop.items && prop.items.type === 'object' && prop.items.properties) {
        return (
          <ObjectArrayEditor
            items={items as Record<string, unknown>[]}
            properties={prop.items.properties}
            required={prop.items.required}
            onChange={(next) => updateField(key, next)}
          />
        );
      }
    }

    return (
      <input
        id={inputId}
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => updateField(key, e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
      />
    );
  };

  return (
    <div className="space-y-5">
      {Object.entries(schema.properties).map(([key, prop]) => (
        <div key={key}>
          <label htmlFor={`${baseId}-${key}`} className="mb-1.5 block text-sm font-medium text-gray-300">
            {prop.title ?? key}
            {schema.required?.includes(key) && <span className="ml-1 text-red-400">*</span>}
          </label>
          {prop.description && <p className="mb-1.5 text-xs text-gray-500">{prop.description}</p>}
          {renderField(key, prop)}
        </div>
      ))}
    </div>
  );
}

function StringArrayEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const addItem = () => onChange([...items, '']);
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };
  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="rounded-lg border border-red-900/50 bg-red-900/20 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700"
      >
        + Agregar
      </button>
    </div>
  );
}

function ObjectArrayEditor({
  items,
  properties,
  required,
  onChange,
}: {
  items: Record<string, unknown>[];
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  onChange: (items: Record<string, unknown>[]) => void;
}) {
  const addItem = () => {
    const empty: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, prop]) => {
      empty[key] = prop.default ?? '';
    });
    onChange([...items, empty]);
  };

  const updateItem = (index: number, key: string, value: unknown) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Ítem {index + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Quitar
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(properties).map(([key, prop]) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-gray-500">
                  {prop.title ?? key}
                  {required?.includes(key) && <span className="ml-1 text-red-400">*</span>}
                </label>
                <input
                  type="text"
                  value={typeof item[key] === 'string' ? item[key] : ''}
                  onChange={(e) => updateItem(index, key, e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700"
      >
        + Agregar ítem
      </button>
    </div>
  );
}
