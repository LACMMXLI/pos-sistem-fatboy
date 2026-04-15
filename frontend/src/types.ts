export type Screen =
  | 'dashboard'
  | 'sales'
  | 'floor'
  | 'kitchen'
  | 'settings'
  | 'customers'
  | 'orders'
  | 'cashier'
  | 'shift-history'
  | 'time-clock'
  | 'products'
  | 'deliveries'
  | 'employees'
  | 'printing';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  loyaltyPoints: number;
  lastVisit: string;
  totalSpent: number;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  icon?: string;
}

export interface CartItem extends Product {
  quantity: number;
  modifiers?: string[];
}

export interface Order {
  id: string;
  table?: string;
  staff: string;
  items: CartItem[];
  status: 'awaiting' | 'prepping' | 'done' | 'cancelled';
  timestamp: string;
  type: 'dine-in' | 'takeaway';
  paymentType?: 'cash' | 'card' | 'transfer';
  total: number;
  shiftId?: string;
}

export interface Table {
  id: string;
  status: 'available' | 'occupied' | 'selected' | 'check-requested';
  seats: number;
  timer?: string;
  guests?: string[];
  currentOrder?: Order;
}

export interface CashMovement {
  id: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  timestamp: string;
  staff: string;
}

export interface Shift {
  id: string;
  startTime: string;
  endTime?: string;
  staff: string;
  initialCash: number;
  finalCash?: number;
  finalTerminal?: number;
  expectedCash: number;
  expectedTerminal: number;
  status: 'open' | 'closed';
  movements: CashMovement[];
}
