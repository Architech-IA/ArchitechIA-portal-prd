'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Box, Users, Layout, Globe, BarChart3,
  Bot, FileText, UserCircle, Headphones, Shield, Plug, Kanban,
} from 'lucide-react';
import CRMRuntime from '@/components/apps/crm/CRMRuntime';
import LandingRuntime from '@/components/apps/landing/LandingRuntime';
import AIChatbotRuntime from '@/components/apps/ai-chatbot/AIChatbotRuntime';
import BIDashboardRuntime from '@/components/apps/bi-dashboard/BIDashboardRuntime';
import RPAInvoicingRuntime from '@/components/apps/rpa-invoicing/RPAInvoicingRuntime';
import CustomerPortalRuntime from '@/components/apps/customer-portal/CustomerPortalRuntime';
import HelpdeskRuntime from '@/components/apps/helpdesk/HelpdeskRuntime';
import SecurityDashboardRuntime from '@/components/apps/security-dashboard/SecurityDashboardRuntime';
import IntegrationHubRuntime from '@/components/apps/integration-hub/IntegrationHubRuntime';
import ProjectManagerRuntime from '@/components/apps/project-manager/ProjectManagerRuntime';
import AppRuntimePlaceholder from '@/components/apps/shared/AppRuntimePlaceholder';
import type { AppInstance } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
  Bot,
  FileText,
  UserCircle,
  Headphones,
  Shield,
  Plug,
  Kanban,
};

export default function AppRuntimePage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params.slug);

  const [app, setApp] = useState<AppInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/apps/by-slug/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && !data.error) {
          setApp(data as AppInstance);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white">App no encontrada</h1>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Barra mínima de navegación */}
      <div className="flex items-center border-b border-gray-800/50 bg-gray-900/50 px-4 py-2">
        <button
          onClick={() => router.push('/apps/catalogo')}
          className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
          title="Volver al catálogo"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Runtime area */}
      <div className="flex-1 overflow-hidden">
        {app.appType.slug === 'crm' && <CRMRuntime app={app} />}
        {app.appType.slug === 'landing-page' && <LandingRuntime app={app} />}
        {app.appType.slug === 'ai-chatbot' && <AIChatbotRuntime app={app} />}
        {app.appType.slug === 'bi-dashboard' && <BIDashboardRuntime app={app} />}
        {app.appType.slug === 'rpa-invoicing' && <RPAInvoicingRuntime app={app} />}
        {app.appType.slug === 'customer-portal' && <CustomerPortalRuntime app={app} />}
        {app.appType.slug === 'helpdesk' && <HelpdeskRuntime app={app} />}
        {app.appType.slug === 'security-dashboard' && <SecurityDashboardRuntime app={app} />}
        {app.appType.slug === 'integration-hub' && <IntegrationHubRuntime app={app} />}
        {app.appType.slug === 'project-manager' && <ProjectManagerRuntime app={app} />}
        {![
          'crm',
          'landing-page',
          'ai-chatbot',
          'bi-dashboard',
          'rpa-invoicing',
          'customer-portal',
          'helpdesk',
          'security-dashboard',
          'integration-hub',
          'project-manager',
        ].includes(app.appType.slug) && <AppRuntimePlaceholder app={app} />}
      </div>
    </div>
  );
}
