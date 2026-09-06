# Unhingedly

A storefront site for Unhingedly — digital planners, templates, and guides
for ADHD brains. Deployed as a Cloudflare Worker with static assets, using
Wrangler.

## Structure

```
.
├── public/
│   └── index.html     # the entire site (markup, styles, and script)
├── src/
│   └── index.js        # Worker: serves the static site + the Stripe checkout API route
├── wrangler.toml        # tells Wrangler where the assets and Worker entry point are
└── README.md
```

## How this is deployed

This repo is connected to a Cloudflare **Workers** project (Workers & Pages →
your project → uses the `npx wrangler deploy` build command). That command
reads `wrangler.toml`, which points Wrangler at:

- `src/index.js` — the Worker script (`main`)
- `public/` — the static site files, served automatically for any request
  the Worker doesn't otherwise handle (the `[assets]` block)

Every push to your connected branch triggers a new build automatically —
nothing else to configure for deploys to work.

## Local preview

```bash
npx wrangler dev
```

This runs the Worker (and serves `public/`) locally, matching production
behavior — including the `/api/create-checkout-session` route.

## Setting up Stripe checkout

Checkout is wired to real Stripe Checkout via `src/index.js`. It runs
server-side, so your secret key never reaches the browser. To turn it on:

1. **Create a product + price in Stripe** for each item you sell (Stripe
   Dashboard → Product catalog → Add product). Each price has an ID that
   looks like `price_1AbCdEfGhIjK`.
2. **Paste those price IDs into `public/index.html`.** Every product
   `<article>` and the bundle box has a `data-price-id="price_REPLACE_..."`
   attribute — replace each placeholder with the real price ID from Stripe.
3. **Add your Stripe secret key as a Worker secret:** in the Cloudflare
   dashboard, go to your Worker → **Settings → Variables and Secrets**, add
   a variable named `STRIPE_SECRET_KEY`, set its type to **Secret**, and
   save. Use a `sk_test_...` key while testing, switch to `sk_live_...` when
   you're ready to take real payments.
   - For local dev, put the same key in a `.dev.vars` file at the repo root
     (`STRIPE_SECRET_KEY=sk_test_...`) — it's already git-ignored.
4. **Push to redeploy.** No extra build config needed — Wrangler picks up
   `wrangler.toml` automatically.

Test the flow with [Stripe's test card `4242 4242 4242 4242`](https://docs.stripe.com/testing)
(any future expiry, any CVC) before switching to live keys. After a
successful payment, Stripe redirects back to `/?checkout=success` and the
site clears the cart and shows a confirmation banner; a canceled checkout
redirects to `/?checkout=cancel` and leaves the cart untouched.

Digital delivery (emailing the actual files after purchase) isn't handled
here yet — that typically needs a Stripe webhook listening for
`checkout.session.completed` that sends the download links. Ask if you want
that built next.

## Notes

- The cart (add/remove/subtotal) is a front-end convenience; checkout itself
  is real once you complete the Stripe setup above — clicking "Checkout"
  creates an actual Stripe Checkout Session and redirects there.
- Until you replace the `price_REPLACE_...` placeholders, checkout will show
  an inline error explaining what's missing instead of failing silently.
- Fonts (Space Grotesk, Inter, Caveat) load from Google Fonts via CDN link
  tags in `<head>` — no local font files to manage.
