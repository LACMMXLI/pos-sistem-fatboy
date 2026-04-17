import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { 
  Package, 
  ShoppingCart, 
  History, 
  Utensils, 
  Settings, 
  LogOut, 
  Menu, 
  User, 
  LayoutDashboard, 
  Truck,
  AlertCircle,
  LayoutGrid, 
  UtensilsCrossed, 
  Settings as SettingsIcon,
  Users, 
  Calculator, 
  Clock3,
  Bell, 
  BadgeCheck, 
  ReceiptText,
  PackageSearch,
  WalletCards,
  Printer,
  ChevronUp,
  ChevronDown,
  Wallet // Using Wallet as the closest Lucide 'money' container
} from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';

import { Screen } from './types';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { useSettingsStore } from './store/settingsStore';
import { useShiftStore } from './store/shiftStore';
import { getSettings } from './services/api';
import { useRealtimeInvalidation } from './hooks/useRealtimeInvalidation';
import { Toaster } from 'sonner';
import {
  getDesktopZoomFactor,
  isDesktopRuntime,
  setDesktopSessionToken,
  setDesktopZoomFactor,
} from './lib/runtime';
import { PaymentModal } from './components/Modals/PaymentModal';
import { applyThemePreset, resolveThemePresetFromSettings } from './lib/theme';
import { ChangeOverlay } from './components/Overlay/ChangeOverlay';

// Layout Components
import { NavButton } from './components/layout/NavButton';
import { BottomNavButton } from './components/layout/BottomNavButton';

import { SalesScreen } from './views/Sales/SalesScreen';
import { FloorPlanScreen } from './views/FloorPlan/FloorPlanScreen';
import { LoginScreen } from './views/Login/LoginScreen';
import { TabletShell } from './views/Tablet/TabletShell';
import { KitchenShell } from './views/Kitchen/KitchenShell';

