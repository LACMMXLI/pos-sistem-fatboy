import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  PlusCircle,
  ReceiptText,
  Truck,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import ActionButton from '../../components/ui/ActionButton';
import { ProductVisual } from '../../components/ui/ProductVisual';
import { queryKeys } from '../../lib/queryKeys';
import { getCategoryChipStyle } from '../../lib/categoryChip';
import { cn, formatCurrency } from '../../lib/utils';
import {
  createCustomer,
  createCustomerAddress,
  createOrder,
  createPayment,
  getCategories,
  getCustomerAddresses,
  getCustomersByPhone,
  getOpenOrders,
  getProducts,
  printOrderReceipt,
  updateOrderStatus,
} from '../../services/api';
import { CartItem } from '../../types';

type DeliveryOrder = {
  id: number;
  orderNumber?: string;
  customerName?: string | null;
  customerPhoneSnapshot?: string | null;
  createdAt: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  deliveryAddressSnapshot?: Record<string, any> | null;
  kitchenOrder?: { status: string } | null;
  items: Array<{ id: number; quantity: number; price: number; product?: { name: string } | null }>;
};

type CustomerOption = {
  id: number;
  name: string;
  phone?: string | null;
  addresses?: Array<{
    id: number;
    street?: string | null;
    exteriorNumber?: string | null;
    interiorNumber?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    references?: string | null;
    isDefault?: boolean;
  }>;
};

const fieldClass =
  'w-full bg-surface-container-highest border border-outline-variant/20 p-2 text-[10px] font-bold text-on-surface uppercase focus:border-primary outline-none transition-colors rounded-none';

function labelForStatus(status?: string) {
  return (
    {
      OPEN: 'Capturada',
      IN_PROGRESS: 'En cocina',
      READY: 'Lista para ruta',
      OUT_FOR_DELIVERY: 'Con repartidor',
      DELIVERED: 'Entregada',
      CLOSED: 'Liquidada',
      CANCELLED: 'Cancelada',
    }[status || ''] || status || 'Sin estado'
  );
}

function classForStatus(status?: string) {
  return (
    {
      IN_PROGRESS: 'text-amber-500 border-amber-500/20 bg-amber-500/10',
      READY: 'text-sky-400 border-sky-400/20 bg-sky-400/10',
      OUT_FOR_DELIVERY: 'text-primary border-primary/20 bg-primary/10',
      DELIVERED: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
      CLOSED: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
      CANCELLED: 'text-error border-error/20 bg-error/10',
    }[status || ''] || 'text-outline border-outline-variant/20 bg-surface-container-highest'
  );
}

function addressText(order?: DeliveryOrder | null) {
  const a = order?.deliveryAddressSnapshot;
  if (!a) return 'Sin direccion';
  return [a.street, a.exteriorNumber, a.interiorNumber, a.neighborhood, a.city, a.state, a.references]
    .filter(Boolean)
    .join(', ');
}

const DELIVERY_DRIVER_LABEL = 'Repartidor en turno';

