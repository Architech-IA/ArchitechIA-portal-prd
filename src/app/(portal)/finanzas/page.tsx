'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FinanzasGeneral from './FinanzasGeneral';
import CuentasTab from './tabs/CuentasTab';
import InventarioTab from './tabs/InventarioTab';
import ProveedoresTab from './tabs/ProveedoresTab';
import ContabilidadTab from './tabs/ContabilidadTab';
import RRHHTab from './tabs/RRHHTab';

// Hub de Finance: "General" es la pagina de Finance de siempre (con sus
// propias pestañas Resumen/Registros, que pasan a ser sub-pestañas de
// General) y el resto de modulos administrativos viven aca como pestañas
// en vez de ir sueltos en el sidebar. La pestaña activa va en la URL
// (?tab=...) para poder enlazarla y para que recargar no la pierda; las
// rutas anteriores (/inventario, /proveedores, /contabilidad, /rrhh,
// /resources/cuentas) redirigen a la pestaña correspondiente.
const TABS = [
  { key: 'general', label: 'General' },
  { key: 'cuentas', label: 'Cuentas' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'rrhh', label: 'RRHH' },
] as const;
type TabKey = typeof TABS[number]['key'];

function FinanceHub() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = TABS.some(t => t.key === raw) ? (raw as TabKey) : 'general';

  const ir = (k: TabKey) => router.replace(k === 'general' ? '/finanzas' : `/finanzas?tab=${k}`, { scroll: false });

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de Finance"
        style={{ display: 'flex', gap: '2px', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,26,0.7)', overflowX: 'auto' }}
      >
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => ir(t.key)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-md border-0 border-b-2 transition-all duration-150 flex-shrink-0 ${
                active
                  ? 'border-b-orange-500 bg-orange-500/[0.07] text-orange-400'
                  : 'border-b-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'general' && <FinanzasGeneral />}
      {tab === 'cuentas' && <CuentasTab />}
      {tab === 'inventario' && <InventarioTab />}
      {tab === 'proveedores' && <ProveedoresTab />}
      {tab === 'contabilidad' && <ContabilidadTab />}
      {tab === 'rrhh' && <RRHHTab />}
    </div>
  );
}

export default function FinanzasPage() {
  return (
    <Suspense fallback={null}>
      <FinanceHub />
    </Suspense>
  );
}