const DashboardScreen = lazy(() =>
  import('./views/Dashboard/DashboardScreen').then((module) => ({
    default: module.DashboardScreen,
  })),
);
const KitchenScreen = lazy(() =>
  import('./views/Kitchen/KitchenScreen').then((module) => ({
    default: module.KitchenScreen,
  })),
);
const CustomersScreen = lazy(() =>
  import('./views/Customers/CustomersScreen').then((module) => ({
    default: module.CustomersScreen,
  })),
);
const OrdersScreen = lazy(() =>
  import('./views/Orders/OrdersScreen').then((module) => ({
    default: module.OrdersScreen,
  })),
);
const CashierScreen = lazy(() =>
  import('./views/Cashier/CashierScreen').then((module) => ({
    default: module.CashierScreen,
  })),
);
const ShiftHistoryScreen = lazy(() =>
  import('./views/Cashier/ShiftHistoryScreen').then((module) => ({
    default: module.ShiftHistoryScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import('./views/Settings/SettingsScreen').then((module) => ({
    default: module.SettingsScreen,
  })),
);
const ProductsScreen = lazy(() =>
  import('./views/Products/ProductsScreen').then((module) => ({
    default: module.ProductsScreen,
  })),
);
const DeliveriesScreen = lazy(() =>
  import('./views/Deliveries/DeliveriesScreen').then((module) => ({
    default: module.DeliveriesScreen,
  })),
);
const EmployeesHubScreen = lazy(() =>
  import('./views/Employees/EmployeesHubScreen').then((module) => ({
    default: module.EmployeesHubScreen,
  })),
);
const DigitalTimeClockScreen = lazy(() =>
  import('./views/EmployeeChecker/DigitalTimeClockScreen').then((module) => ({
    default: module.DigitalTimeClockScreen,
  })),
);
const PrintingCenterScreen = lazy(() =>
  import('./views/Printing/PrintingCenterScreen').then((module) => ({
    default: module.PrintingCenterScreen,
  })),
);

function ScreenLoader() {
  return (
    <div className="h-full flex items-center justify-center bg-[#070707]">
      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/40 animate-pulse">
        Initializing...
      </div>
    </div>
  );
}

export default function App() {
  const { user, token, logout } = useAuthStore();
  const { getTotal } = useCartStore();
  const { restaurantName, setSettings, accentColor, panelColor, paperColor, inkColor, themePreset } = useSettingsStore();
  const { checkActiveShift } = useShiftStore();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? '';
  const isAdmin = role === 'ADMIN';
  const isSupervisor = role === 'SUPERVISOR';
  const isCashier = role === 'CAJERO';
  const isWaiter = role === 'MESERO';
  const isKitchen = role === 'COCINA';
  const canSeeDashboard = !!user;
  const canSeeSales = isAdmin || isSupervisor || isCashier;
  const canSeeOrders = isAdmin || isSupervisor || isCashier || isWaiter;
  const canSeeKitchen = isAdmin || isSupervisor || isKitchen;
  const canSeeFloor = isAdmin || isSupervisor || isCashier || isWaiter;
  const canSeeCustomers = isAdmin || isSupervisor || isCashier;
  const canSeeDeliveries = isAdmin || isSupervisor || isCashier;
  const canSeeChecker = isAdmin || isSupervisor || isCashier;
  const canSeeCashier = isAdmin || isSupervisor || isCashier;
  const canSeeShiftHistory = isAdmin || isSupervisor || isCashier;
  const canSeeProducts = isAdmin || isCashier;
  const canSeeEmployees = isAdmin;
  const canSeeSettings = isAdmin;
  const canSeePrinting = isAdmin || isSupervisor;
  const surface = new URLSearchParams(window.location.search).get('surface');
  const isTabletSurface = surface === 'tablet';
  const isKitchenSurface = surface === 'kitchen';

  useEffect(() => {
    if (!user) return;
    const allowed: Screen[] = [
      ...(canSeeDashboard ? ['dashboard' as const] : []),
      ...(canSeeSales ? ['sales' as const] : []),
      ...(canSeeOrders ? ['orders' as const] : []),
      ...(canSeeKitchen ? ['kitchen' as const] : []),
      ...(canSeeFloor ? ['floor' as const] : []),
      ...(canSeeCustomers ? ['customers' as const] : []),
      ...(canSeeDeliveries ? ['deliveries' as const] : []),
      ...(canSeeChecker ? ['time-clock' as const] : []),
      ...(canSeeCashier ? ['cashier' as const] : []),
      ...(canSeeShiftHistory ? ['shift-history' as const] : []),
      ...(canSeeProducts ? ['products' as const] : []),
      ...(canSeeEmployees ? ['employees' as const] : []),
      ...(canSeePrinting ? ['printing' as const] : []),
      ...(canSeeSettings ? ['settings' as const] : []),
    ];
    if (!allowed.includes(currentScreen)) setCurrentScreen(allowed[0] ?? 'floor');
  }, [user, currentScreen, canSeeDashboard, canSeeSales, canSeeOrders, canSeeKitchen, canSeeFloor, canSeeCustomers, canSeeDeliveries, canSeeChecker, canSeeCashier, canSeeShiftHistory, canSeeProducts, canSeeEmployees, canSeePrinting, canSeeSettings]);

  useRealtimeInvalidation(!!user);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    void setDesktopSessionToken(token ?? null);
  }, [token]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    const applyZoom = (f: number) => {
      const sf = Math.min(1.5, Math.max(0.8, Number(f.toFixed(2))));
      setDesktopZoomFactor(sf);
      localStorage.setItem('fatboy-desktop-zoom', sf.toString());
    };
    const saved = Number(localStorage.getItem('fatboy-desktop-zoom') ?? '');
    if (Number.isFinite(saved) && saved > 0) applyZoom(saved);
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveShift().catch(() => undefined);
      getSettings().then(data => {
        setSettings({ ...data, themePreset: resolveThemePresetFromSettings(data) });
      }).catch(err => console.error(err));
    }
  }, [user, setSettings, checkActiveShift]);

  useEffect(() => {
    const r = themePreset || resolveThemePresetFromSettings({ accentColor, panelColor, paperColor, inkColor });
    applyThemePreset(r);
  }, [accentColor, inkColor, paperColor, panelColor, themePreset]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuRef]);

  const handleLogout = () => { setIsUserMenuOpen(false); setIsNavVisible(false); logout(); setCurrentScreen('dashboard'); };
  const handleBottomNavSelect = (s: Screen) => { setCurrentScreen(s); setIsNavVisible(false); };
  const businessName = restaurantName?.trim() || 'FATBOY POS';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <DashboardScreen />;
      case 'sales': return <SalesScreen onPay={() => setIsPaymentModalOpen(true)} onRequireShift={() => setCurrentScreen('cashier')} isParentModalOpen={isPaymentModalOpen} />;
      case 'floor': return <FloorPlanScreen />;
      case 'kitchen': return <KitchenScreen />;
      case 'customers': return <CustomersScreen />;
      case 'orders': return <OrdersScreen />;
      case 'cashier': return <CashierScreen />;
      case 'shift-history': return <ShiftHistoryScreen />;
      case 'time-clock': return <DigitalTimeClockScreen />;
      case 'settings': return <SettingsScreen />;
      case 'printing': return <PrintingCenterScreen />;
      case 'products': return <ProductsScreen />;
      case 'deliveries': return <DeliveriesScreen />;
      case 'employees': return <EmployeesHubScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <>
      <Toaster position="bottom-left" theme="dark" richColors toastOptions={{ className: 'border border-white/5 bg-[#0a0a0a] text-[11px]' }} />
      <ChangeOverlay />

      {(() => {
        if (isTabletSurface) return <TabletShell />;
        if (isKitchenSurface) return <KitchenShell />;
        if (!user) return <LoginScreen />;

        return (
          <div className="h-screen flex flex-col bg-[#070707] overflow-hidden font-body text-on-surface">
            {/* Top Command Center */}
            <header className="z-50 flex h-9 items-center border-b border-white/10 bg-[#000000]">
              <div 
                onClick={() => setCurrentScreen('dashboard')}
                className="group flex h-full items-center cursor-pointer border-r border-white/5 bg-[#111111] px-4 hover:bg-primary/5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Wallet className="w-4 h-4" /> {/* 'Saco de dinero' representation */}
                  </div>
                  <h1 className="whitespace-nowrap font-headline text-[13px] font-black uppercase tracking-tight text-white">
                    {businessName}
                  </h1>
                </div>
              </div>
              
              <div className="flex flex-1 overflow-hidden h-full">
                <nav className="flex h-full overflow-x-auto no-scrollbar items-stretch">
                  {canSeeSales && <NavButton active={currentScreen === 'sales'} onClick={() => setCurrentScreen('sales')} icon={<Calculator className="w-3.5 h-3.5" />} label="Ventas" />}
                  {canSeeOrders && <NavButton active={currentScreen === 'orders'} onClick={() => setCurrentScreen('orders')} icon={<ReceiptText className="w-3.5 h-3.5" />} label="Pedidos" />}
                  {canSeeKitchen && <NavButton active={currentScreen === 'kitchen'} onClick={() => setCurrentScreen('kitchen')} icon={<UtensilsCrossed className="w-3.5 h-3.5" />} label="Cocina" />}
                  {canSeeFloor && <NavButton active={currentScreen === 'floor'} onClick={() => setCurrentScreen('floor')} icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Mesas" />}
                  {canSeeCustomers && <NavButton active={currentScreen === 'customers'} onClick={() => setCurrentScreen('customers')} icon={<Users className="w-3.5 h-3.5" />} label="Clientes" />}
                  {canSeeChecker && <NavButton active={currentScreen === 'time-clock'} onClick={() => setCurrentScreen('time-clock')} icon={<Clock3 className="w-3.5 h-3.5" />} label="Asistencia" />}
                </nav>
              </div>

              <div className="flex h-full items-center gap-0.5 border-l border-white/5 pr-1.5 px-3 bg-[#0a0a0a] relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 h-full hover:bg-white/5 px-2 transition-colors relative"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black uppercase text-white/90 leading-none">{user.name}</span>
                    <span className="text-[7px] font-bold uppercase text-primary tracking-widest leading-none mt-1">{user.role}</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border border-primary/30 flex items-center justify-center overflow-hidden">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full right-2 mt-1 w-40 bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-[2px] overflow-hidden z-[100]"
                    >
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Cerrar Sesión
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            {/* Main Center Area */}
            <main className="flex-1 relative overflow-hidden bg-[#070707]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full w-full flex flex-col"
                >
                  <div className="flex-1 min-h-0 bg-[#070707] relative overflow-hidden flex flex-col">
                    <ErrorBoundary fallback={<div className="h-full flex items-center justify-center text-error font-headline uppercase text-[9px] font-black tracking-widest">ERROR</div>}>
                      <Suspense fallback={<ScreenLoader />}>
                        {renderScreen()}
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Bottom Integrated Strip */}
            <div className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none pb-2">
              <motion.button 
                onClick={() => setIsNavVisible(!isNavVisible)}
                className={cn(
                  "h-6 px-6 flex items-center justify-center rounded-t-[2px] border-t border-l border-r pointer-events-auto transition-all shadow-lg",
                  isNavVisible 
                    ? "bg-primary text-black border-primary" 
                    : "bg-black/20 backdrop-blur-md border-white/10 text-outline/60 hover:text-white hover:bg-black/40"
                )}
              >
                <div className="flex items-center gap-2">
                  {isNavVisible ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 group-hover:animate-bounce" />}
                  <span className="text-[8px] font-black uppercase tracking-[0.4em]">Panel Maestro</span>
                </div>
              </motion.button>
              
              <AnimatePresence>
                {isNavVisible && (
                  <motion.footer 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "tween", duration: 0.2 }}
                    className="h-12 bg-[#000000] w-[95%] max-w-5xl flex justify-around items-stretch shadow-2xl pointer-events-auto border border-white/10 rounded-[4px] relative z-[101]"
                  >
                    {canSeeDashboard && <BottomNavButton active={currentScreen === 'dashboard'} onClick={() => handleBottomNavSelect('dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Inicio" />}
                    {canSeeCashier && <BottomNavButton active={currentScreen === 'cashier'} onClick={() => handleBottomNavSelect('cashier')} icon={<ShoppingCart className="w-4 h-4" />} label="Caja" />}
                    {canSeeShiftHistory && <BottomNavButton active={currentScreen === 'shift-history'} onClick={() => handleBottomNavSelect('shift-history')} icon={<History className="w-4 h-4" />} label="Cortes" />}
                    {canSeeProducts && <BottomNavButton active={currentScreen === 'products'} onClick={() => handleBottomNavSelect('products')} icon={<Package className="w-4 h-4" />} label="Productos" />}
                    {canSeeEmployees && <BottomNavButton active={currentScreen === 'employees'} onClick={() => handleBottomNavSelect('employees')} icon={<BadgeCheck className="w-4 h-4" />} label="Staff" />}
                    {canSeeChecker && <BottomNavButton active={currentScreen === 'time-clock'} onClick={() => handleBottomNavSelect('time-clock')} icon={<Clock3 className="w-4 h-4" />} label="Reloj" />}
                    {canSeePrinting && <BottomNavButton active={currentScreen === 'printing'} onClick={() => handleBottomNavSelect('printing')} icon={<Printer className="w-4 h-4" />} label="Impresión" />}
                    {canSeeSettings && <BottomNavButton active={currentScreen === 'settings'} onClick={() => handleBottomNavSelect('settings')} icon={<SettingsIcon className="w-4 h-4" />} label="Ajustes" />}
                  </motion.footer>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })()}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <PaymentModal 
            total={getTotal()} 
            onClose={() => setIsPaymentModalOpen(false)}
            onRequireShift={() => setCurrentScreen('cashier')}
          />
        )}
      </AnimatePresence>
    </>
  );
}
