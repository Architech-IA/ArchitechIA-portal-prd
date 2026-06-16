'use client';

import { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Wallet,
  Building2,
  Receipt,
  FileText,
  History,
  Repeat,
  TrendingUp,
  BarChart3,
  LineChart,
  PieChart,
  HelpCircle,
  Bell,
  Users2,
  Zap,
  Plug,
  Shield,
  Search,
  GripVertical,
  ArrowLeft,
  RotateCw,
  Filter,
  ChevronDown,
  ChevronRight,
  Star,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  MoreHorizontal,
  CreditCard,
  DollarSign,
  Activity,
  Layers,
  Mail,
  MessageSquare,
  ShieldCheck,
  FileCheck,
  Gauge,
  CircleDot,
  Calendar,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface InvoiceRow {
  id: string;
  company: string;
  clientName: string;
  value: number;
  reportIcon: 'star' | 'plus';
  reportColor: string;
  reportDescription: string;
  checked: boolean;
}

type ViewId =
  | 'Overview'
  | 'Clients'
  | 'Projects'
  | 'Payments Hub'
  | 'Invoices Dashboard'
  | 'Invoice Manager'
  | 'Payment History'
  | 'Subscriptions'
  | 'Revenue Insights'
  | 'Growth Overview'
  | 'Expense Tracker'
  | 'Performance Reports'
  | 'Support Center'
  | 'Notifications'
  | 'Team Access'
  | 'Automation Rules'
  | 'Integrations'
  | 'Compliance Center';

type SortKey = 'company' | 'clientName' | 'value';
type ReportFilter = 'all' | 'star' | 'plus';
type ValueRangeFilter = 'all' | 'low' | 'mid' | 'high';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-lime-500',
  'bg-fuchsia-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-red-500',
];

function createInvoiceRows(): InvoiceRow[] {
  const data: Omit<InvoiceRow, 'id'>[] = [
    {
      company: 'BrightPath',
      clientName: 'Elena Voss',
      value: 1300,
      reportIcon: 'star',
      reportColor: 'text-amber-400',
      reportDescription: 'Financial dashboard for quarterly review.',
      checked: true,
    },
    {
      company: 'CoreVision',
      clientName: 'Marcus Chen',
      value: 2500,
      reportIcon: 'plus',
      reportColor: 'text-blue-400',
      reportDescription: 'Designed an AI workflow automation suite.',
      checked: false,
    },
    {
      company: 'VentureEdge',
      clientName: 'Sarah Lind',
      value: 3600,
      reportIcon: 'star',
      reportColor: 'text-rose-400',
      reportDescription: 'Generated revenue insights report for Q2.',
      checked: true,
    },
    {
      company: 'Skyline Group',
      clientName: 'David Park',
      value: 800,
      reportIcon: 'plus',
      reportColor: 'text-emerald-400',
      reportDescription: 'Onboarded client to subscription billing.',
      checked: false,
    },
    {
      company: 'NextLink',
      clientName: 'Ava Reynolds',
      value: 4200,
      reportIcon: 'star',
      reportColor: 'text-violet-400',
      reportDescription: 'Performance tracking for outreach campaign.',
      checked: true,
    },
    {
      company: 'HelixOne',
      clientName: 'Noah Brooks',
      value: 2300,
      reportIcon: 'plus',
      reportColor: 'text-cyan-400',
      reportDescription: 'Built a custom CRM integration pipeline.',
      checked: false,
    },
    {
      company: 'NovaTech',
      clientName: 'Isabella Torres',
      value: 10800,
      reportIcon: 'star',
      reportColor: 'text-amber-400',
      reportDescription: 'Financial dashboard for enterprise rollout.',
      checked: true,
    },
    {
      company: 'AxisLogic',
      clientName: 'Liam Foster',
      value: 2300,
      reportIcon: 'plus',
      reportColor: 'text-blue-400',
      reportDescription: 'Designed an AI workflow for data tagging.',
      checked: false,
    },
    {
      company: 'FusionWorks',
      clientName: 'Mia Patel',
      value: 7500,
      reportIcon: 'star',
      reportColor: 'text-rose-400',
      reportDescription: 'Generated revenue insights report for Q3.',
      checked: false,
    },
    {
      company: 'DataVerse',
      clientName: 'Ethan Cole',
      value: 15000,
      reportIcon: 'plus',
      reportColor: 'text-emerald-400',
      reportDescription: 'Onboarded client to analytics warehouse.',
      checked: false,
    },
    {
      company: 'Optima Corp',
      clientName: 'Olivia Hart',
      value: 4200,
      reportIcon: 'star',
      reportColor: 'text-violet-400',
      reportDescription: 'Performance tracking for sales funnel.',
      checked: false,
    },
    {
      company: 'StratusFlow',
      clientName: 'Lucas Gray',
      value: 2500,
      reportIcon: 'plus',
      reportColor: 'text-cyan-400',
      reportDescription: 'Built a custom billing workflow engine.',
      checked: false,
    },
    {
      company: 'BluePeak',
      clientName: 'Sophia Kim',
      value: 4200,
      reportIcon: 'star',
      reportColor: 'text-amber-400',
      reportDescription: 'Financial dashboard for investor deck.',
      checked: true,
    },
    {
      company: 'NeuraSys',
      clientName: 'James Wright',
      value: 1300,
      reportIcon: 'plus',
      reportColor: 'text-blue-400',
      reportDescription: 'Designed an AI workflow for support bots.',
      checked: false,
    },
  ];

  return data.map((row, index) => ({ ...row, id: `inv-${index + 1}` }));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getRandomStat(base: number, variance = 0.08) {
  const delta = base * variance;
  return Math.round(base + (Math.random() * delta * 2 - delta));
}

const SIDEBAR_ITEMS: { icon: React.ComponentType<{ className?: string }>; label: ViewId; section?: 'financial' | 'analytics' | 'footer' | 'payments' }[] = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: Users, label: 'Clients' },
  { icon: Briefcase, label: 'Projects' },
  { icon: Wallet, label: 'Payments Hub', section: 'payments' },
  { icon: Receipt, label: 'Invoices Dashboard', section: 'financial' },
  { icon: FileText, label: 'Invoice Manager', section: 'financial' },
  { icon: History, label: 'Payment History', section: 'financial' },
  { icon: Repeat, label: 'Subscriptions', section: 'financial' },
  { icon: TrendingUp, label: 'Revenue Insights', section: 'financial' },
  { icon: LineChart, label: 'Growth Overview', section: 'analytics' },
  { icon: PieChart, label: 'Expense Tracker', section: 'analytics' },
  { icon: BarChart3, label: 'Performance Reports', section: 'analytics' },
  { icon: HelpCircle, label: 'Support Center' },
  { icon: Bell, label: 'Notifications' },
  { icon: Users2, label: 'Team Access', section: 'footer' },
  { icon: Zap, label: 'Automation Rules', section: 'footer' },
  { icon: Plug, label: 'Integrations', section: 'footer' },
  { icon: Shield, label: 'Compliance Center', section: 'footer' },
];

