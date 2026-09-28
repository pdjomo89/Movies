import crypto from 'node:crypto';

// Payment methods offered at checkout. Mobile Money is how most of our audience pays.
export const METHODS = {
  mtn_momo: { label: 'MTN Mobile Money', needsPhone: true },
  orange_money: { label: 'Orange Money', needsPhone: true },
  card: { label: 'Visa / Mastercard', needsPhone: false },
};

export class PaymentError extends Error {
  // `code` maps to a translated message (pay_<code>) in server/i18n.js.
  constructor(code = 'failed') {
    super(`Payment failed: ${code}`);
    this.code = code;
  }
}

// Cameroon mobile numbers: 9 digits starting with 6, optionally prefixed by +237 / 237.
export function normalizeCameroonPhone(input) {
  const digits = String(input ?? '').replace(/[\s.-]/g, '').replace(/^(\+?237)/, '');
  return /^6\d{8}$/.test(digits) ? digits : null;
}

export const maskPhone = (phone) => `+237 ${phone.slice(0, 2)}• ••• ${phone.slice(-3)}`;

/**
 * Simulated provider — approves every charge instantly, except numbers ending in
 * 000, which are declined so the failure path can be exercised.
 *
 * To go live, implement the same `charge()` contract against an aggregator such as
 * CinetPay, Flutterwave, Campay or NotchPay. Real Mobile Money is asynchronous
 * (the customer approves a USSD prompt), so a production version should create the
 * order as `pending` and grant entitlements from the provider's webhook instead.
 */
export const simulatedProvider = {
  name: 'simulated',
  async charge({ amount, method, phone }) {
    if (!METHODS[method]) throw new PaymentError('invalid_method');
    if (!Number.isInteger(amount) || amount <= 0) throw new PaymentError('invalid_amount');
    if (METHODS[method].needsPhone && phone.endsWith('000')) {
      throw new PaymentError('declined');
    }
    return { status: 'paid', providerRef: `SIM-${crypto.randomBytes(6).toString('hex').toUpperCase()}` };
  },
};
