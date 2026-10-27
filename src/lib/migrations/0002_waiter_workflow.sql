ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bill_request_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiter_call_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiter_call_reason text,
  ADD COLUMN IF NOT EXISTS waiter_call_details text,
  ADD COLUMN IF NOT EXISTS assigned_waiter_id uuid;
