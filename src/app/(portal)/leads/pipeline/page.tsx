'use client';

import { useEffect, useState } from 'react';
import { usePageActions } from '@/lib/pageActionsContext';
import PipelineView from '@/components/PipelineView';

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { setActions } = usePageActions()

  useEffect(() => {
    setActions(
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px' }}>
        <a href="/leads/lista" style={{ padding: '4px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: '#6b7280', transition: 'all 0.15s' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>Leads</a>
        <a href="/leads/clientes" style={{ padding: '4px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: '#6b7280', transition: 'all 0.15s' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>Clientes</a>
        <a href="/leads/prospector" style={{ padding: '4px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: '#6b7280', transition: 'all 0.15s' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>Prospector</a>
        <a href="/leads/pipeline" style={{ padding: '4px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', boxShadow: '0 2px 8px rgba(249,115,22,0.35)' }}>Timeline</a>
        <a href="/leads/mercado" style={{ padding: '4px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', color: '#6b7280', transition: 'all 0.15s' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>Mercado</a>
      </div>
    )
    return () => setActions(null)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, u]) => { setLeads(l); setUsers(u); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div style={{ padding: '10px 32px 32px' }}>
      <div className="mb-6">
        <p className="text-gray-400 mt-1">Visualización del pipeline de ventas por etapas</p>
      </div>
      <PipelineView leads={leads} users={users} onLeadsChange={setLeads} />
    </div>
  );
}
