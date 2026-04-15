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
    <div className="h-full flex flex-col overflow-hidden bg-surface">
      <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-2 pt-0.5">
        <div className="mx-auto flex max-w-[1600px] items-end gap-0.5">
            {availableTabs.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-t-sm border border-b-0 px-1.5 py-0.5 text-left transition-all active:scale-[0.99]',
                    isActive
                      ? 'border-primary/30 bg-surface text-on-surface'
                      : 'border-outline-variant/10 bg-surface-container-low text-outline hover:bg-surface-container-high hover:text-on-surface',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center border shrink-0',
                      isActive
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-outline-variant/10 bg-surface-container-highest text-primary',
                    )}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0 text-[6px] font-headline font-black uppercase tracking-[0.1em] leading-none">
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
