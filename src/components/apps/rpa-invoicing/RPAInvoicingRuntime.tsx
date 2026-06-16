'use client';

import { FileText, CheckCircle2, Clock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Invoice {
  id: string;
  vendor: string;
  amount: number;
  currentStep: number;
  status: 'approved' | 'pending' | 'rejected' | 'paid';
}

const DEFAULT_STEPS = ['Recepción', 'Validación OCR', 'Conciliación', 'Aprobación', 'Pago'];

const DEFAULT_RULES = [
  '< $1.000: automático',
  '$1.000 - $10.000: aprobador directo',
  '> $10.000: comité',
];

const DUMMY_INVOICES: Invoice[] = [
  { id: 'INV-2026-001', vendor: 'Acme Supplies', amount: 450, currentStep: 4, status: 'paid' },
  { id: 'INV-2026-002', vendor: 'TechCloud SA', amount: 3200, currentStep: 3, status: 'pending' },
  { id: 'INV-2026-003', vendor: 'OfficeMax', amount: 850, currentStep: 2, status: 'pending' },
  { id: 'INV-2026-004', vendor: 'Global Logistics', amount: 14500, currentStep: 1, status: 'pending' },
  { id: 'INV-2026-005', vendor: 'Consultora Beta', amount: 780, currentStep: 3, status: 'approved' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function statusBadge(status: Invoice['status']) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'paid':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'rejected':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
}

function statusLabel(status: Invoice['status']) {
  switch (status) {
    case 'approved':
      return 'Aprobada';
    case 'paid':
      return 'Pagada';
    case 'rejected':
      return 'Rechazada';
    default:
      return 'Pendiente';
  }
}

export default function RPAInvoicingRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const steps = Array.isArray(config.steps) ? (config.steps as string[]) : DEFAULT_STEPS;
  const approvalRules = Array.isArray(config.approvalRules)
    ? (config.approvalRules as string[])
    : DEFAULT_RULES;
  const autoApproveBelow = Number(config.autoApproveBelow || 1000);

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Automatización de facturación RPA</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            Auto-aprobación &lt; {formatCurrency(autoApproveBelow)}
          </div>
          <AppBackButton />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Pipeline */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Pipeline de facturas</h3>
            <span className="text-xs text-gray-500">{DUMMY_INVOICES.length} facturas activas</span>
          </div>

          <div className="space-y-4">
            {DUMMY_INVOICES.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{invoice.vendor}</p>
                      <p className="text-xs text-gray-500">{invoice.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{formatCurrency(invoice.amount)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge(invoice.status)}`}>
                      {statusLabel(invoice.status)}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-1 overflow-x-auto py-2">
                  {steps.map((step, index) => {
                    const completed = index < invoice.currentStep;
                    const active = index === invoice.currentStep;
                    return (
                      <div key={step} className="flex min-w-fit items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                              completed
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                : active
                                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                  : 'border-gray-700 bg-gray-950 text-gray-500'
                            }`}
                          >
                            {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                          </div>
                          <span className="whitespace-nowrap text-[10px] text-gray-500">{step}</span>
                        </div>
                        {index < steps.length - 1 && (
                          <ArrowRight className="mx-1 h-3 w-3 flex-shrink-0 text-gray-700" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approval rules sidebar */}
        <aside className="hidden w-72 flex-shrink-0 border-l border-gray-800 bg-gray-900/40 p-5 lg:block">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Reglas de aprobación</h3>
          </div>
          <div className="space-y-3">
            {approvalRules.map((rule, i) => (
              <div key={i} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                  <p className="text-xs text-gray-300">{rule}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-gray-800 bg-gray-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              Tiempo promedio de ciclo
            </div>
            <p className="text-2xl font-bold text-white">4.2 h</p>
            <p className="text-xs text-gray-500">Desde recepción hasta pago</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
