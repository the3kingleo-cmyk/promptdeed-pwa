const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();

// ---------- CONFIG ----------
// Set these as environment variables before deploying.
// On Railway/Render: add them in the dashboard.
const {
  SHOPIFY_WEBHOOK_SECRET,   // From Shopify Admin → Settings → Notifications → Webhooks
  SHOPIFY_ACCESS_TOKEN,     // From Shopify Admin → Settings → Apps → private app token
  SHOPIFY_STORE_DOMAIN = "vyycqv-vf.myshopify.com",
  SMTP_HOST,                // e.g. smtp.gmail.com
  SMTP_PORT = "587",
  SMTP_USER,                // your sender email
  SMTP_PASS,                // your email password or app password
  SMTP_FROM = SMTP_USER,
  PORT = "3000",
} = process.env;

const UNLOCK_CODE = "PROMPTDEED-LAUNCH-2026";
const UNLOCK_PAGE = `https://${SHOPIFY_STORE_DOMAIN}/pages/unlock`;
const PROMPTDEED_SKU = "PROMPTDEED-V1";

// ---------- WEBHOOK VERIFICATION ----------
function verifyShopifyWebhook(rawBody, hmacHeader) {
  if (!SHOPIFY_WEBHOOK_SECRET) return true; // skip in local dev if not set
  const hash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

// ---------- EMAIL ----------
async function sendUnlockEmail(toEmail, customerName, orderName) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[Promptdeed] SMTP not configured — skipping email to ${toEmail}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `Promptdeed <${SMTP_FROM}>`,
    to: toEmail,
    subject: `Your Promptdeed Unlock Code — Order ${orderName}`,
    html: `
      <div style="max-width:580px;margin:0 auto;font-family:-apple-system,sans-serif">
        <h1 style="color:#1B2B4B">You're in, ${customerName || "Agent"}.</h1>
        <p style="font-size:16px;color:#444">
          Thanks for purchasing Promptdeed. Here's your unlock code:
        </p>
        <div style="background:#1B2B4B;color:#FAF7F2;font-size:26px;font-weight:700;
                    letter-spacing:4px;padding:22px 28px;border-radius:10px;
                    text-align:center;margin:24px 0">
          ${UNLOCK_CODE}
        </div>
        <p style="font-size:15px;color:#555">
          <strong>How to unlock:</strong><br>
          1. Open the Promptdeed app<br>
          2. Tap <strong>Settings</strong><br>
          3. Paste the code above — all 50 prompts unlock instantly
        </p>
        <p style="margin:28px 0">
          <a href="${UNLOCK_PAGE}"
             style="background:#B8743D;color:#fff;padding:14px 28px;
                    border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
            Open Promptdeed App
          </a>
        </p>
        <p style="font-size:13px;color:#888;margin-top:32px">
          This is a one-time purchase — no subscription, no logins. Your 50 prompts are yours forever.<br>
          Questions? Reply to this email.
        </p>
      </div>
    `,
  });

  console.log(`[Promptdeed] Unlock email sent to ${toEmail} for order ${orderName}`);
}

// ---------- SHOPIFY FULFILLMENT ----------
async function fulfillOrder(orderId, orderName) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    console.log(`[Promptdeed] No access token — skipping auto-fulfillment for ${orderName}`);
    return;
  }

  const apiBase = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
  };

  // 1. Get fulfillment orders
  const foRes = await fetch(apiBase, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: `query getFO($id: ID!) {
        order(id: $id) {
          fulfillmentOrders(first: 10) {
            nodes { id status lineItems(first: 10) { nodes { id remainingQuantity } } }
          }
        }
      }`,
      variables: { id: `gid://shopify/Order/${orderId}` },
    }),
  });

  const foData = await foRes.json();
  const fulfillmentOrders = foData.data?.order?.fulfillmentOrders?.nodes ?? [];
  const pending = fulfillmentOrders.filter((fo) =>
    ["OPEN", "IN_PROGRESS"].includes(fo.status)
  );

  for (const fo of pending) {
    const lineItems = fo.lineItems.nodes
      .filter((li) => li.remainingQuantity > 0)
      .map((li) => ({ id: li.id, quantity: li.remainingQuantity }));

    if (!lineItems.length) continue;

    const fulfillRes = await fetch(apiBase, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `mutation fulfill($input: FulfillmentInput!) {
          fulfillmentCreate(fulfillment: $input) {
            fulfillment { id status }
            userErrors { field message }
          }
        }`,
        variables: {
          input: {
            notifyCustomer: true,
            trackingInfo: { url: UNLOCK_PAGE, number: UNLOCK_CODE },
            lineItemsByFulfillmentOrder: [{
              fulfillmentOrderId: fo.id,
              fulfillmentOrderLineItems: lineItems,
            }],
          },
        },
      }),
    });

    const fulfillData = await fulfillRes.json();
    const errors = fulfillData.data?.fulfillmentCreate?.userErrors ?? [];
    if (errors.length) {
      console.error(`[Promptdeed] Fulfillment errors for ${orderName}:`, errors);
    } else {
      console.log(`[Promptdeed] Order ${orderName} fulfilled — customer notified`);
    }
  }
}

// ---------- ROUTES ----------
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Health check
app.get("/", (_req, res) => res.json({ ok: true, service: "Promptdeed Webhook Server" }));

// Shopify orders/paid webhook
app.post("/webhooks/orders/paid", async (req, res) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (hmac && !verifyShopifyWebhook(req.rawBody, hmac)) {
    console.warn("[Promptdeed] Invalid webhook signature — rejected");
    return res.status(401).send("Unauthorized");
  }

  // Acknowledge immediately (Shopify requires < 5s)
  res.status(200).send("OK");

  const order = req.body;
  const orderId = order.id;
  const orderName = order.name;
  const customerEmail = order.email || order.customer?.email;
  const customerName =
    order.billing_address?.first_name ||
    order.customer?.first_name ||
    "Agent";

  console.log(`[Promptdeed] orders/paid → ${orderName} | ${customerEmail}`);

  // Run fulfillment and email in parallel
  await Promise.allSettled([
    fulfillOrder(orderId, orderName),
    customerEmail
      ? sendUnlockEmail(customerEmail, customerName, orderName)
      : Promise.resolve(),
  ]);
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`[Promptdeed] Webhook server running on port ${PORT}`);
  console.log(`[Promptdeed] POST /webhooks/orders/paid`);
  if (!SHOPIFY_WEBHOOK_SECRET) console.warn("[Promptdeed] WARNING: SHOPIFY_WEBHOOK_SECRET not set");
  if (!SMTP_HOST) console.warn("[Promptdeed] WARNING: SMTP not configured — emails disabled");
});
