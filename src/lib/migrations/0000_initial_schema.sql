CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo text,
  phone text,
  email text,
  address text,
  maps_url text,
  welcome_message text,
  famous_dish text,
  photos jsonb DEFAULT '[]'::jsonb,
  payment_method text DEFAULT 'Till number',
  payment_number text,
  table_count integer DEFAULT 12,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  staff_code text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  passport_photo text,
  phone text,
  email text,
  password_hash text NOT NULL,
  salary integer,
  salary_payments jsonb DEFAULT '{}'::jsonb,
  orders_taken integer DEFAULT 0,
  revenue_generated integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  image text,
  images jsonb DEFAULT '[]'::jsonb,
  specifications jsonb DEFAULT '[]'::jsonb,
  category text NOT NULL,
  meal_period text NOT NULL,
  price integer NOT NULL,
  available boolean DEFAULT true,
  order_count integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  order_number text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  table_number integer NOT NULL,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  total integer NOT NULL DEFAULT 0,
  bill_requested boolean DEFAULT false,
  waiter_called boolean DEFAULT false,
  payment_status text DEFAULT 'unpaid',
  invoice_number text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  item_id uuid,
  item_name text NOT NULL,
  quantity integer NOT NULL,
  price integer NOT NULL,
  specification text,
  created_at timestamp DEFAULT now()
);
