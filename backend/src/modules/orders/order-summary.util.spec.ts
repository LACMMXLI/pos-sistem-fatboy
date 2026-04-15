import { buildOrderSummary } from './order-summary.util';

describe('buildOrderSummary', () => {
  it('calculates totals from base items, modifiers, discounts and payments', () => {
    const summary = buildOrderSummary(
      {
        items: [
          {
            quantity: 2,
            price: 100,
            modifiers: [{ price: 10 }, { price: 5 }],
          },
        ],
        discounts: [{ amount: 20 }],
        payments: [{ amount: 50 }],
      },
      { taxEnabled: true, taxRate: 10 },
    );

    expect(summary).toEqual({
      subtotal: 230,
      taxAmount: 23,
      discountAmount: 20,
      paidAmount: 50,
      totalAmount: 233,
      remainingAmount: 183,
    });
  });
});
