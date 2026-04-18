import React, { useState } from 'react';
import { BadgeCheck, Clock3, HandCoins, ScrollText, WalletCards } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmployeesScreen } from './EmployeesScreen';
import { EmployeeCheckerScreen } from '../EmployeeChecker/EmployeeCheckerScreen';
import { PayrollsScreen } from '../Payrolls/PayrollsScreen';
import { EmployeeAdvancesHistoryScreen } from './EmployeeAdvancesHistoryScreen';
import { EmployeePayrollHistoryScreen } from './EmployeePayrollHistoryScreen';
import { useAuthStore } from '../../store/authStore';

type EmployeesModuleTab = 'directory' | 'checker' | 'payroll' | 'advances-history' | 'payroll-history';

const employeeTabs: Array<{
  id: EmployeesModuleTab;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'directory',
    label: 'Expediente',
    icon: <BadgeCheck className="w-3.5 h-3.5" />,
  },
  {
    id: 'checker',
    label: 'Checador',
    icon: <Clock3 className="w-3.5 h-3.5" />,
  },
  {
    id: 'payroll',
    label: 'Nómina',
    icon: <WalletCards className="w-3.5 h-3.5" />,
  },
  {
    id: 'advances-history',
    label: 'Hist. Adelantos',
    icon: <HandCoins className="w-3.5 h-3.5" />,
  },
  {
    id: 'payroll-history',
    label: 'Hist. Nóminas',
    icon: <ScrollText className="w-3.5 h-3.5" />,
  },
];

export function EmployeesHubScreen() {
  const role = useAuthStore((state) => state.user?.role ?? '');
  const canSeeDirectory = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role);
  const canSeeChecker = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role);
  const canSeePayroll = ['ADMIN', 'SUPERVISOR'].includes(role);
  const canSeeAdvanceHistory = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role);
  const canSeePayrollHistory = ['ADMIN', 'SUPERVISOR'].includes(role);
  const availableTabs = employeeTabs.filter((tab) => {
    if (tab.id === 'directory') return canSeeDirectory;
    if (tab.id === 'checker') return canSeeChecker;
    if (tab.id === 'payroll') return canSeePayroll;
    if (tab.id === 'advances-history') return canSeeAdvanceHistory;
    if (tab.id === 'payroll-history') return canSeePayrollHistory;
    return false;
  });
  const [activeTab, setActiveTab] = useState<EmployeesModuleTab>('directory');

  React.useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id ?? 'checker');
    }
  }, [activeTab, availableTabs]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'checker':
        return <EmployeeCheckerScreen />;
      case 'payroll':
        return <PayrollsScreen />;
      case 'advances-history':
        return <EmployeeAdvancesHistoryScreen />;
      case 'payroll-history':
        return <EmployeePayrollHistoryScreen />;
      case 'directory':
      default:
        return <EmployeesScreen />;
    }
  };

  return (
    <div className="admin-shell h-full flex flex-col overflow-hidden">
      <div className="border-b border-white/8 bg-black/14 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
            {availableTabs.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3.5 py-2 text-left transition-all duration-300 active:scale-[0.99]',
                    isActive
                      ? 'border-primary/25 bg-primary/12 text-on-surface shadow-[0_12px_28px_rgba(255,215,0,0.08)]'
                      : 'border-white/10 bg-white/[0.03] text-outline hover:border-white/16 hover:bg-white/[0.06] hover:text-on-surface',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border shrink-0',
                      isActive
                        ? 'border-primary/20 bg-primary/14 text-primary'
                        : 'border-white/10 bg-black/20 text-outline',
                    )}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0 text-[11px] font-headline font-black uppercase tracking-[0.12em] leading-none">
                    {tab.label}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {renderActiveView()}
      </div>
    </div>
  );
}
