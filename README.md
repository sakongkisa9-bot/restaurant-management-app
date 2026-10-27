This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Restaurant accounts and billing

Before deploying the developer restaurant dashboard, apply
[`0001_restaurant_billing.sql`](./src/lib/migrations/0001_restaurant_billing.sql)
to the PostgreSQL database configured by `DATABASE_URL`. This adds fee, payment-status,
auto-suspension, and admin-password-hash columns to the `restaurants` table.

The developer password is the server-side `DEVELOPER_PASSWORD` constant in
[`src/app/api/developer/login/route.ts`](./src/app/api/developer/login/route.ts).
Change it in code before deployment; it is never sent to the browser. Restaurant admin
passwords are hashed in the database. Developers can set or reset them from the dashboard,
and restaurant admins can change their own password from Restaurant profile.

Payment status is currently managed manually. When auto-suspension is enabled, customer
restaurant access and order creation are blocked until all non-zero installation and monthly
fees are marked paid. Restaurant admins can still sign in while customer access is suspended.
