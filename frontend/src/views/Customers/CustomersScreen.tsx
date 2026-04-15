import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
  History,
  Info,
  Timer,
  ReceiptText,
  X,
  Users,
  Loader2,
  Coins,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCustomer,
  getCustomerById,
  getCustomerLoyalty,
  getCustomerOrders,
  getCustomers,
  updateCustomer,
} from '../../services/api';
import { toast } from 'sonner';

export function CustomersScreen() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () => getCustomers(searchTerm),
  });

  useEffect(() => {
    if (customers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }

    if (!selectedCustomerId || !customers.some((customer: any) => customer.id.toString() === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id.toString());
    }
  }, [customers, selectedCustomerId]);

  return (
    <div className="h-full flex bg-surface overflow-hidden relative">
      <div className="w-64 border-r border-outline-variant/10 flex flex-col bg-surface-container-low">
        <div className="p-2 border-b border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-headline text-base font-black text-white tracking-tighter uppercase">Clientes</h2>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-outline">
                {customers.length} registro{customers.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-2 py-1 bg-primary text-on-primary hover:bg-primary-container transition-all active:scale-95 text-[8px] font-black uppercase tracking-widest"
            >
              <span className="inline-flex items-center gap-1"><UserPlus className="w-3 h-3" /> Nuevo</span>
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-outline" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant/20 py-1.5 pl-7 pr-2 text-[10px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold uppercase"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : (
            customers.map((customer: any) => (
              <button
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id.toString());
                  setIsAddingNew(false);
                }}
                className={cn(
                  'w-full p-2 flex flex-col gap-1 border-b border-outline-variant/5 transition-all text-left',
                  selectedCustomerId === customer.id.toString() && !isAddingNew
                    ? 'bg-primary/10 border-l-4 border-l-primary'
                    : 'hover:bg-surface-container-high',
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="font-headline font-bold text-on-surface text-[11px] uppercase tracking-tight truncate max-w-[150px]">{customer.name}</span>
                  <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5">{customer.loyaltyAccount?.points ?? 0} pts</span>
                </div>
                <span className="text-[8px] text-outline font-medium">{customer.phone || 'Sin telefono'}</span>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[7px] text-outline-variant uppercase font-bold tracking-widest">Pedidos</span>
                  <span className="text-[9px] font-black text-on-surface">{customer._count?.orders ?? 0}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
        {selectedCustomerId ? (
          <CustomerDetails customerId={selectedCustomerId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-outline gap-3">
            <Users className="w-12 h-12 opacity-10" />
            <p className="font-headline font-bold uppercase tracking-widest text-[10px] opacity-30">Selecciona un cliente para ver detalles</p>
          </div>
        )}
      </div>

      {isAddingNew && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAddingNew(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden"
          >
            <CustomerForm
              onCancel={() => setIsAddingNew(false)}
              onSuccess={() => {
                setIsAddingNew(false);
                queryClient.invalidateQueries({ queryKey: ['customers'] });
              }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function CustomerDetails({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: () => getCustomerOrders(customerId),
    enabled: !!customerId,
  });

  const { data: loyalty, isLoading: loadingLoyalty } = useQuery({
    queryKey: ['customer-loyalty', customerId],
    queryFn: () => getCustomerLoyalty(customerId),
    enabled: !!customerId,
  });

  const lastVisit = orders[0]?.createdAt ?? customer?.recentOrders?.[0]?.createdAt ?? null;
  const totalSpent = useMemo(
    () => orders.reduce((sum: number, order: any) => sum + getOrderTotal(order), 0),
    [orders],
  );
  const primaryAddress = customer?.addresses?.[0] ?? null;
  const isLoading = loadingCustomer || loadingOrders || loadingLoyalty;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 flex items-center justify-center text-outline">
        <p className="font-headline font-bold uppercase tracking-widest text-[10px] opacity-40">No se pudo cargar el cliente</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-2.5 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 bg-surface-container-highest flex items-center justify-center text-base font-headline font-black text-primary border border-primary/20 shadow-lg">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-tighter font-headline uppercase leading-none mb-0">{customer.name}</h1>
            <div className="flex gap-1">
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[7px] font-bold uppercase tracking-widest border border-primary/20">CLIENTE</span>
              <span className="px-1.5 py-0.5 bg-surface-container-highest text-outline text-[7px] font-bold uppercase tracking-widest border border-outline-variant/10">#{customer.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button className="p-1 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10">
            <History className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-surface-container-low p-2 border-l-2 border-primary">
          <span className="block text-[7px] font-bold text-outline uppercase tracking-widest mb-0.5">Puntos</span>
          <span className="text-sm font-headline font-black text-primary">{loyalty?.points ?? 0}</span>
        </div>
        <div className="bg-surface-container-low p-2 border-l-2 border-primary">
          <span className="block text-[7px] font-bold text-outline uppercase tracking-widest mb-0.5">Gasto Total</span>
          <span className="text-sm font-headline font-black text-on-surface">${totalSpent.toFixed(0)}</span>
        </div>
        <div className="bg-surface-container-low p-2 border-l-2 border-primary">
          <span className="block text-[7px] font-bold text-outline uppercase tracking-widest mb-0.5">Ultima Visita</span>
          <span className="text-sm font-headline font-black text-on-surface">{lastVisit ? new Date(lastVisit).toLocaleDateString() : 'N/A'}</span>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(18rem,0.9fr)_minmax(22rem,1.1fr)] gap-3">
        <div className="space-y-2">
          <section>
            <h3 className="text-[8px] font-bold text-outline uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1">
              <Info className="w-2 h-2" /> Informacion de Contacto
            </h3>
            <div className="bg-surface-container-low p-2 space-y-1.5 border border-outline-variant/5">
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-1">
                <span className="text-[7px] font-bold text-outline uppercase">Telefono</span>
                <span className="text-[9px] font-medium text-on-surface truncate max-w-[120px]">{customer.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-1">
                <span className="text-[7px] font-bold text-outline uppercase">Direcciones</span>
                <span className="text-[9px] font-medium text-on-surface">{customer._count?.addresses ?? 0}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-[7px] font-bold text-outline uppercase mt-0.5">Principal</span>
                <span className="text-[9px] font-medium text-on-surface text-right max-w-[170px]">
                  {primaryAddress ? formatAddress(primaryAddress) : 'Sin direccion'}
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[8px] font-bold text-outline uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1">
              <Timer className="w-2 h-2" /> Notas Internas
            </h3>
            <div className="bg-surface-container-low p-2 border border-outline-variant/5 min-h-[40px]">
              <p className="text-[9px] text-outline-variant italic leading-tight">
                {customer.notes || 'No hay notas adicionales para este cliente.'}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-[8px] font-bold text-outline uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1">
              <Coins className="w-2 h-2" /> Movimientos de Puntos
            </h3>
            <div className="bg-surface-container-low overflow-hidden border border-outline-variant/5">
              {!loyalty?.transactions?.length ? (
                <p className="p-4 text-[8px] text-outline uppercase text-center font-bold">Sin movimientos</p>
              ) : (
                loyalty.transactions.map((transaction: any) => (
                  <div key={transaction.id} className="p-1.5 border-b border-outline-variant/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[8px] font-black text-on-surface uppercase truncate">
                          {transaction.description || (transaction.type === 'EARN' ? 'Generacion de puntos' : 'Canje de puntos')}
                        </div>
                        <div className="text-[7px] text-outline">
                          {new Date(transaction.createdAt).toLocaleString()}
                          {transaction.order?.orderNumber ? ` · ${transaction.order.orderNumber}` : ''}
                        </div>
                      </div>
                      <div className={cn('text-[10px] font-black', transaction.points >= 0 ? 'text-primary' : 'text-red-400')}>
                        {transaction.points >= 0 ? '+' : ''}
                        {transaction.points}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="min-h-0">
          <h3 className="text-[8px] font-bold text-outline uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1">
            <ReceiptText className="w-2 h-2" /> Historial de Pedidos
          </h3>
          <div className="h-full bg-surface-container-low overflow-hidden border border-outline-variant/5">
            {!orders.length ? (
              <p className="p-4 text-[8px] text-outline uppercase text-center font-bold">Sin historial</p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                {orders.map((order: any) => (
                <div key={order.id} className="p-2 flex items-center justify-between border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 bg-surface-container-highest flex items-center justify-center shrink-0">
                      <ReceiptText className="w-2 h-2 text-outline" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold text-on-surface truncate">{order.orderNumber || `#${order.id}`}</span>
                      <span className="text-[8px] text-outline">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-[11px] font-black text-on-surface">${getOrderTotal(order).toFixed(2)}</span>
                    <span className="text-[7px] font-bold uppercase tracking-widest text-outline">{order.status}</span>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsEditing(false)}
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden"
          >
            <CustomerEditForm
              customer={customer}
              onCancel={() => setIsEditing(false)}
              onSuccess={() => {
                setIsEditing(false);
                queryClient.invalidateQueries({ queryKey: ['customers'] });
                queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
                queryClient.invalidateQueries({ queryKey: ['customer-orders', customerId] });
                queryClient.invalidateQueries({ queryKey: ['customer-loyalty', customerId] });
              }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function getOrderTotal(order: any) {
  const itemsTotal = (order.items || []).reduce((sum: number, item: any) => {
    const modifierTotal = (item.modifiers || []).reduce(
      (modifierSum: number, modifier: any) => modifierSum + Number(modifier.price || 0),
      0,
    );
    return sum + (Number(item.price || 0) + modifierTotal) * Number(item.quantity || 0);
  }, 0);

  const discountTotal = (order.discounts || []).reduce(
    (sum: number, discount: any) => sum + Number(discount.amount || 0),
    0,
  );

  return Math.max(0, itemsTotal - discountTotal);
}

function formatAddress(address: any) {
  return [
    address.street,
    address.exteriorNumber,
    address.interiorNumber,
    address.neighborhood,
    address.city,
    address.state,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}

function CustomerForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      toast.success('Cliente registrado con exito');
      onSuccess();
    },
    onError: () => toast.error('Error al registrar cliente'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const address = String(formData.get('address') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const data = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      notes,
      addresses: address
        ? [
            {
              street: address,
              isDefault: true,
            },
          ]
        : [],
    };
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col p-3 overflow-y-auto custom-scrollbar max-h-[85vh]">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-sm font-black text-white tracking-tighter font-headline uppercase leading-none mb-0">Nuevo Cliente</h1>
          <p className="text-outline font-label tracking-widest uppercase text-[6px]">Registrar en base de datos</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Nombre Completo</label>
            <input
              name="name"
              required
              type="text"
              placeholder="Ej. Juan Perez"
              className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold uppercase"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Telefono</label>
            <input
              name="phone"
              required
              type="tel"
              placeholder="+1 555-0000"
              className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold uppercase"
            />
          </div>
        </div>

        <div className="space-y-0.5">
          <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Direccion (Opcional)</label>
          <textarea
            name="address"
            placeholder="Calle, Numero, Ciudad..."
            rows={2}
            className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none font-bold uppercase"
          ></textarea>
        </div>

        <div className="space-y-0.5">
          <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Notas Internas</label>
          <textarea
            name="notes"
            placeholder="Preferencias, alergias, etc..."
            rows={2}
            className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none font-bold uppercase"
          ></textarea>
        </div>

        <div className="flex gap-1.5 pt-1">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 bg-primary text-on-primary font-headline font-black uppercase tracking-widest py-1.5 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all text-[9px] disabled:opacity-50"
          >
            {createMutation.isPending ? 'Guardando...' : 'Guardar Cliente'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest py-1.5 hover:text-white transition-all active:scale-[0.98] text-[9px]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

function CustomerEditForm({
  customer,
  onCancel,
  onSuccess,
}: {
  customer: any;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const primaryAddress = customer.addresses?.[0] ?? null;
  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; phone: string; notes: string }) =>
      updateCustomer(customer.id, payload),
    onSuccess: () => {
      toast.success('Cliente actualizado con exito');
      onSuccess();
    },
    onError: () => toast.error('No se pudo actualizar el cliente'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    updateMutation.mutate({
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col p-3 overflow-y-auto custom-scrollbar max-h-[85vh]">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-sm font-black text-white tracking-tighter font-headline uppercase leading-none mb-0">Editar Cliente</h1>
          <p className="text-outline font-label tracking-widest uppercase text-[6px]">Actualizar informacion basica</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 bg-surface-container-highest text-outline hover:text-white transition-all active:scale-95 border border-outline-variant/10"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Nombre Completo</label>
            <input
              name="name"
              required
              defaultValue={customer.name || ''}
              type="text"
              className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold uppercase"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Telefono</label>
            <input
              name="phone"
              defaultValue={customer.phone || ''}
              type="tel"
              className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-bold uppercase"
            />
          </div>
        </div>

        <div className="space-y-0.5">
          <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Direccion Principal</label>
          <textarea
            disabled
            defaultValue={primaryAddress ? formatAddress(primaryAddress) : 'Sin direccion configurada'}
            rows={2}
            className="w-full bg-surface-container-highest border border-outline-variant/20 p-1.5 text-[9px] text-outline focus:outline-none resize-none font-bold uppercase disabled:opacity-80"
          ></textarea>
        </div>

        <div className="space-y-0.5">
          <label className="text-[6px] font-bold text-outline uppercase tracking-widest ml-1">Notas Internas</label>
          <textarea
            name="notes"
            defaultValue={customer.notes || ''}
            rows={3}
            className="w-full bg-surface-container-low border border-outline-variant/20 p-1.5 text-[9px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all resize-none font-bold uppercase"
          ></textarea>
        </div>

        <div className="flex gap-1.5 pt-1">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 bg-primary text-on-primary font-headline font-black uppercase tracking-widest py-1.5 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all text-[9px] disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest py-1.5 hover:text-white transition-all active:scale-[0.98] text-[9px]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
