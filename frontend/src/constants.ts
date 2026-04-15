import { Product, Table, Customer } from './types';

export const PRODUCTS: Product[] = [
  { id: '1', name: 'NEON BURGER', price: 12.50, category: 'Burgers', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80' },
  { id: '2', name: 'BACON TITAN', price: 14.99, category: 'Burgers', image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=400&q=80' },
  { id: '3', name: 'CYBER FRIES', price: 4.50, category: 'Sides', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80' },
  { id: '4', name: 'GLITCH SHAKE', price: 6.00, category: 'Drinks', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80' },
  { id: '5', name: 'IONIC COLA', price: 3.50, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80' },
  { id: '6', name: 'PULSE WINGS', price: 9.99, category: 'Sides', image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=400&q=80' },
  { id: '7', name: 'VEGGIE CORE', price: 11.20, category: 'Burgers', icon: 'fastfood' },
  { id: '8', name: 'NANO CONE', price: 2.99, category: 'Desserts', icon: 'icecream' },
  { id: '9', name: 'STATIC SLICE', price: 5.50, category: 'Desserts', icon: 'local_pizza' },
];

export const TABLES: Table[] = [
  { id: '01', status: 'available', seats: 4 },
  { id: '02', status: 'occupied', seats: 2, timer: '42m', guests: ['JD', 'MS'] },
  { id: '03', status: 'available', seats: 2 },
  { id: '04', status: 'occupied', seats: 4, timer: '15m' },
  { id: '05', status: 'selected', seats: 4, timer: '28m' },
  { id: '06', status: 'available', seats: 6 },
  { id: '07', status: 'check-requested', seats: 4, timer: '55m' },
  { id: '08', status: 'available', seats: 4 },
];

export const CUSTOMERS: Customer[] = [
  { id: '1', name: 'Alonzo Cardona', email: 'alonzocardona123@gmail.com', phone: '+1 555-0123', loyaltyPoints: 1250, lastVisit: '2026-03-28', totalSpent: 450.25, address: '123 Main St, Springfield' },
  { id: '2', name: 'Maria Garcia', email: 'maria.g@example.com', phone: '+1 555-0456', loyaltyPoints: 850, lastVisit: '2026-03-25', totalSpent: 280.50, address: '456 Oak Ave, Metropolis' },
  { id: '3', name: 'John Smith', email: 'john.smith@example.com', phone: '+1 555-0789', loyaltyPoints: 3200, lastVisit: '2026-03-29', totalSpent: 1200.00, address: '789 Pine Rd, Gotham' },
  { id: '4', name: 'Sarah Wilson', email: 'sarah.w@example.com', phone: '+1 555-0321', loyaltyPoints: 150, lastVisit: '2026-03-15', totalSpent: 45.00, address: '321 Elm St, Smallville' },
  { id: '5', name: 'Robert Brown', email: 'robert.b@example.com', phone: '+1 555-0654', loyaltyPoints: 540, lastVisit: '2026-03-20', totalSpent: 155.75, address: '654 Maple Dr, Star City' },
];

import { Order } from './types';

export const ORDERS: Order[] = [
  {
    id: 'ORD-001',
    staff: 'Alonzo',
    table: '02',
    status: 'done',
    timestamp: '2026-03-30T08:30:00Z',
    type: 'dine-in',
    paymentType: 'card',
    total: 32.50,
    shiftId: 'SHIFT-01',
    items: [
      { ...PRODUCTS[0], quantity: 2 },
      { ...PRODUCTS[2], quantity: 1 }
    ]
  },
  {
    id: 'ORD-002',
    staff: 'Alonzo',
    status: 'done',
    timestamp: '2026-03-30T09:00:00Z',
    type: 'takeaway',
    paymentType: 'cash',
    total: 14.99,
    shiftId: 'SHIFT-01',
    items: [
      { ...PRODUCTS[1], quantity: 1 }
    ]
  },
  {
    id: 'ORD-003',
    staff: 'Maria',
    table: '04',
    status: 'done',
    timestamp: '2026-03-30T09:15:00Z',
    type: 'dine-in',
    paymentType: 'transfer',
    total: 25.40,
    shiftId: 'SHIFT-01',
    items: [
      { ...PRODUCTS[0], quantity: 1 },
      { ...PRODUCTS[5], quantity: 1 },
      { ...PRODUCTS[3], quantity: 1 }
    ]
  },
  {
    id: 'ORD-004',
    staff: 'Alonzo',
    status: 'cancelled',
    timestamp: '2026-03-30T09:20:00Z',
    type: 'takeaway',
    paymentType: 'card',
    total: 6.00,
    shiftId: 'SHIFT-01',
    items: [
      { ...PRODUCTS[3], quantity: 1 }
    ]
  },
  {
    id: 'ORD-005',
    staff: 'Maria',
    table: '07',
    status: 'done',
    timestamp: '2026-03-29T18:30:00Z',
    type: 'dine-in',
    paymentType: 'card',
    total: 45.00,
    shiftId: 'SHIFT-00',
    items: [
      { ...PRODUCTS[1], quantity: 2 },
      { ...PRODUCTS[2], quantity: 2 },
      { ...PRODUCTS[4], quantity: 1 }
    ]
  }
];
