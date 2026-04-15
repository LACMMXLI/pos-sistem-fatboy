import { buildEscPosReceipt } from './escpos-builder.util';

describe('buildEscPosReceipt', () => {
  it('creates raw ESC/POS bytes for a client ticket', () => {
    const payload = buildEscPosReceipt({
      type: 'CLIENT',
      paperWidth: '80',
      restaurantName: 'Fatboy',
      restaurantAddress: 'Tijuana, BC',
      order: {
        orderNumber: 'ORD-20260401-0001',
        orderType: 'TAKE_AWAY',
        waiter: { name: 'Caja' },
        items: [
          {
            quantity: 2,
            price: 50,
            product: { name: 'Burger' },
            modifiers: [{ name: 'Queso', price: 10 }],
          },
        ],
        subtotal: 120,
        taxAmount: 19.2,
        totalAmount: 139.2,
      },
    });
    const payloadText = payload.toString('ascii');

    expect(payload[0]).toBe(0x1b);
    expect(payload[1]).toBe(0x40);
    expect(payloadText.includes('Fatboy')).toBe(true);
    expect(payloadText.includes('TOTAL')).toBe(true);
  });
});