export function DeliveriesScreen() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [references, setReferences] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState('');

  const { data: deliveries = [], isLoading } = useQuery<DeliveryOrder[]>({
    queryKey: queryKeys.deliveries,
    queryFn: () => getOpenOrders('DELIVERY'),
    refetchInterval: 15000,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: products = [] } = useQuery({
    queryKey: ['products', activeCategoryId],
    queryFn: () => getProducts(activeCategoryId === 'all' ? undefined : activeCategoryId),
  });
  const { data: customerMatches = [] } = useQuery<CustomerOption[]>({
    queryKey: ['delivery-customers-by-phone', phone],
    queryFn: () => getCustomersByPhone(phone),
    enabled: isCreating && phone.trim().length >= 3,
  });
  const { data: customerAddresses = [] } = useQuery<any[]>({
    queryKey: ['delivery-customer-addresses', selectedCustomerId],
    queryFn: () => getCustomerAddresses(selectedCustomerId!),
    enabled: isCreating && !!selectedCustomerId,
  });

  const selected = useMemo(
    () => deliveries.find((delivery) => delivery.id === selectedId) ?? null,
    [deliveries, selectedId],
  );
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const queueReceiptPrint = (
    orderId: number,
    payload: { type: 'CLIENT' | 'KITCHEN' },
    fallbackMessage: string,
  ) => {
    void printOrderReceipt(orderId, payload)
      .then(() => undefined)
      .catch((error: any) => {
        toast.error(error?.response?.data?.message || error?.message || fallbackMessage);
      });
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setStreet('');
    setReferences('');
    setItems([]);
    setSelectedCustomerId(null);
    setSelectedAddressId(null);
  };

  const applyAddress = (address: any) => {
    setSelectedAddressId(address?.id ?? null);
    setStreet(
      [
        address?.street,
        address?.exteriorNumber,
        address?.interiorNumber,
        address?.neighborhood,
        address?.city,
        address?.state,
      ]
        .filter(Boolean)
        .join(', '),
    );
    setReferences(address?.references ?? '');
  };

  const selectCustomer = (customer: CustomerOption) => {
    setSelectedCustomerId(customer.id);
    setName(customer.name ?? '');
    setPhone(customer.phone ?? '');
    const defaultAddress =
      customer.addresses?.find((address) => address.isDefault) ?? customer.addresses?.[0];
    if (defaultAddress) {
      applyAddress(defaultAddress);
    }
  };

  const addProduct = (product: any) => {
    setItems((current) => {
      const id = String(product.id);
      const existing = current.find((item) => String(item.id) === id);
      if (existing) {
        return current.map((item) =>
          String(item.id) === id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        {
          id,
          name: product.name,
          price: Number(product.price),
          category: product.category?.name ?? '',
          image: product.imageUrl,
          quantity: 1,
          modifiers: [],
        },
      ];
    });
  };

  const bumpQty = (id: string, delta: number) => {
    setItems((current) =>
      current
        .map((item) => (String(item.id) === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries });
    queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
    queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
    queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Captura el nombre del cliente');
      if (!phone.trim()) throw new Error('Captura el telefono del cliente');
      if (!street.trim()) throw new Error('Captura el domicilio');
      if (items.length === 0) throw new Error('Agrega productos al pedido');

      let customerId = selectedCustomerId ?? undefined;
      let customerAddressId = selectedAddressId ?? undefined;

      if (!customerId) {
        const createdCustomer = await createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          addresses: [
            {
              street: street.trim(),
              references: references.trim() || null,
              isDefault: true,
            },
          ],
        });

        customerId = createdCustomer.id;
        customerAddressId = createdCustomer.addresses?.[0]?.id;
      } else if (!customerAddressId) {
        const createdAddress = await createCustomerAddress(customerId, {
          street: street.trim(),
          references: references.trim() || null,
          isDefault: false,
        });

        customerAddressId = createdAddress.id;
      }

      return createOrder({
        orderType: 'DELIVERY',
        customerId,
        customerAddressId,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        deliveryAddress: undefined,
        items: items.map((item) => ({
          productId: Number(item.id),
          quantity: item.quantity,
          selectedModifierIds: [],
        })),
      });
    },
    onSuccess: (order: DeliveryOrder) => {
      queueReceiptPrint(
        order.id,
        { type: 'KITCHEN' },
        'No se pudo imprimir la comanda de cocina',
      );
      invalidate();
      setSelectedId(order.id);
      setIsCreating(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo crear el pedido');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateOrderStatus(id, { status }),
    onSuccess: () => {
      toast.success('Estado actualizado');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo actualizar el estado');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (order: DeliveryOrder) => {
      const received = Number(receivedAmount);
      if (!receivedAmount.trim() || Number.isNaN(received)) {
        throw new Error('Captura el monto recibido');
      }
      return createPayment({
        orderId: order.id,
        paymentMethod,
        amount: Number(order.remainingAmount ?? 0),
        receivedAmount: received,
      });
    },
    onSuccess: (_payment, order) => {
      queueReceiptPrint(
        order.id,
        { type: 'CLIENT' },
        'No se pudo imprimir el ticket del cliente',
      );
      setReceivedAmount('');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago');
    },
  });

  const canSend = selected?.status === 'READY';
  const canDeliver = selected?.status === 'OUT_FOR_DELIVERY';
  const canLiquidate = selected?.status === 'DELIVERED' && Number(selected.remainingAmount ?? 0) > 0;

  const printPreAccount = (order: DeliveryOrder) => {
    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      toast.error('No se pudo abrir la ventana de impresion');
      return;
    }

    const itemsHtml = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.quantity}x</td>
            <td>${item.product?.name || 'Producto'}</td>
            <td style="text-align:right;">${formatCurrency(Number(item.price) * item.quantity)}</td>
          </tr>`,
      )
      .join('');

    popup.document.write(`
      <html>
        <head>
          <title>Precuenta ${order.orderNumber ?? `#${order.id}`}</title>
          <style>
            body { font-family: monospace; padding: 16px; color: #111; }
            h1, h2, p { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td { padding: 4px 0; border-bottom: 1px dashed #999; }
            .muted { color: #555; font-size: 12px; }
            .total { margin-top: 16px; font-weight: bold; font-size: 18px; text-align: right; }
          </style>
        </head>
        <body>
          <h1>PRECUENTA DELIVERY</h1>
          <p class="muted">${order.orderNumber ?? `#${order.id}`}</p>
          <p><strong>Cliente:</strong> ${order.customerName || 'Cliente'}</p>
          <p><strong>Telefono:</strong> ${order.customerPhoneSnapshot || 'Sin telefono'}</p>
          <p><strong>Domicilio:</strong> ${addressText(order)}</p>
          <p><strong>Repartidor:</strong> ${DELIVERY_DRIVER_LABEL}</p>
          <p><strong>Estatus:</strong> ${labelForStatus(order.status)}</p>
          <table>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="total">TOTAL ${formatCurrency(order.totalAmount)}</div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <>
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-surface-container-lowest p-2 gap-2 overflow-hidden">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-headline font-extrabold text-lg tracking-tight text-on-surface uppercase">
                Servicio a Domicilio
              </h1>
              <p className="text-on-surface-variant text-[9px] mt-0.5 uppercase tracking-widest font-bold">
                Captura, produccion, reparto y liquidacion
              </p>
            </div>
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedId(null);
                resetForm();
              }}
              className="bg-primary text-on-primary font-headline font-bold py-1.5 px-3 flex items-center gap-1.5 active:scale-95 transition-transform text-[10px] uppercase"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Nuevo Pedido
            </button>
          </div>

          <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
            <div className="col-span-12 md:col-span-5 flex flex-col overflow-hidden bg-surface-container-low border border-outline-variant/10">
              <div className="p-2 border-b border-outline-variant/10 bg-surface-container-highest flex justify-between items-center">
                <span className="text-[8px] font-bold text-outline tracking-widest uppercase">Entregas abiertas</span>
                <span className="text-[7px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {isLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : deliveries.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 custom-scrollbar">
                {deliveries.map((delivery) => (
                  <button
                    key={delivery.id}
                    onClick={() => {
                      setSelectedId(delivery.id);
                      setIsCreating(false);
                      setReceivedAmount('');
                    }}
                    className={cn(
                      'w-full p-2 border text-left transition-colors',
                      selectedId === delivery.id
                        ? 'bg-surface-container-high border-primary'
                        : 'bg-surface-container border-outline-variant/10 hover:bg-surface-container-high',
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-tight text-on-surface">
                        {delivery.orderNumber ?? `#${delivery.id}`} - {delivery.customerName || 'Cliente'}
                      </span>
                      <span className="text-[8px] font-bold text-outline">
                        {new Date(delivery.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[8px] text-outline uppercase font-bold mb-1.5">
                      <MapPin className="w-2.5 h-2.5" /> <span className="truncate">{addressText(delivery)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn('text-[7px] font-black uppercase tracking-wider py-0.5 px-1 border', classForStatus(delivery.status))}>
                        {labelForStatus(delivery.status)}
                      </span>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-on-surface">{formatCurrency(delivery.totalAmount)}</div>
                        <div className="text-[7px] font-bold uppercase tracking-widest text-outline">
                          Pendiente {formatCurrency(delivery.remainingAmount)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {!isLoading && deliveries.length === 0 ? (
                  <div className="p-4 text-center text-outline opacity-30 text-[8px] uppercase font-bold tracking-widest">
                    Sin entregas activas
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-span-12 md:col-span-7 flex flex-col overflow-hidden bg-surface-container-low border border-outline-variant/10">
              <div className="p-2.5 border-b border-outline-variant/10 bg-surface-container-highest flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-bold text-on-surface uppercase tracking-widest font-headline">
                  {isCreating ? 'Captura del pedido' : 'Detalle de entrega'}
                </span>
              </div>
              <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                {isCreating ? (
                  <>
                    {customerMatches.length > 0 ? (
                      <div className="bg-surface-container-highest border border-outline-variant/10 p-2 space-y-1">
                        <div className="text-[7px] font-bold uppercase tracking-widest text-outline">
                          Clientes encontrados por telefono
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                          {customerMatches.map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => selectCustomer(customer)}
                              className="w-full text-left p-2 border border-outline-variant/10 bg-surface-container-low hover:bg-surface-container-high transition-colors"
                            >
                              <div className="text-[9px] font-black uppercase text-on-surface">
                                {customer.name}
                              </div>
                              <div className="text-[7px] uppercase tracking-widest text-outline">
                                {customer.phone || 'Sin telefono'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <Field label="Nombre del cliente">
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Perez" className={fieldClass} />
                    </Field>
                    <Field label="Telefono">
                      <input
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setSelectedCustomerId(null);
                          setSelectedAddressId(null);
                        }}
                        placeholder="Ej. 6641234567"
                        className={fieldClass}
                      />
                    </Field>
                    {customerAddresses.length > 0 ? (
                      <Field label="Domicilio guardado">
                        <select
                          value={selectedAddressId ?? ''}
                          onChange={(e) => {
                            const nextId = Number(e.target.value);
                            const nextAddress = customerAddresses.find((address) => address.id === nextId);
                            if (nextAddress) applyAddress(nextAddress);
                          }}
                          className={fieldClass}
                        >
                          <option value="">Selecciona un domicilio</option>
                          {customerAddresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {[address.street, address.neighborhood, address.city].filter(Boolean).join(', ')}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <Field label="Domicilio">
                      <textarea
                        value={street}
                        onChange={(e) => {
                          setStreet(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder="Calle, numero, colonia..."
                        className={`${fieldClass} min-h-[90px] resize-none`}
                      />
                    </Field>
                    <Field label="Referencias">
                      <textarea
                        value={references}
                        onChange={(e) => {
                          setReferences(e.target.value);
                          setSelectedAddressId(null);
                        }}
                        placeholder="Casa azul, tocar dos veces..."
                        className={`${fieldClass} min-h-[70px] resize-none`}
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Metric label="Articulos" value={String(items.reduce((sum, item) => sum + item.quantity, 0)).padStart(2, '0')} />
                      <Metric label="Subtotal" value={formatCurrency(subtotal)} />
                      <Metric label="Modo" value="Cuenta abierta" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <ActionButton variant="secondary" onClick={() => { setIsCreating(false); resetForm(); }} fullWidth>
                        Cancelar
                      </ActionButton>
                      <ActionButton onClick={() => createMutation.mutate()} disabled={createMutation.isPending} fullWidth>
                        {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ReceiptText className="w-3 h-3" />}
                        Crear pedido
                      </ActionButton>
                    </div>
                  </>
                ) : selected ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <InfoCard icon={<Phone className="w-3 h-3" />} title={selected.customerName || 'Cliente'} subtitle={selected.customerPhoneSnapshot || 'Sin telefono'} />
                      <InfoCard icon={<Truck className="w-3 h-3" />} title={labelForStatus(selected.status)} subtitle={DELIVERY_DRIVER_LABEL} />
                    </div>
                    <div className="bg-surface-container-highest p-3 border border-outline-variant/10">
                      <div className="text-[7px] font-bold uppercase text-outline mb-1">Domicilio</div>
                      <div className="text-[10px] font-bold text-on-surface uppercase leading-relaxed flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-error mt-0.5 shrink-0" />
                        <span>{addressText(selected)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Metric label="Total" value={formatCurrency(selected.totalAmount)} />
                      <Metric label="Pagado" value={formatCurrency(selected.paidAmount)} />
                      <Metric label="Pendiente" value={formatCurrency(selected.remainingAmount)} />
                    </div>
                    <ActionButton variant="secondary" onClick={() => printPreAccount(selected)} fullWidth>
                      <ReceiptText className="w-3 h-3" />
                      Imprimir pre-cuenta
                    </ActionButton>
                    {canSend ? (
                      <ActionButton
                        onClick={() => statusMutation.mutate({ id: selected.id, status: 'OUT_FOR_DELIVERY' })}
                        disabled={statusMutation.isPending}
                        fullWidth
                      >
                        {statusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bike className="w-3 h-3" />}
                        Enviar con repartidor
                      </ActionButton>
                    ) : null}
                    {canDeliver ? (
                      <ActionButton
                        variant="secondary"
                        onClick={() => statusMutation.mutate({ id: selected.id, status: 'DELIVERED' })}
                        disabled={statusMutation.isPending}
                        fullWidth
                      >
                        {statusMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Marcar entregada
                      </ActionButton>
                    ) : null}
                    <div className="bg-surface-container-highest border border-outline-variant/10 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.16em] text-on-surface">Liquidacion</h3>
                        <span className="text-[7px] font-bold uppercase tracking-widest text-outline">{selected.paymentStatus}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Metodo de pago">
                          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className={fieldClass} disabled={!canLiquidate}>
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="OTHER">Otro</option>
                          </select>
                        </Field>
                        <Field label="Monto recibido">
                          <input value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} placeholder={String(selected.remainingAmount ?? '')} className={fieldClass} disabled={!canLiquidate} />
                        </Field>
                      </div>
                      <div className="flex items-center justify-between text-[9px] uppercase font-bold">
                        <span className="text-outline">Saldo a liquidar</span>
                        <span className="text-primary">{formatCurrency(selected.remainingAmount)}</span>
                      </div>
                      <ActionButton onClick={() => paymentMutation.mutate(selected)} disabled={!canLiquidate || paymentMutation.isPending} fullWidth>
                        {paymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                        Liquidar cuenta
                      </ActionButton>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center opacity-30">
                    <Truck className="w-12 h-12 mb-2" />
                    <span className="text-[10px] uppercase font-bold tracking-widest font-headline">Selecciona o crea un pedido</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="w-[340px] shrink-0 flex flex-col bg-surface border-l border-outline-variant/10">
          <div className="p-3 border-b border-outline-variant/10 bg-surface-container-low">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[7px] font-bold uppercase tracking-widest text-primary font-headline">
                {isCreating ? 'Nuevo pedido' : selected?.orderNumber ?? 'Detalle'}
              </span>
              <span className="text-[6px] font-bold py-0.5 px-1 bg-error-container/20 text-error border border-error/20 uppercase">A Domicilio</span>
            </div>
            <h2 className="font-headline font-black text-lg text-on-surface uppercase tracking-tight leading-none">
              {isCreating ? 'Carrito de salida' : 'Resumen'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {isCreating ? (
              items.length > 0 ? (
                items.map((item) => (
                  <div key={String(item.id)} className="flex flex-col gap-1 p-2 bg-surface-container-high border border-outline-variant/5">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-1.5">
                        <span className="font-black text-[10px] text-primary">{item.quantity}x</span>
                        <span className="font-bold text-[10px] text-on-surface uppercase tracking-tight">{item.name}</span>
                      </div>
                      <span className="font-bold text-[10px] text-on-surface">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => bumpQty(String(item.id), -1)} className="px-2 py-1 text-[8px] font-black uppercase border border-outline-variant/10 bg-surface-container-highest text-outline">-1</button>
                      <button onClick={() => bumpQty(String(item.id), 1)} className="px-2 py-1 text-[8px] font-black uppercase border border-primary/20 bg-primary/10 text-primary">+1</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-outline/30 uppercase font-headline font-black text-[10px] tracking-widest">Carrito vacio</div>
              )
            ) : selected?.items?.length ? (
              selected.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start p-2 bg-surface-container-high border border-outline-variant/5">
                  <div className="flex gap-1.5">
                    <span className="font-black text-[10px] text-primary">{item.quantity}x</span>
                    <span className="font-bold text-[10px] text-on-surface uppercase tracking-tight">{item.product?.name || 'Producto'}</span>
                  </div>
                  <span className="font-bold text-[10px] text-on-surface">{formatCurrency(Number(item.price) * item.quantity)}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-outline/30 uppercase font-headline font-black text-[10px] tracking-widest">Sin articulos</div>
            )}
            {isCreating ? (
              <button onClick={() => setMenuOpen(true)} className="w-full mt-2 py-3 border border-dashed border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                <PlusCircle className="w-4 h-4" />
                <span className="text-[9px] font-headline font-black uppercase tracking-widest">Agregar producto</span>
              </button>
            ) : null}
          </div>
          <div className="p-3 bg-surface-container-low border-t border-outline-variant/10">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold uppercase text-outline">
                <span>Total</span>
                <span>{formatCurrency(isCreating ? subtotal : selected?.totalAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold uppercase text-outline">
                <span>Pendiente</span>
                <span>{formatCurrency(isCreating ? subtotal : selected?.remainingAmount ?? 0)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4 sm:p-8">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full h-full max-w-6xl max-h-[800px] bg-surface-container-lowest overflow-hidden border border-outline-variant/10 flex flex-col">
              <div className="h-14 flex items-center justify-between px-4 bg-surface-container-low border-b border-white/5">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-black text-on-surface tracking-tighter font-headline uppercase">Catalogo de Productos</h2>
                </div>
                <button onClick={() => setMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-highest hover:bg-error-container/20 hover:text-error transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-surface">
                <div className="flex gap-1 pb-1 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveCategoryId('all')}
                    className={cn(
                      'category-chip min-w-fit whitespace-nowrap active:scale-[0.98]',
                      activeCategoryId === 'all' && 'category-chip-active',
                    )}
                    style={getCategoryChipStyle('all', 'Todos')}
                  >
                    <span className="category-chip-name">Todos</span>
                  </button>
                  {categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id.toString())}
                      className={cn(
                        'category-chip min-w-fit whitespace-nowrap active:scale-[0.98]',
                        activeCategoryId === cat.id.toString() && 'category-chip-active',
                      )}
                      style={getCategoryChipStyle(String(cat.id), cat.name ?? '')}
                    >
                      <span className="category-chip-name">{cat.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-outline-variant/5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 p-1">
                    {products.map((product: any) => (
                      <button key={product.id} onClick={() => addProduct(product)} className="relative group h-20 sm:h-24 bg-surface-container-highest overflow-hidden border border-outline-variant/10 hover:border-primary/50 flex flex-col">
                        <ProductVisual
                          imageUrl={product.imageUrl}
                          icon={product.icon}
                          alt={product.name}
                          className="absolute inset-0 z-0 bg-black"
                          imageClassName="opacity-60 transition-opacity group-hover:opacity-82"
                          emojiClassName="text-5xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
                        <div className="relative z-10 flex-1 p-1.5 flex flex-col justify-between items-center text-center w-full">
                          <span className="mt-0.5 flex min-h-[2.8rem] w-full items-center justify-center text-center font-headline text-[13px] font-black uppercase leading-[1.02] text-white line-clamp-3 sm:min-h-[3.1rem] sm:text-[15px]">{product.name}</span>
                          <span className="text-primary font-black text-[13px]">{formatCurrency(product.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="h-12 w-full mt-1 bg-surface-container-high text-on-surface flex items-center justify-center gap-2 border border-outline-variant/10 uppercase font-headline font-black text-[10px] tracking-widest">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Regresar al resumen
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[7px] font-bold uppercase tracking-widest text-primary mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-low p-2 border-l-4 border-primary shadow-sm">
      <span className="block text-[7px] font-bold text-outline uppercase tracking-widest mb-0.5">{label}</span>
      <span className="text-sm font-headline font-black text-on-surface uppercase">{value}</span>
    </div>
  );
}

function InfoCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="bg-surface-container-highest p-3 border border-outline-variant/10">
      <div className="flex items-center gap-2 mb-2 text-primary">{icon}</div>
      <div className="text-[10px] font-black text-on-surface uppercase tracking-tight">{title}</div>
      <div className="text-[7px] font-bold uppercase tracking-widest text-outline mt-1">{subtitle}</div>
    </div>
  );
}
