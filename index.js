/**
 * Cloudflare Worker entry point for Unhingedly.
 *
 * - Serves the static site out of /public via the ASSETS binding.
 * - Handles one API route, POST /api/create-checkout-session, which creates
 *   a real Stripe Checkout Session server-side (the secret key never
 *   reaches the browser).
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      return createCheckoutSession(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function createCheckoutSession(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json(
      { error: "Stripe isn't configured yet — add STRIPE_SECRET_KEY as a secret in Settings → Variables and Secrets." },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const validItems = items.filter((item) => item && item.price);

  if (validItems.length === 0) {
    return json(
      { error: "Your cart doesn't have any valid Stripe price IDs yet — replace the price_REPLACE_ placeholders in public/index.html." },
      400
    );
  }

  const origin = request.headers.get('origin') || new URL(request.url).origin;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${origin}/?checkout=success`);
  params.append('cancel_url', `${origin}/?checkout=cancel`);

  validItems.forEach((item, i) => {
    params.append(`line_items[${i}][price]`, item.price);
    params.append(`line_items[${i}][quantity]`, String(item.quantity || 1));
  });

  let stripeRes;
  try {
    stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (err) {
    return json({ error: "Couldn't reach Stripe. Try again in a moment." }, 502);
  }

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    return json({ error: session.error?.message || 'Stripe rejected the request.' }, 500);
  }

  return json({ url: session.url });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
