// Stripe client factory. Test-mode keys only: the demo never moves real money.

import Stripe from 'stripe';

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error('STRIPE_SECRET_KEY rejected: test keys only (sk_test_ or rk_test_)');
  }
  return new Stripe(key);
}
