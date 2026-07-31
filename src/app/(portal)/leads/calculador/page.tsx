'use client';

import { useState } from 'react';

const TECH_OPTIONS = [
  { id: 'chatbot', label: 'Chatbot / Asistente IA', baseCost: 8000, baseWeeks: 6 },
  { id: 'automation', label: 'Automatización de Procesos (RPA/n8n)', baseCost: 12000, baseWeeks: 8 },
  { id: 'dashboard', label: 'Dashboard / Reporting Automatizado', baseCost: 10000, baseWeeks: 6 },
  { id: 'agent', label: 'Agente de IA (Agentic AI)', baseCost: 18000, baseWeeks: 12 },
  { id: 'data', label: 'Pipeline de Datos / Data Lake', baseCost: 15000, baseWeeks: 10 },
  { id: 'security', label: 'Security AI / Visión Computacional', baseCost: 20000, baseWeeks: 14 },
  { id: 'custom', label: 'Desarrollo a Medida', baseCost: 12000, baseWeeks: 8 },
];

const COMPLEXITY_MULT: Record<string, number> = { baja: 0.8, media: 1, alta: 1.3, critica: 1.6 };
const INTEGRATIONS_COST = 2000;
const MAINTENANCE_MONTHS = 12;

export default function CalculadorPage() {
  const [step, setStep] = useState(1);
  const [tech, setTech] = useState('');
  const [complexity, setComplexity] = useState('media');
  const [integrations, setIntegrations] = useState(0);
  const [customHours, setCustomHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('40');
  const [margin, setMargin] = useState('20');

  const selected = TECH_OPTIONS.find(t => t.id === tech);
  const baseCost = selected?.baseCost || 0;
  const baseWeeks = selected?.baseWeeks || 0;

  const complexityMult = COMPLEXITY_MULT[complexity] || 1;
  const integrationCost = integrations * INTEGRATIONS_COST;
  const customCost = customHours ? Number(customHours) * Number(hourlyRate) : 0;

  const subtotal = (baseCost * complexityMult) + integrationCost + customCost;
  const marginRate = Number(margin) / 100;
  const total = Math.round(subtotal * (1 + marginRate));
  const weeks = Math.round(baseWeeks * complexityMult + (integrations * 0.5));
  const maintenanceMonthly = Math.round(total * 0.15);
  const maintenanceYearly = maintenanceMonthly * MAINTENANCE_MONTHS;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <p className="text-gray-400 mb-8">Estima el costo, esfuerzo y margen de tu proyecto de IA</p>

      {/* Steps */}
      <div className="flex gap-1 mb-8 bg-gray-800 rounded-lg p-1 w-fit">
        {['Tecnología', 'Alcance', 'Costos extra', 'Resultado'].map((s, i) => (
          <button key={s} onClick={() => setStep(i + 1)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${step === i + 1 ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {/* Step 1: Tecnología */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white mb-4">Selecciona el tipo de proyecto</h2>
            <div className="grid grid-cols-1 gap-3">
              {TECH_OPTIONS.map(t => (
                <button key={t.id} onClick={() => { setTech(t.id); setStep(2); }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    tech === t.id ? 'border-orange-500 bg-orange-600/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{t.label}</span>
                    <span className="text-sm text-gray-400">~{t.baseWeeks} semanas · ${t.baseCost.toLocaleString()} base</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Alcance */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white mb-4">Define el alcance</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Complejidad del proyecto</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries({ baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }).map(([k, v]) => (
                  <button key={k} onClick={() => setComplexity(k)}
                    className={`p-3 rounded-lg text-sm font-medium border transition-all ${
                      complexity === k ? 'border-orange-500 bg-orange-600/20 text-orange-400' : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-white'
                    }`}>{v}<span className="block text-xs mt-1 opacity-70">x{COMPLEXITY_MULT[k]}</span></button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Integraciones externas (APIs, CRM, ERP)</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setIntegrations(Math.max(0, integrations - 1))} className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 text-white text-lg hover:bg-gray-700">−</button>
                <span className="text-2xl font-bold text-white w-8 text-center">{integrations}</span>
                <button onClick={() => setIntegrations(integrations + 1)} className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 text-white text-lg hover:bg-gray-700">+</button>
                <span className="text-sm text-gray-500">x ${INTEGRATIONS_COST.toLocaleString()} c/u</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-600 text-gray-400 rounded-lg hover:bg-gray-700">← Atrás</button>
              <button onClick={() => setStep(3)} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Siguiente →</button>
            </div>
          </div>
        )}

        {/* Step 3: Costos extra */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white mb-4">Costos adicionales</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Horas de desarrollo extra</label>
                <input type="number" value={customHours} onChange={e => setCustomHours(e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Tarifa por hora (USD)</label>
                <input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="40"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Margen de ganancia</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="50" value={margin} onChange={e => setMargin(e.target.value)} className="flex-1 accent-orange-500" />
                <span className="text-white font-bold text-lg w-12">{margin}%</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className="px-4 py-2 border border-gray-600 text-gray-400 rounded-lg hover:bg-gray-700">← Atrás</button>
              <button onClick={() => setStep(4)} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Calcular →</button>
            </div>
          </div>
        )}

        {/* Step 4: Resultado */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white mb-4">📊 Resultado del cálculo</h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">Costo subtotal</p>
                <p className="text-2xl font-bold text-white">${subtotal.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">Margen ({margin}%)</p>
                <p className="text-2xl font-bold text-orange-400">${Math.round(subtotal * marginRate).toLocaleString()}</p>
              </div>
              <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-5 text-center">
                <p className="text-xs text-orange-400 mb-1">Precio total propuesto</p>
                <p className="text-3xl font-bold text-orange-400">${total.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 text-center">
                <p className="text-xs text-gray-400 mb-1">Tiempo estimado</p>
                <p className="text-2xl font-bold text-white">{weeks} semanas</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Desglose</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">{selected?.label}</span><span className="text-white">${baseCost.toLocaleString()} × {complexityMult}</span></div>
                {integrations > 0 && <div className="flex justify-between"><span className="text-gray-400">{integrations} integraciones</span><span className="text-white">${integrationCost.toLocaleString()}</span></div>}
                {customHours && <div className="flex justify-between"><span className="text-gray-400">{customHours}h extra @ ${hourlyRate}/h</span><span className="text-white">${customCost.toLocaleString()}</span></div>}
                <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold"><span className="text-gray-300">Subtotal</span><span className="text-white">${subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Margen {margin}%</span><span className="text-orange-400">${Math.round(subtotal * marginRate).toLocaleString()}</span></div>
                <div className="border-t border-gray-700 pt-2 flex justify-between font-bold"><span className="text-lg text-white">Total</span><span className="text-lg text-orange-400">${total.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-teal-400 uppercase mb-2">💰 Mantenimiento estimado (12 meses)</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Cuota mensual</span>
                <span className="text-white font-bold">${maintenanceMonthly.toLocaleString()}/mes</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-300">Total anual</span>
                <span className="text-teal-400 font-bold">${maintenanceYearly.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-600 text-gray-400 rounded-lg hover:bg-gray-700">← Recalcular</button>
              <button onClick={() => window.print()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Imprimir / Guardar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
