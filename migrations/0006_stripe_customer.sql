-- Stripe customer id per user, so saved cards (payment methods) persist across
-- subscriptions and one-time top-ups.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
