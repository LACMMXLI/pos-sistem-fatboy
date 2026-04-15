import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSettingsStore } from '@/store/settingsStore';

interface ReceiptProps {
  order: any;
  type: 'CLIENT' | 'KITCHEN';
}

export default function Receipt({ order, type }: ReceiptProps) {
  const isKitchen = type === 'KITCHEN';
  const restaurantName = useSettingsStore((state) => state.restaurantName) || 'Mi negocio';
  const restaurantAddress = useSettingsStore((state) => state.restaurantAddress) || 'Dirección no configurada';
  const orderTypeLabel =
    order.orderType === 'DINE_IN'
      ? 'Comedor'
      : order.orderType === 'DELIVERY'
        ? 'Domicilio'
        : 'Para Llevar';
  const kitchenOrderLabel = order.customerName
    ? `#${order.orderNumber?.split('-').pop()} (${order.customerName})`
    : `#${order.orderNumber?.split('-').pop()}`;

  return (
    <div className="w-[80mm] p-4 bg-white text-black font-mono text-[12px] leading-tight">
      <div className="text-center space-y-1 mb-4">
        {!isKitchen && (
          <>
            <h1 className="text-lg font-black uppercase">{restaurantName}</h1>
            <p className="text-[10px]">{restaurantAddress}</p>
            <div className="border-b border-dashed border-black my-2" />
          </>
        )}
        <h2 className="text-sm font-bold uppercase tracking-widest">
          {isKitchen ? '--- COMANDA DE COCINA ---' : '=== TICKET DE VENTA ==='}
        </h2>
        <p className="text-[10px]">
          {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es })}
        </p>
      </div>

      <div className="space-y-1 mb-4">
        <p><strong>Orden:</strong> {isKitchen ? kitchenOrderLabel : `#${order.orderNumber?.split('-').pop()}`}</p>
        <p><strong>Tipo:</strong> {orderTypeLabel}</p>
        {order.table && <p><strong>Mesa:</strong> {order.table.name}</p>}
        {order.customerName && <p><strong>Cliente:</strong> {order.customerName}</p>}
        <p><strong>Mesero:</strong> {order.waiter?.name || 'Caja'}</p>
      </div>

      <div className="border-b border-dashed border-black my-2" />

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-black">
            <th className="pb-1">Cant.</th>
            <th className="pb-1 px-2">Producto</th>
            {!isKitchen && <th className="pb-1 text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item: any) => (
            <tr key={item.id} className="align-top">
              <td className="pt-2 font-bold">{item.quantity}</td>
              <td className="pt-2 px-2">
                <div className="font-bold uppercase">{item.product?.name || item.name}</div>
                {(item.modifiers ?? []).map((mod: any) => (
                  <div key={mod.id} className="text-[10px] pl-2">+ {mod.name}</div>
                ))}
                {item.notes && <div className="text-[10px] pl-2 italic">** {item.notes}</div>}
              </td>
              {!isKitchen && (
                <td className="pt-2 text-right">
                  {formatCurrency(
                    (Number(item.price) + 
                    (item.modifiers ?? []).reduce((s: number, m: any) => s + Number(m.price), 0)) * 
                    item.quantity
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isKitchen && (
        <>
          <div className="border-t border-dashed border-black mt-4 mb-2" />
          <div className="space-y-1 text-right">
             <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal || 0)}</span>
             </div>
             <div className="flex justify-between">
                <span>Impuestos:</span>
                <span>{formatCurrency(order.taxAmount || 0)}</span>
             </div>
             {order.discountAmount > 0 && (
               <div className="flex justify-between text-rose-600">
                  <span>Descuento:</span>
                  <span>-{formatCurrency(order.discountAmount)}</span>
               </div>
             )}
             <div className="flex justify-between text-lg font-black pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(order.totalAmount || 0)}</span>
             </div>
          </div>

          <div className="mt-6 text-center text-[9px] space-y-1">
             <p>¡Gracias por su preferencia!</p>
             <p>Factura sin validez legal</p>
          </div>
        </>
      )}

      {isKitchen && (
        <div className="mt-4 border-t-2 border-black pt-2 text-center text-[10px] font-black uppercase">
           *** IMPRIMIR PARA DESPACHO ***
        </div>
      )}
    </div>
  );
}