const FINANCIAL_VIEWS: ViewId[] = [
  'Invoices Dashboard',
  'Invoice Manager',
  'Payment History',
  'Subscriptions',
  'Revenue Insights',
];

const ANALYTICS_VIEWS: ViewId[] = ['Growth Overview', 'Expense Tracker', 'Performance Reports'];

export default function CRMRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const primaryColor = String(config.primaryColor || 'orange');

  const rows = useMemo(() => createInvoiceRows(), []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.checked).map((r) => r.id)),
  );
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<ViewId>('Invoice Manager');
  const [previousView, setPreviousView] = useState<ViewId>('Overview');
  const [financialOpen, setFinancialOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [valueRangeFilter, setValueRangeFilter] = useState<ValueRangeFilter>('all');

  const [updateLoading, setUpdateLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [pulseStats, setPulseStats] = useState(false);

  const activeItemAccent =
    primaryColor === 'blue'
      ? 'border-l-blue-500 bg-blue-500/10 text-blue-400'
      : primaryColor === 'emerald'
      ? 'border-l-emerald-500 bg-emerald-500/10 text-emerald-400'
      : primaryColor === 'violet'
      ? 'border-l-violet-500 bg-violet-500/10 text-violet-400'
      : 'border-l-orange-500 bg-orange-500/10 text-orange-400';

  const activeButtonAccent =
    primaryColor === 'blue'
      ? 'hover:text-blue-400 hover:border-blue-500/50'
      : primaryColor === 'emerald'
      ? 'hover:text-emerald-400 hover:border-emerald-500/50'
      : primaryColor === 'violet'
      ? 'hover:text-violet-400 hover:border-violet-500/50'
      : 'hover:text-orange-400 hover:border-orange-500/50';

  const switchView = (view: ViewId) => {
    setPreviousView(activeView);
    setActiveView(view);
    if (FINANCIAL_VIEWS.includes(view) && !financialOpen) setFinancialOpen(true);
    if (ANALYTICS_VIEWS.includes(view) && !analyticsOpen) setAnalyticsOpen(true);
  };

  const handleBack = () => {
    setActiveView('Overview');
  };

  const handleUpdate = () => {
    setUpdateLoading(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setPulseStats(true);
      setUpdateLoading(false);
      setTimeout(() => setPulseStats(false), 600);
    }, 800);
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = () => {
    const options: (SortKey | '')[] = ['company', 'clientName', 'value', ''];
    const currentIndex = options.indexOf(sortKey);
    const nextKey = options[(currentIndex + 1) % options.length];
    if (nextKey === sortKey && nextKey !== '') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else if (nextKey !== '') {
      setSortKey(nextKey);
      setSortDir('asc');
    } else {
      setSortKey('');
      setSortDir('asc');
    }
  };

  const sortLabel =
    sortKey === 'company'
      ? `Company ${sortDir === 'asc' ? 'A-Z' : 'Z-A'}`
      : sortKey === 'clientName'
      ? `Client ${sortDir === 'asc' ? 'A-Z' : 'Z-A'}`
      : sortKey === 'value'
      ? `Value ${sortDir === 'asc' ? 'Low-High' : 'High-Low'}`
      : 'Sort';

  const filteredRows = useMemo(() => {
    let result = rows.filter(
      (row) =>
        row.company.toLowerCase().includes(search.toLowerCase()) ||
        row.clientName.toLowerCase().includes(search.toLowerCase()) ||
        row.reportDescription.toLowerCase().includes(search.toLowerCase()),
    );

    if (reportFilter !== 'all') {
      result = result.filter((row) => row.reportIcon === reportFilter);
    }

    if (valueRangeFilter !== 'all') {
      result = result.filter((row) => {
        if (valueRangeFilter === 'low') return row.value < 2500;
        if (valueRangeFilter === 'mid') return row.value >= 2500 && row.value <= 7500;
        if (valueRangeFilter === 'high') return row.value > 7500;
        return true;
      });
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        if (sortKey === 'company') comparison = a.company.localeCompare(b.company);
        else if (sortKey === 'clientName') comparison = a.clientName.localeCompare(b.clientName);
        else if (sortKey === 'value') comparison = a.value - b.value;
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [rows, search, reportFilter, valueRangeFilter, sortKey, sortDir]);

  const headerTitle = activeView;

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a18] text-sm text-white">
      {/* Left sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-[#0f0f1a]">
        {/* Logo + company name */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold">
            RV
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{companyName}</h2>
            <p className="text-xs text-gray-500">Invoice Manager</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-white placeholder-gray-600 outline-none"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2">
          <SidebarItem
            icon={LayoutDashboard}
            label="Overview"
            active={activeView === 'Overview'}
            accentClass={activeItemAccent}
            onClick={() => switchView('Overview')}
          />
          <SidebarItem
            icon={Users}
            label="Clients"
            active={activeView === 'Clients'}
            accentClass={activeItemAccent}
            onClick={() => switchView('Clients')}
          />
          <SidebarItem
            icon={Briefcase}
            label="Projects"
            active={activeView === 'Projects'}
            accentClass={activeItemAccent}
            onClick={() => switchView('Projects')}
          />

          <SidebarSectionHeader label="Payments Hub" />
          <SidebarItem
            icon={Wallet}
            label="Payments Hub"
            active={activeView === 'Payments Hub'}
            accentClass={activeItemAccent}
            onClick={() => switchView('Payments Hub')}
          />

          <button
            type="button"
            onClick={() => setFinancialOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-400"
          >
            <span>Financial Center</span>
            {financialOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {financialOpen && (
            <div className="flex flex-col gap-0.5">
              <SidebarItem
                icon={Receipt}
                label="Invoices Dashboard"
                active={activeView === 'Invoices Dashboard'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Invoices Dashboard')}
              />
              <SidebarItem
                icon={FileText}
                label="Invoice Manager"
                active={activeView === 'Invoice Manager'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Invoice Manager')}
              />
              <SidebarItem
                icon={History}
                label="Payment History"
                active={activeView === 'Payment History'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Payment History')}
              />
              <SidebarItem
                icon={Repeat}
                label="Subscriptions"
                active={activeView === 'Subscriptions'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Subscriptions')}
              />
              <SidebarItem
                icon={TrendingUp}
                label="Revenue Insights"
                active={activeView === 'Revenue Insights'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Revenue Insights')}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setAnalyticsOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-400"
          >
            <span>Analytics</span>
            {analyticsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {analyticsOpen && (
            <div className="flex flex-col gap-0.5">
              <SidebarItem
                icon={LineChart}
                label="Growth Overview"
                active={activeView === 'Growth Overview'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Growth Overview')}
              />
              <SidebarItem
                icon={PieChart}
                label="Expense Tracker"
                active={activeView === 'Expense Tracker'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Expense Tracker')}
              />
              <SidebarItem
                icon={BarChart3}
                label="Performance Reports"
                active={activeView === 'Performance Reports'}
                accentClass={activeItemAccent}
                onClick={() => switchView('Performance Reports')}
              />
            </div>
          )}

          <div className="mt-auto flex flex-col gap-0.5 pt-4">
            <SidebarItem
              icon={HelpCircle}
              label="Support Center"
              active={activeView === 'Support Center'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Support Center')}
            />
            <SidebarItem
              icon={Bell}
              label="Notifications"
              active={activeView === 'Notifications'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Notifications')}
            />
          </div>
        </nav>

        {/* Footer items */}
        <div className="border-t border-gray-800 px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <SidebarItem
              icon={Users2}
              label="Team Access"
              active={activeView === 'Team Access'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Team Access')}
            />
            <SidebarItem
              icon={Zap}
              label="Automation Rules"
              active={activeView === 'Automation Rules'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Automation Rules')}
            />
            <SidebarItem
              icon={Plug}
              label="Integrations"
              active={activeView === 'Integrations'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Integrations')}
            />
            <SidebarItem
              icon={Shield}
              label="Compliance Center"
              active={activeView === 'Compliance Center'}
              accentClass={activeItemAccent}
              onClick={() => switchView('Compliance Center')}
            />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header row */}
        <header className="flex items-center justify-between border-b border-gray-800 bg-[#0a0a18] px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold">{headerTitle}</h1>
          </div>
          <AppBackButton />
        </header>

        {/* Breadcrumb */}
        <div className="px-6 py-3 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => switchView('Overview')}
            className="hover:text-gray-300 hover:underline"
          >
            Dashboard
          </button>
          <span className="mx-1">&gt;</span>
          <button
            type="button"
            onClick={() => {
              setFinancialOpen(true);
              switchView('Invoices Dashboard');
            }}
            className="hover:text-gray-300 hover:underline"
          >
            Financial Center
          </button>
          <span className="mx-1">&gt;</span>
          <button
            type="button"
            onClick={() => switchView('Invoice Manager')}
            className={`hover:text-gray-300 hover:underline ${
              activeView === 'Invoice Manager' ? 'text-gray-300' : ''
            }`}
          >
            Invoice Manager
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={updateLoading}
              className={`flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800 ${
                updateLoading ? 'cursor-wait opacity-70' : ''
              }`}
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${updateLoading ? 'animate-spin' : ''}`}
              />
              Update
            </button>
            <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300">
              {selectedIds.size} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800 ${
                  filterOpen ? 'border-gray-500 bg-gray-800' : ''
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Report Type
                    </label>
                    <select
                      value={reportFilter}
                      onChange={(e) => setReportFilter(e.target.value as ReportFilter)}
                      className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white outline-none focus:border-gray-500"
                    >
                      <option value="all">All reports</option>
                      <option value="star">Star reports</option>
                      <option value="plus">Plus reports</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Deal Value
                    </label>
                    <select
                      value={valueRangeFilter}
                      onChange={(e) => setValueRangeFilter(e.target.value as ValueRangeFilter)}
                      className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white outline-none focus:border-gray-500"
                    >
                      <option value="all">Any value</option>
                      <option value="low">Under $2,500</option>
                      <option value="mid">$2,500 - $7,500</option>
                      <option value="high">Over $7,500</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSort}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800"
            >
              {sortLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-gray-500">{filteredRows.length} Results</span>
          </div>
        </div>

        {/* Main view content */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {activeView === 'Invoice Manager' ? (
            <InvoiceManagerTable
              filteredRows={filteredRows}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              toggleRow={toggleRow}
            />
          ) : (
            <ViewContent
              activeView={activeView}
              pulseStats={pulseStats}
              lastUpdated={lastUpdated}
              accentColor={primaryColor}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarSectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {label}
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  accentClass,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  accentClass?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-xs text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200 ${
        active
          ? accentClass ||
            'border-l-orange-500 bg-orange-500/10 text-orange-400'
          : ''
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function InvoiceManagerTable({
  filteredRows,
  selectedIds,
  setSelectedIds,
  toggleRow,
}: {
  filteredRows: InvoiceRow[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRow: (id: string) => void;
}) {
  return (
    <div className="min-w-[800px] overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-gray-900 text-gray-400">
          <tr className="border-b border-gray-800">
            <th className="w-10 px-3 py-3 font-medium"></th>
            <th className="w-10 px-3 py-3 font-medium">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-0 focus:ring-offset-0"
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(filteredRows.map((r) => r.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                checked={
                  filteredRows.length > 0 &&
                  filteredRows.every((r) => selectedIds.has(r.id))
                }
              />
            </th>
            <th className="px-3 py-3 font-medium">Company</th>
            <th className="px-3 py-3 font-medium">Client Name</th>
            <th className="px-3 py-3 font-medium">Deal Value</th>
            <th className="px-3 py-3 font-medium">Business Report</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {filteredRows.map((row) => {
            const selected = selectedIds.has(row.id);
            const ReportIcon = row.reportIcon === 'star' ? Star : Plus;
            return (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-gray-800/50 ${
                  selected ? 'bg-gray-800/30' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <GripVertical className="h-4 w-4 text-gray-600" />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleRow(row.id)}
                    className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-0 focus:ring-offset-0"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-gray-200">
                  {row.company}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${getAvatarColor(
                        row.clientName,
                      )}`}
                    >
                      {getInitials(row.clientName)}
                    </div>
                    <span className="text-gray-300">{row.clientName}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-gray-200">
                  {formatCurrency(row.value)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ReportIcon
                      className={`h-4 w-4 flex-shrink-0 ${row.reportColor}`}
                    />
                    <span className="text-gray-400">{row.reportDescription}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filteredRows.length === 0 && (
        <div className="px-6 py-12 text-center text-xs text-gray-500">
          No results found.
        </div>
      )}
    </div>
  );
}

function ViewContent({
  activeView,
  pulseStats,
  lastUpdated,
  accentColor,
}: {
  activeView: ViewId;
  pulseStats: boolean;
  lastUpdated: Date;
  accentColor: string;
}) {
  switch (activeView) {
    case 'Overview':
      return <OverviewView pulseStats={pulseStats} lastUpdated={lastUpdated} accentColor={accentColor} />;
    case 'Clients':
      return <ClientsView pulseStats={pulseStats} />;
    case 'Projects':
      return <ProjectsView />;
    case 'Payments Hub':
      return <PaymentsHubView pulseStats={pulseStats} />;
    case 'Invoices Dashboard':
      return <InvoicesDashboardView pulseStats={pulseStats} />;
    case 'Payment History':
      return <PaymentHistoryView />;
    case 'Subscriptions':
      return <SubscriptionsView />;
    case 'Revenue Insights':
      return <RevenueInsightsView />;
    case 'Growth Overview':
      return <GrowthOverviewView />;
    case 'Expense Tracker':
      return <ExpenseTrackerView />;
    case 'Performance Reports':
      return <PerformanceReportsView />;
    case 'Support Center':
      return <SupportCenterView />;
    case 'Notifications':
      return <NotificationsView />;
    case 'Team Access':
      return <TeamAccessView />;
    case 'Automation Rules':
      return <AutomationRulesView />;
    case 'Integrations':
      return <IntegrationsView />;
    case 'Compliance Center':
      return <ComplianceCenterView />;
    default:
      return <OverviewView pulseStats={pulseStats} lastUpdated={lastUpdated} accentColor={accentColor} />;
  }
}

function StatCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
  pulse,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  pulse?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900 p-4 transition-transform ${
        pulse ? 'scale-[1.02]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="rounded-lg bg-gray-800 p-1.5">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      </div>
      <div className="mb-1 text-2xl font-semibold text-white">{value}</div>
      <div className={`flex items-center gap-1 text-xs ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        <span>{change}</span>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function OverviewView({
  pulseStats,
  lastUpdated,
  accentColor,
}: {
  pulseStats: boolean;
  lastUpdated: Date;
  accentColor: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(getRandomStat(128400, 0.05))}
          change="+12.5% vs last month"
          positive
          icon={DollarSign}
          pulse={pulseStats}
        />
        <StatCard
          label="Active Clients"
          value={String(getRandomStat(42, 0.1))}
          change="+3 new this week"
          positive
          icon={Users}
          pulse={pulseStats}
        />
        <StatCard
          label="Open Invoices"
          value={String(getRandomStat(18, 0.15))}
          change="-2 since yesterday"
          positive
          icon={FileText}
          pulse={pulseStats}
        />
        <StatCard
          label="Pending Support"
          value={String(getRandomStat(7, 0.2))}
          change="+1 urgent ticket"
          positive={false}
          icon={AlertCircle}
          pulse={pulseStats}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Revenue Trend"
          action={<span className="text-xs text-gray-500">Last 6 months</span>}
        >
          <div className="flex h-48 items-end gap-2">
            {[35, 48, 42, 60, 55, 72].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-md ${
                    accentColor === 'blue'
                      ? 'bg-blue-500/70'
                      : accentColor === 'emerald'
                      ? 'bg-emerald-500/70'
                      : accentColor === 'violet'
                      ? 'bg-violet-500/70'
                      : 'bg-orange-500/70'
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] text-gray-500">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity">
          <div className="space-y-3">
            {[
              { text: 'NovaTech paid invoice #2041', time: '2m ago', icon: CheckCircle2, color: 'text-emerald-400' },
              { text: 'New project created for BluePeak', time: '1h ago', icon: Plus, color: 'text-blue-400' },
              { text: 'Subscription renewed by CoreVision', time: '3h ago', icon: Repeat, color: 'text-violet-400' },
              { text: 'Support ticket resolved #883', time: '5h ago', icon: CheckCircle2, color: 'text-emerald-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <item.icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${item.color}`} />
                <div className="flex-1">
                  <p className="text-xs text-gray-300">{item.text}</p>
                  <p className="text-[10px] text-gray-500">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Quick Tasks">
          <div className="space-y-2">
            {[
              'Review pending invoices',
              'Follow up with DataVerse',
              'Approve Q3 expense report',
              'Update automation rules',
            ].map((task, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-2 transition-colors hover:bg-gray-800/50"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-0"
                />
                <span className="text-xs text-gray-300">{task}</span>
              </label>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-xs text-gray-500">
        <span>Last updated: {formatDate(lastUpdated)} at {lastUpdated.toLocaleTimeString()}</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <CircleDot className="h-3 w-3" />
          Systems operational
        </span>
      </div>
    </div>
  );
}

function ClientsView({ pulseStats }: { pulseStats: boolean }) {
  const clients = [
    { name: 'Elena Voss', company: 'BrightPath', status: 'Active', value: 12400 },
    { name: 'Marcus Chen', company: 'CoreVision', status: 'Active', value: 28500 },
    { name: 'Sarah Lind', company: 'VentureEdge', status: 'Active', value: 18200 },
    { name: 'David Park', company: 'Skyline Group', status: 'Trial', value: 3600 },
    { name: 'Ava Reynolds', company: 'NextLink', status: 'Active', value: 42100 },
    { name: 'Noah Brooks', company: 'HelixOne', status: 'Inactive', value: 9200 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Clients" value="48" change="+6% vs last quarter" positive icon={Users} pulse={pulseStats} />
        <StatCard label="Active Clients" value="42" change="+3 this month" positive icon={CheckCircle2} pulse={pulseStats} />
        <StatCard label="At Risk" value="3" change="-1 from last week" positive icon={AlertCircle} pulse={pulseStats} />
      </div>

      <SectionCard
        title="Client Directory"
        action={
          <button className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">
            + Add Client
          </button>
        }
      >
        <div className="divide-y divide-gray-800">
          {clients.map((client) => (
            <div key={client.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${getAvatarColor(
                    client.name,
                  )}`}
                >
                  {getInitials(client.name)}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{client.name}</p>
                  <p className="text-[10px] text-gray-500">{client.company}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    client.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : client.status === 'Trial'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {client.status}
                </span>
                <span className="text-xs text-gray-300">{formatCurrency(client.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ProjectsView() {
  const projects = [
    { name: 'AI Workflow Automation', client: 'CoreVision', progress: 78, status: 'On Track' },
    { name: 'Enterprise Dashboard', client: 'NovaTech', progress: 45, status: 'At Risk' },
    { name: 'Billing Integration', client: 'Skyline Group', progress: 92, status: 'On Track' },
    { name: 'Support Bot Training', client: 'NeuraSys', progress: 30, status: 'Delayed' },
    { name: 'Q3 Revenue Report', client: 'FusionWorks', progress: 65, status: 'On Track' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Projects" value="12" change="+2 this month" positive icon={Briefcase} />
        <StatCard label="Completed" value="34" change="+8 vs last quarter" positive icon={CheckCircle2} />
        <StatCard label="Delayed" value="2" change="-1 this week" positive icon={Clock} />
      </div>

      <SectionCard title="Project Pipeline">
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.name} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-200">{project.name}</p>
                  <p className="text-[10px] text-gray-500">{project.client}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    project.status === 'On Track'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : project.status === 'At Risk'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {project.status}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="mt-1 flex justify-end text-[10px] text-gray-500">{project.progress}%</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function PaymentsHubView({ pulseStats }: { pulseStats: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Processed" value={formatCurrency(84200)} change="+9.2% this month" positive icon={CreditCard} pulse={pulseStats} />
        <StatCard label="Pending Payouts" value={formatCurrency(14200)} change="5 transactions" positive={false} icon={Clock} pulse={pulseStats} />
        <StatCard label="Success Rate" value="99.2%" change="+0.4%" positive icon={CheckCircle2} pulse={pulseStats} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Payment Methods">
          <div className="space-y-3">
            {[
              { name: 'Credit Card', share: 62, color: 'bg-blue-500' },
              { name: 'Bank Transfer', share: 24, color: 'bg-emerald-500' },
              { name: 'Digital Wallet', share: 14, color: 'bg-violet-500' },
            ].map((method) => (
              <div key={method.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-300">{method.name}</span>
                  <span className="text-gray-500">{method.share}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                  <div className={`h-full rounded-full ${method.color}`} style={{ width: `${method.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Transactions">
          <div className="space-y-3">
            {[
              { name: 'NovaTech', amount: 10800, status: 'Completed' },
              { name: 'BluePeak', amount: 4200, status: 'Completed' },
              { name: 'VentureEdge', amount: 3600, status: 'Pending' },
              { name: 'DataVerse', amount: 15000, status: 'Completed' },
            ].map((tx) => (
              <div key={tx.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <span className="text-xs text-gray-300">{tx.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-200">{formatCurrency(tx.amount)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      tx.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function InvoicesDashboardView({ pulseStats }: { pulseStats: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(196400)} change="+14%" positive icon={Receipt} pulse={pulseStats} />
        <StatCard label="Paid" value={formatCurrency(158200)} change="+11%" positive icon={CheckCircle2} pulse={pulseStats} />
        <StatCard label="Outstanding" value={formatCurrency(38200)} change="+5%" positive={false} icon={Clock} pulse={pulseStats} />
        <StatCard label="Overdue" value={formatCurrency(6200)} change="-2%" positive icon={AlertCircle} pulse={pulseStats} />
      </div>

      <SectionCard title="Invoice Status Breakdown">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Paid', value: 68, color: 'bg-emerald-500' },
            { label: 'Pending', value: 22, color: 'bg-amber-500' },
            { label: 'Overdue', value: 10, color: 'bg-rose-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-center">
              <div className="mx-auto mb-2 h-16 w-16 rounded-full border-4 border-gray-800 p-1">
                <div
                  className={`flex h-full w-full items-center justify-center rounded-full ${item.color}`}
                  style={{ opacity: 0.9 }}
                >
                  <span className="text-sm font-bold text-white">{item.value}%</span>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-300">{item.label}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function PaymentHistoryView() {
  const history = [
    { id: '#2041', client: 'NovaTech', date: '2026-06-15', amount: 10800, method: 'Wire' },
    { id: '#2040', client: 'BluePeak', date: '2026-06-14', amount: 4200, method: 'Card' },
    { id: '#2039', client: 'DataVerse', date: '2026-06-12', amount: 15000, method: 'ACH' },
    { id: '#2038', client: 'NextLink', date: '2026-06-10', amount: 4200, method: 'Card' },
    { id: '#2037', client: 'FusionWorks', date: '2026-06-08', amount: 7500, method: 'Wire' },
  ];

  return (
    <SectionCard title="Payment History">
      <div className="min-w-[600px] overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-900 text-gray-400">
            <tr className="border-b border-gray-800">
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {history.map((row) => (
              <tr key={row.id} className="hover:bg-gray-800/50">
                <td className="px-3 py-2.5 font-medium text-gray-200">{row.id}</td>
                <td className="px-3 py-2.5 text-gray-300">{row.client}</td>
                <td className="px-3 py-2.5 text-gray-400">{row.date}</td>
                <td className="px-3 py-2.5 text-gray-400">{row.method}</td>
                <td className="px-3 py-2.5 text-right font-medium text-gray-200">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function SubscriptionsView() {
  const plans = [
    { name: 'Enterprise', clients: 6, mrr: 24500, growth: '+12%' },
    { name: 'Professional', clients: 18, mrr: 18900, growth: '+8%' },
    { name: 'Starter', clients: 22, mrr: 5600, growth: '+4%' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Monthly Recurring Revenue" value={formatCurrency(49000)} change="+9%" positive icon={Repeat} />
        <StatCard label="Active Subscriptions" value="46" change="+3 this month" positive icon={Users} />
        <StatCard label="Churn Rate" value="2.1%" change="-0.3%" positive icon={Activity} />
      </div>

      <SectionCard title="Plans Overview">
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <div>
                <p className="text-xs font-medium text-gray-200">{plan.name}</p>
                <p className="text-[10px] text-gray-500">{plan.clients} clients</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-200">{formatCurrency(plan.mrr)}</p>
                <p className="text-[10px] text-emerald-400">{plan.growth}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function RevenueInsightsView() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const revenue = [32000, 35000, 34000, 41000, 45000, 48000];
  const expenses = [18000, 19000, 18500, 21000, 22000, 23000];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Net Revenue" value={formatCurrency(284000)} change="+16% YTD" positive icon={TrendingUp} />
        <StatCard label="Gross Margin" value="58%" change="+2%" positive icon={PieChart} />
        <StatCard label="Avg Deal Size" value={formatCurrency(5400)} change="+7%" positive icon={DollarSign} />
      </div>

      <SectionCard title="Revenue vs Expenses">
        <div className="flex h-56 items-end gap-3">
          {months.map((month, i) => {
            const max = Math.max(...revenue, ...expenses);
            const revH = (revenue[i] / max) * 100;
            const expH = (expenses[i] / max) * 100;
            return (
              <div key={month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end gap-1">
                  <div className="flex-1 rounded-t bg-emerald-500/70" style={{ height: `${revH}%` }} />
                  <div className="flex-1 rounded-t bg-rose-500/70" style={{ height: `${expH}%` }} />
                </div>
                <span className="text-[10px] text-gray-500">{month}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" /> Revenue
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-rose-500/70" /> Expenses
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

function GrowthOverviewView() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="User Growth" value="+24%" change="+6% vs target" positive icon={Users} />
        <StatCard label="New Deals" value="18" change="+5 this month" positive icon={Plus} />
        <StatCard label="Conversion Rate" value="12.4%" change="+1.2%" positive icon={TrendingUp} />
      </div>

      <SectionCard title="Growth Channels">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'Organic Search', value: 35, color: 'bg-blue-500' },
            { name: 'Direct', value: 28, color: 'bg-violet-500' },
            { name: 'Referral', value: 22, color: 'bg-emerald-500' },
            { name: 'Paid Ads', value: 15, color: 'bg-amber-500' },
          ].map((channel) => (
            <div key={channel.name} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-center">
              <div className="mx-auto mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-800">
                <div className={`h-full ${channel.color}`} style={{ width: `${channel.value}%` }} />
              </div>
              <p className="text-lg font-semibold text-white">{channel.value}%</p>
              <p className="text-[10px] text-gray-500">{channel.name}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ExpenseTrackerView() {
  const categories = [
    { name: 'Salaries', amount: 12400, percent: 52 },
    { name: 'Marketing', amount: 4200, percent: 18 },
    { name: 'Infrastructure', amount: 3600, percent: 15 },
    { name: 'Software', amount: 2400, percent: 10 },
    { name: 'Other', amount: 1200, percent: 5 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Expenses" value={formatCurrency(23800)} change="+3%" positive={false} icon={PieChart} />
        <StatCard label="Largest Category" value="Salaries" change="52% of total" positive icon={Users} />
        <StatCard label="Budget Left" value={formatCurrency(16200)} change="32% remaining" positive icon={DollarSign} />
      </div>

      <SectionCard title="Expense Breakdown">
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-gray-300">{cat.name}</span>
                <span className="text-gray-400">{formatCurrency(cat.amount)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                  style={{ width: `${cat.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function PerformanceReportsView() {
  const reports = [
    { name: 'Sales Funnel Report', date: 'Jun 15, 2026', status: 'Ready', icon: BarChart3 },
    { name: 'Client Retention Analysis', date: 'Jun 14, 2026', status: 'Ready', icon: Users },
    { name: 'Revenue Forecast Q3', date: 'Jun 12, 2026', status: 'Generating', icon: TrendingUp },
    { name: 'Team Performance', date: 'Jun 10, 2026', status: 'Ready', icon: Gauge },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Reports Generated" value="48" change="+12 this month" positive icon={FileText} />
        <StatCard label="Avg Generation Time" value="12s" change="-3s" positive icon={Clock} />
        <StatCard label="Scheduled Reports" value="8" change="+2" positive icon={Calendar} />
      </div>

      <SectionCard title="Available Reports">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {reports.map((report) => (
            <div
              key={report.name}
              className="flex items-start justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3 transition-colors hover:bg-gray-800/50"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-gray-800 p-2">
                  <report.icon className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{report.name}</p>
                  <p className="text-[10px] text-gray-500">{report.date}</p>
                </div>
              </div>
              <button className="rounded-md border border-gray-700 p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function SupportCenterView() {
  const tickets = [
    { id: '#883', subject: 'Invoice discrepancy', client: 'BrightPath', priority: 'High', status: 'Open' },
    { id: '#882', subject: 'Integration help', client: 'HelixOne', priority: 'Medium', status: 'In Progress' },
    { id: '#881', subject: 'User access request', client: 'NextLink', priority: 'Low', status: 'Open' },
    { id: '#880', subject: 'Report export issue', client: 'FusionWorks', priority: 'Medium', status: 'Resolved' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open Tickets" value="7" change="-2 today" positive icon={HelpCircle} />
        <StatCard label="Avg Response Time" value="2.4h" change="-0.6h" positive icon={Clock} />
        <StatCard label="Satisfaction" value="94%" change="+2%" positive icon={CheckCircle2} />
      </div>

      <SectionCard title="Recent Tickets">
        <div className="divide-y divide-gray-800">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-medium text-gray-200">
                  {ticket.id} — {ticket.subject}
                </p>
                <p className="text-[10px] text-gray-500">{ticket.client}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    ticket.priority === 'High'
                      ? 'bg-rose-500/10 text-rose-400'
                      : ticket.priority === 'Medium'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  {ticket.priority}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    ticket.status === 'Resolved'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : ticket.status === 'In Progress'
                      ? 'bg-violet-500/10 text-violet-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {ticket.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function NotificationsView() {
  const notifications = [
    { text: 'Payment received from NovaTech', time: '2m ago', read: false, icon: DollarSign },
    { text: 'New support ticket #884', time: '15m ago', read: false, icon: HelpCircle },
    { text: 'Invoice #2042 is due tomorrow', time: '1h ago', read: true, icon: Clock },
    { text: 'CoreVision upgraded to Enterprise', time: '3h ago', read: true, icon: TrendingUp },
  ];

  return (
    <SectionCard
      title="Notifications"
      action={
        <button className="text-xs text-gray-500 hover:text-gray-300">Mark all read</button>
      }
    >
      <div className="space-y-2">
        {notifications.map((note, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              note.read ? 'border-gray-800 bg-gray-900/30' : 'border-gray-700 bg-gray-800/30'
            }`}
          >
            <div className={`mt-0.5 rounded-full p-1 ${note.read ? 'bg-gray-800' : 'bg-orange-500/10'}`}>
              <note.icon className={`h-3.5 w-3.5 ${note.read ? 'text-gray-500' : 'text-orange-400'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-xs ${note.read ? 'text-gray-400' : 'text-gray-200'}`}>{note.text}</p>
              <p className="text-[10px] text-gray-500">{note.time}</p>
            </div>
            {!note.read && <span className="h-2 w-2 rounded-full bg-orange-400" />}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function TeamAccessView() {
  const members = [
    { name: 'Alex Rivera', role: 'Admin', status: 'Active' },
    { name: 'Jordan Lee', role: 'Editor', status: 'Active' },
    { name: 'Taylor Morgan', role: 'Viewer', status: 'Pending' },
    { name: 'Casey Brooks', role: 'Editor', status: 'Active' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Team Members" value="8" change="+1 this month" positive icon={Users2} />
        <StatCard label="Active Now" value="4" change="2 away" positive icon={Activity} />
        <StatCard label="Pending Invites" value="1" change="Send reminder" positive={false} icon={Mail} />
      </div>

      <SectionCard
        title="Team Members"
        action={
          <button className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">
            + Invite
          </button>
        }
      >
        <div className="divide-y divide-gray-800">
          {members.map((member) => (
            <div key={member.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${getAvatarColor(
                    member.name,
                  )}`}
                >
                  {getInitials(member.name)}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{member.name}</p>
                  <p className="text-[10px] text-gray-500">{member.role}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  member.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {member.status}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function AutomationRulesView() {
  const rules = [
    { name: 'Late invoice reminder', trigger: 'Invoice overdue', status: 'Active' },
    { name: 'Welcome email', trigger: 'New client added', status: 'Active' },
    { name: 'Payment confirmation', trigger: 'Payment received', status: 'Active' },
    { name: 'Upsell opportunity', trigger: 'Deal value > $10k', status: 'Paused' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Rules" value="12" change="+2 this week" positive icon={Zap} />
        <StatCard label="Runs This Month" value="1,248" change="+18%" positive icon={Activity} />
        <StatCard label="Time Saved" value="42h" change="+6h" positive icon={Clock} />
      </div>

      <SectionCard
        title="Automation Rules"
        action={
          <button className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">
            + New Rule
          </button>
        }
      >
        <div className="divide-y divide-gray-800">
          {rules.map((rule) => (
            <div key={rule.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-medium text-gray-200">{rule.name}</p>
                <p className="text-[10px] text-gray-500">Trigger: {rule.trigger}</p>
              </div>
              <button
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  rule.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                }`}
              >
                {rule.status}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function IntegrationsView() {
  const integrations = [
    { name: 'Stripe', category: 'Payments', status: 'Connected' },
    { name: 'Slack', category: 'Messaging', status: 'Connected' },
    { name: 'HubSpot', category: 'CRM', status: 'Connected' },
    { name: 'QuickBooks', category: 'Accounting', status: 'Disconnected' },
    { name: 'Zapier', category: 'Automation', status: 'Connected' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Connected" value="4" change="+1 this month" positive icon={Plug} />
        <StatCard label="API Calls Today" value="24.2k" change="+8%" positive icon={Activity} />
        <StatCard label="Sync Health" value="98%" change="Operational" positive icon={CheckCircle2} />
      </div>

      <SectionCard title="Integrations">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-xs font-bold text-gray-400">
                  {integration.name[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{integration.name}</p>
                  <p className="text-[10px] text-gray-500">{integration.category}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  integration.status === 'Connected'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-gray-500/10 text-gray-400'
                }`}
              >
                {integration.status}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ComplianceCenterView() {
  const checks = [
    { name: 'GDPR Data Retention', status: 'Compliant', date: 'Jun 15, 2026' },
    { name: 'SOC 2 Audit', status: 'Compliant', date: 'May 28, 2026' },
    { name: 'PCI DSS Scan', status: 'Pending Review', date: 'Jun 20, 2026' },
    { name: 'Tax Documentation', status: 'Action Required', date: 'Jun 30, 2026' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Compliance Score" value="92%" change="+3%" positive icon={ShieldCheck} />
        <StatCard label="Policies Active" value="14" change="All up to date" positive icon={FileCheck} />
        <StatCard label="Open Actions" value="2" change="Review needed" positive={false} icon={AlertCircle} />
      </div>

      <SectionCard title="Compliance Checks">
        <div className="divide-y divide-gray-800">
          {checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-medium text-gray-200">{check.name}</p>
                <p className="text-[10px] text-gray-500">Next review: {check.date}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  check.status === 'Compliant'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : check.status === 'Pending Review'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
