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

export default function CRMRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const primaryColor = String(config.primaryColor || 'orange');

  const rows = useMemo(() => createInvoiceRows(), []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.checked).map((r) => r.id)),
  );
  const [search, setSearch] = useState('');
  const [financialOpen, setFinancialOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const activeItemAccent =
    primaryColor === 'blue'
      ? 'border-l-blue-500 bg-blue-500/10 text-blue-400'
      : primaryColor === 'emerald'
      ? 'border-l-emerald-500 bg-emerald-500/10 text-emerald-400'
      : primaryColor === 'violet'
      ? 'border-l-violet-500 bg-violet-500/10 text-violet-400'
      : 'border-l-orange-500 bg-orange-500/10 text-orange-400';

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

  const filteredRows = rows.filter(
    (row) =>
      row.company.toLowerCase().includes(search.toLowerCase()) ||
      row.clientName.toLowerCase().includes(search.toLowerCase()) ||
      row.reportDescription.toLowerCase().includes(search.toLowerCase()),
  );

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
          <SidebarItem icon={LayoutDashboard} label="Overview" />
          <SidebarItem icon={Users} label="Clients" />
          <SidebarItem icon={Briefcase} label="Projects" />

          <SidebarSectionHeader label="Payments Hub" />
          <SidebarItem icon={Wallet} label="Payments Hub" />

          <button
            type="button"
            onClick={() => setFinancialOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500"
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
              <SidebarItem icon={Receipt} label="Invoices Dashboard" />
              <SidebarItem icon={FileText} label="Invoice Manager" active accentClass={activeItemAccent} />
              <SidebarItem icon={History} label="Payment History" />
              <SidebarItem icon={Repeat} label="Subscriptions" />
              <SidebarItem icon={TrendingUp} label="Revenue Insights" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setAnalyticsOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500"
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
              <SidebarItem icon={LineChart} label="Growth Overview" />
              <SidebarItem icon={PieChart} label="Expense Tracker" />
              <SidebarItem icon={BarChart3} label="Performance Reports" />
            </div>
          )}

          <div className="mt-auto flex flex-col gap-0.5 pt-4">
            <SidebarItem icon={HelpCircle} label="Support Center" />
            <SidebarItem icon={Bell} label="Notifications" />
          </div>
        </nav>

        {/* Footer items */}
        <div className="border-t border-gray-800 px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <SidebarItem icon={Users2} label="Team Access" />
            <SidebarItem icon={Zap} label="Automation Rules" />
            <SidebarItem icon={Plug} label="Integrations" />
            <SidebarItem icon={Shield} label="Compliance Center" />
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
              className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold">Invoice Manager</h1>
          </div>
          <AppBackButton />
        </header>

        {/* Breadcrumb */}
        <div className="px-6 py-3 text-xs text-gray-500">
          Dashboard <span className="mx-1">&gt;</span> Financial Center{' '}
          <span className="mx-1">&gt;</span>{' '}
          <span className="text-gray-300">Invoice Manager</span>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Update
            </button>
            <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300">
              {selectedIds.size} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              Sort
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-gray-500">80 Results</span>
          </div>
        </div>

        {/* Data table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  accentClass?: string;
}) {
  return (
    <button
      type="button"
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
