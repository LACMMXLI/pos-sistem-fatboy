import React, { Suspense, lazy, useEffect, useState } from 'react';
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
  Printer
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
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="text-[10px] font-bold uppercase tracking-widest text-outline">
        Cargando modulo...
      </div>
    </div>
  );
}

export default function App() {
  const { user, token, logout } = useAuthStore();
  const { getTotal } = useCartStore();
  const { restaurantName, setSettings, accentColor, panelColor, paperColor, inkColor, themePreset } = useSettingsStore();
  const { checkActiveShift } = useShiftStore();
  const canManagePayroll = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(user?.role ?? '');
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(false);

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

    const allowedScreens: Screen[] = [
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

    if (!allowedScreens.includes(currentScreen)) {
      setCurrentScreen(allowedScreens[0] ?? 'floor');
    }
  }, [
    user,
    currentScreen,
    canSeeDashboard,
    canSeeSales,
    canSeeOrders,
    canSeeKitchen,
    canSeeFloor,
    canSeeCustomers,
    canSeeDeliveries,
    canSeeChecker,
    canSeeCashier,
    canSeeShiftHistory,
    canSeeProducts,
    canSeeEmployees,
    canSeePrinting,
    canSeeSettings,
  ]);

  useRealtimeInvalidation(!!user);

  useEffect(() => {
    if (!isDesktopRuntime()) {
      return;
    }

    void setDesktopSessionToken(token ?? null);
  }, [token]);

  useEffect(() => {
    if (!isDesktopRuntime()) {
      return;
    }

    const minZoom = 0.8;
    const maxZoom = 1.5;
    const step = 0.1;

    const clampZoom = (factor: number) =>
      Math.min(maxZoom, Math.max(minZoom, Number(factor.toFixed(2))));

    const applyZoom = (factor: number) => {
      const safeFactor = clampZoom(factor);
      setDesktopZoomFactor(safeFactor);
      localStorage.setItem('fatboy-desktop-zoom', safeFactor.toString());
    };

    const savedZoom = Number(localStorage.getItem('fatboy-desktop-zoom') ?? '');
    if (Number.isFinite(savedZoom) && savedZoom > 0) {
      applyZoom(savedZoom);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      if (event.key === '+' || event.key === '=' || event.key === 'Add') {
        event.preventDefault();
        applyZoom(getDesktopZoomFactor() + step);
        return;
      }

      if (event.key === '-' || event.key === '_' || event.key === 'Subtract') {
        event.preventDefault();
        applyZoom(getDesktopZoomFactor() - step);
        return;
      }

      if (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') {
        event.preventDefault();
        applyZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Settings
  useEffect(() => {
    if (user) {
      checkActiveShift().catch(() => undefined);
      getSettings().then(data => {
        setSettings({
          ...data,
          themePreset: resolveThemePresetFromSettings(data),
        });
      }).catch(err => {
        console.error("Failed to load settings:", err);
      });
    }
  }, [user, setSettings, checkActiveShift]);

  useEffect(() => {
    const resolvedThemePreset =
      themePreset ||
      resolveThemePresetFromSettings({
        accentColor,
        panelColor,
        paperColor,
        inkColor,
      });

    applyThemePreset(resolvedThemePreset);
  }, [accentColor, inkColor, paperColor, panelColor, themePreset]);

  const handleLogout = () => {
    setIsNavVisible(false);
    logout();
    setCurrentScreen('dashboard');
  };

  const handleBottomNavSelect = (screen: Screen) => {
    setCurrentScreen(screen);
    setIsNavVisible(false);
  };

  const businessName = restaurantName?.trim() || 'Mi negocio';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return canSeeDashboard ? <DashboardScreen /> : <FloorPlanScreen />;
      case 'sales': return (
        <SalesScreen
          onPay={() => setIsPaymentModalOpen(true)}
          onRequireShift={() => setCurrentScreen('cashier')}
        />
      );
      case 'floor': return <FloorPlanScreen />;
      case 'kitchen': return canSeeKitchen ? <KitchenScreen /> : <FloorPlanScreen />;
      case 'customers': return canSeeCustomers ? <CustomersScreen /> : <FloorPlanScreen />;
      case 'orders': return canSeeOrders ? <OrdersScreen /> : <FloorPlanScreen />;
      case 'cashier': return canSeeCashier ? <CashierScreen /> : <FloorPlanScreen />;
      case 'shift-history': return canSeeShiftHistory ? <ShiftHistoryScreen /> : <FloorPlanScreen />;
      case 'time-clock': return canSeeChecker ? <DigitalTimeClockScreen /> : <FloorPlanScreen />;
      case 'settings': return canSeeSettings ? <SettingsScreen /> : <FloorPlanScreen />;
      case 'printing': return canSeePrinting ? <PrintingCenterScreen /> : <FloorPlanScreen />;
      case 'products': return canSeeProducts ? <ProductsScreen /> : <FloorPlanScreen />;
      case 'deliveries': return canSeeDeliveries ? <DeliveriesScreen /> : <FloorPlanScreen />;
      case 'employees': return canSeeEmployees ? <EmployeesHubScreen /> : <FloorPlanScreen />;
      default: return canSeeDashboard ? <DashboardScreen /> : <FloorPlanScreen />;
    }
  };

  return (
    <>
      <Toaster
        position="bottom-left"
        theme="dark"
        richColors
        closeButton={false}
        visibleToasts={2}
        expand={false}
        duration={1800}
        toastOptions={{
          className:
            'min-h-0 w-[260px] border border-outline-variant/10 bg-surface-container-low px-2.5 py-2 text-[11px] shadow-lg',
          descriptionClassName: 'text-[10px] opacity-80',
        }}
      />
      
      <ChangeOverlay />

      {(() => {
        if (isTabletSurface) {
          return <TabletShell />;
        }

        if (!user) {
          return <LoginScreen />;
        }

        if (isKitchenSurface) {
          return canSeeKitchen ? <KitchenScreen surfaceMode /> : <FloorPlanScreen />;
        }

        return (
          <div className="h-screen flex flex-col bg-surface overflow-hidden font-body text-on-surface">
            {/* Top Nav Bar */}
            <header className="z-50 flex h-11 items-center border-b border-white/5 bg-surface-container-lowest">
              <button 
                onClick={() => setCurrentScreen('dashboard')}
                className="group flex h-full items-center border-r border-white/5 bg-surface-container-lowest px-3 hover:bg-surface-container-high transition-colors active:scale-95"
              >
                <h1 className="whitespace-nowrap font-headline text-[17px] font-black uppercase tracking-tight text-white transition-colors group-hover:text-primary">
                  {businessName}
                </h1>
              </button>
              
              <div className="flex flex-1 overflow-hidden">
                <nav className="flex h-full overflow-x-auto no-scrollbar">
                  {canSeeSales && (
                    <NavButton 
                      active={currentScreen === 'sales'} 
                      onClick={() => setCurrentScreen('sales')}
                      icon={<Calculator className="w-4 h-4" />}
                      label="Ventas"
                    />
                  )}
                  {canSeeOrders && (
                    <NavButton 
                      active={currentScreen === 'orders'} 
                      onClick={() => setCurrentScreen('orders')}
                      icon={<ReceiptText className="w-4 h-4" />}
                      label="Pedidos"
                    />
                  )}
                  {canSeeKitchen && (
                    <NavButton 
                      active={currentScreen === 'kitchen'} 
                      onClick={() => setCurrentScreen('kitchen')}
                      icon={<UtensilsCrossed className="w-4 h-4" />}
                      label="Cocina"
                    />
                  )}
                  {canSeeFloor && (
                    <NavButton 
                      active={currentScreen === 'floor'} 
                      onClick={() => setCurrentScreen('floor')}
                      icon={<LayoutGrid className="w-4 h-4" />}
                      label="Mesas"
                    />
                  )}
                  {canSeeCustomers && (
                    <NavButton 
                      active={currentScreen === 'customers'} 
                      onClick={() => setCurrentScreen('customers')}
                      icon={<Users className="w-4 h-4" />}
                      label="Clientes"
                    />
                  )}
                  {canSeeDeliveries && (
                    <NavButton 
                      active={currentScreen === 'deliveries'} 
                      onClick={() => setCurrentScreen('deliveries')}
                      icon={<Truck className="w-4 h-4" />}
                      label="Entregas"
                    />
                  )}
                </nav>

                {canSeeChecker && (
                  <div className="ml-2 flex h-full items-center border-l border-outline-variant/10 pl-2">
                    <NavButton 
                      active={currentScreen === 'time-clock'} 
                      onClick={() => setCurrentScreen('time-clock')}
                      icon={<Clock3 className="w-4 h-4" />}
                      label="Checador"
                    />
                  </div>
                )}
              </div>

              <div className="flex h-full items-center gap-2 border-l border-white/5 px-3">
                <span className="border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                  {user.role}
                </span>
                <button className="text-outline hover:text-primary transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                </button>
                <div className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden group">
                  <img 
                    src="/icono.png"
                    alt="Fatboy POS"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full flex flex-col"
                >
                  <div className="flex-1 min-h-0 bg-surface relative overflow-hidden flex flex-col">
                    <ErrorBoundary fallback={<div className="h-full flex items-center justify-center text-error font-headline uppercase text-[10px]">Error al cargar módulo. Reintente.</div>}>
                      <Suspense fallback={<ScreenLoader />}>
                        {renderScreen()}
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Bottom Nav Bar (Collapsible) */}
            <div className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-start pointer-events-none pb-0 pl-4">
              <motion.button 
                onClick={() => setIsNavVisible(!isNavVisible)}
                animate={{
                  y: isNavVisible ? 1 : 0,
                  scale: isNavVisible ? 0.95 : 1
                }}
                className={cn(
                  "h-7 px-4 flex items-center justify-center rounded-t-md border-t border-l border-r pointer-events-auto transition-all shadow-[0_-6px_20px_rgba(0,0,0,0.4)]",
                  isNavVisible
                    ? "bg-surface-container-lowest border-primary/30 text-primary"
                    : "bg-surface-container-high border-outline-variant/20 text-outline hover:border-primary/25 hover:bg-surface-container-highest hover:text-white hover:scale-105"
                )}
              >
                <div className="flex items-center gap-2">
                  <SettingsIcon className={cn("w-3.5 h-3.5", isNavVisible ? "animate-spin-slow" : "")} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] drop-shadow-sm">
                    {isNavVisible ? 'Panel' : 'Administrador'}
                  </span>
                </div>
              </motion.button>
              <AnimatePresence>
                {isNavVisible && (
                  <motion.footer 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    className="h-14 bg-surface-container-lowest w-full flex justify-around items-stretch shadow-[0_-16px_48px_rgba(0,0,0,0.6)] pointer-events-auto border-t border-white/10 relative z-[101]"
                  >
                    {canSeeDashboard && (
                      <BottomNavButton 
                        active={currentScreen === 'dashboard'} 
                        onClick={() => handleBottomNavSelect('dashboard')}
                        icon={<LayoutGrid className="w-4 h-4" />}
                        label="Dashboard"
                      />
                    )}
                    {canSeeCashier && (
                      <BottomNavButton 
                        active={currentScreen === 'cashier'} 
                        onClick={() => handleBottomNavSelect('cashier')}
                        icon={<ShoppingCart className="w-4 h-4" />}
                        label="Caja"
                      />
                    )}
                    {canSeeShiftHistory && (
                      <BottomNavButton 
                        active={currentScreen === 'shift-history'} 
                        onClick={() => handleBottomNavSelect('shift-history')}
                        icon={<WalletCards className="w-4 h-4" />}
                        label="Cortes"
                      />
                    )}
                    {canSeeProducts && (
                      <BottomNavButton 
                        active={currentScreen === 'products'} 
                        onClick={() => handleBottomNavSelect('products')}
                        icon={<Package className="w-4 h-4" />}
                        label="Productos"
                      />
                    )}
                    {canSeeEmployees && (
                      <BottomNavButton 
                        active={currentScreen === 'employees'} 
                        onClick={() => handleBottomNavSelect('employees')}
                        icon={<BadgeCheck className="w-4 h-4" />}
                        label="Empleados"
                      />
                    )}
                    {canSeePrinting && (
                      <BottomNavButton 
                        active={currentScreen === 'printing'} 
                        onClick={() => handleBottomNavSelect('printing')}
                        icon={<Printer className="w-4 h-4" />}
                        label="Impresión"
                      />
                    )}
                    {canSeeSettings && (
                      <BottomNavButton 
                        active={currentScreen === 'settings'} 
                        onClick={() => handleBottomNavSelect('settings')}
                        icon={<SettingsIcon className="w-4 h-4" />}
                        label="Config"
                      />
                    )}
                    <BottomNavButton 
                      active={false} 
                      onClick={handleLogout}
                      icon={<LogOut className="w-4 h-4" />}
                      label="Sesión"
                    />
                  </motion.footer>
                )}
              </AnimatePresence>
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
              {isPaymentModalOpen && (
                <PaymentModal 
                  total={getTotal()} 
                  onClose={() => setIsPaymentModalOpen(false)}
                  onRequireShift={() => setCurrentScreen('cashier')}
                />
              )}
            </AnimatePresence>
          </div>
        );
      })()}
    </>
  );
}
