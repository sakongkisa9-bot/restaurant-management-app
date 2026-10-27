ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS installation_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_suspend_if_unpaid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_password_hash text;
