ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_session_id text,
  ADD COLUMN IF NOT EXISTS waiter_cancellation_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cook_cancellation_resolved boolean NOT NULL DEFAULT false;
