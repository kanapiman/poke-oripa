# PokeOripa Production Deploy

## Render Web Service

1. Push this repository to GitHub.
2. In Render, create a new Web Service from the GitHub repository.
3. Use these commands:

```bash
npm install && npm run build
npm start
```

4. Add these environment variables in Render:

```bash
NODE_ENV=production
REACT_APP_API_BASE_URL=
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_or_pk_test...
STRIPE_SECRET_KEY=sk_live_or_sk_test...
STRIPE_WEBHOOK_SECRET=whsec_...
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FRONTEND_ORIGIN=https://your-render-domain.onrender.com
```

5. In Supabase Auth URL settings, add the Render URL:

```text
Site URL: https://your-render-domain.onrender.com
Redirect URLs: https://your-render-domain.onrender.com/*
```

6. In Stripe Webhooks, add:

```text
https://your-render-domain.onrender.com/api/webhook
```

Listen for:

```text
payment_intent.succeeded
```

7. Use the HTTPS Render URL for testing checkout.

## Local Development

Run two terminals:

```bash
npm run server
npm run client
```

Open:

```text
http://localhost:3000
```
