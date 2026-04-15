type SummaryConfig = {
  taxEnabled: boolean;
  taxRate: number;
};

type SummaryModifier = {
  price: number | string;
};

type SummaryDiscount = {
  amount: number | string;
};

type SummaryPayment = {
  amount: number | string;
};

type SummaryItem = {
  quantity: number;
  price: number | string;
  modifiers?: SummaryModifier[];
};

type SummaryOrder = {
  items: SummaryItem[];
  discounts?: SummaryDiscount[];
  payments?: SummaryPayment[];
};

const roundMoney = (value: number) => Number(Math.round(value * 100) / 100);

export const buildOrderSummary = (
  order: SummaryOrder,
  config: SummaryConfig,
) => {
  const subtotal = order.items.reduce((sum, item) => {
    const unitBase = Number(item.price);
    const modifierUnitTotal = (item.modifiers ?? []).reduce(
      (modifierSum, modifier) => modifierSum + Number(modifier.price),
      0,
    );

    return sum + (unitBase + modifierUnitTotal) * item.quantity;
  }, 0);

  const roundedSubtotal = roundMoney(subtotal);
  const taxAmount = config.taxEnabled ? roundMoney(roundedSubtotal * (config.taxRate / 100)) : 0;
  const discountAmount = (order.discounts ?? []).reduce(
    (sum, discount) => sum + Number(discount.amount),
    0,
  );
  const paidAmount = (order.payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const totalAmount = roundMoney(roundedSubtotal + taxAmount - discountAmount);
  const remainingAmount = Math.max(0, roundMoney(totalAmount - paidAmount));

  return {
    subtotal: roundedSubtotal,
    taxAmount,
    discountAmount: roundMoney(discountAmount),
    paidAmount: roundMoney(paidAmount),
    totalAmount,
    remainingAmount,
  };
};
