'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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

export default function AppRuntimePage() {
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
    <div className="h-full">
      {/* Runtime area */}
      <div className="h-full overflow-hidden">
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
