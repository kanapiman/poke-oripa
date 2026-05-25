// ============================================================
//  PokeOripa - セキュアなバックエンド
//  npm install express stripe cors dotenv helmet express-rate-limit @supabase/supabase-js
// ============================================================
require("dotenv").config();
const path = require("path");
const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase（サービスロールキー = サーバー専用）
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const authSupabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ── セキュリティ設定 ─────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  "http://localhost:3000",
  "https://localhost:3000",
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

// レート制限（1IPあたり15分で100リクエストまで）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "リクエストが多すぎます。しばらく待ってください。" },
});
app.use("/api/", limiter);

// ポイント購入は特に厳しく（1IPあたり15分で10回まで）
const pointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "購入リクエストが多すぎます。" },
});

// ── ポイントパッケージ ────────────────────────────────────────
const PACKAGES = {
  p500:   { points: 500,   price: 500,   bonus: 0    },
  p1100:  { points: 1100,  price: 1000,  bonus: 100  },
  p3300:  { points: 3300,  price: 3000,  bonus: 300  },
  p5500:  { points: 5500,  price: 5000,  bonus: 500  },
  p11000: { points: 11000, price: 10000, bonus: 1000 },
};

async function findUserByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const found = data.users.find((user) => (user.email || "").toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) return null;
  }

  return null;
}

// ── JSONパース（Webhook以外） ──────────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl === "/api/webhook") next();
  else express.json()(req, res, next);
});

app.post("/api/auth/check-email", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ error: "メールアドレスを入力してください" });

  try {
    const user = await findUserByEmail(email);
    res.json({
      exists: !!user,
      emailConfirmed: !!user?.email_confirmed_at,
    });
  } catch (err) {
    console.error("メール確認エラー:", err.message);
    res.status(500).json({ error: "メール確認に失敗しました" });
  }
});

// ── ユーザー認証チェック ──────────────────────────────────────
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "認証が必要です" });

  const { data: { user }, error } = await authSupabase.auth.getUser(token);
  if (error || !user) {
    console.error("認証エラー:", error?.message || "user not found");
    return res.status(401).json({ error: "無効なトークンです" });
  }

  req.user = user;
  next();
}

// ── ポイント購入 PaymentIntent 作成 ──────────────────────────
app.post("/api/buy-points", pointLimiter, authMiddleware, async (req, res) => {
  const { packageId } = req.body;
  const pkg = PACKAGES[packageId];
  if (!pkg) return res.status(400).json({ error: "パッケージが見つかりません" });

  try {
    const intent = await stripe.paymentIntents.create({
      amount: pkg.price,
      currency: "jpy",
      metadata: {
        packageId,
        points: String(pkg.points),
        userId: req.user.id,  // ← ユーザーIDをStripeに紐付ける
      },
      payment_method_types: ["card"],
    });
    res.json({ clientSecret: intent.client_secret, pkg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook（決済完了 → ポイント付与）────────────────────────
// ここだけ生のbodyが必要
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook署名エラー:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { userId, points, packageId } = intent.metadata;

    if (!userId || !points) {
      console.error("メタデータ不足:", intent.metadata);
      return res.json({ received: true });
    }

    const addPoints = parseInt(points);

    // ① ポイント加算（サーバー側で確実に処理）
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ points: profile.points + addPoints })
        .eq("id", userId);

      // ② ポイント履歴に記録
      await supabase.from("point_history").insert({
        user_id: userId,
        type: "charge",
        points: addPoints,
        label: `ポイントチャージ (${packageId})`,
      });

      console.log(`✅ ポイント付与完了: ${userId} に ${addPoints}pt`);
    }
  }

  res.json({ received: true });
});

// ── ユーザー情報取得 ─────────────────────────────────────────
app.get("/api/me", authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 購入履歴保存 ─────────────────────────────────────────────
app.post("/api/purchase", authMiddleware, async (req, res) => {
  const { oripaName, cardName, rarity, price } = req.body;
  const userId = req.user.id;

  // ポイント残高確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .single();

  if (!profile || profile.points < price) {
    return res.status(400).json({ error: "ポイントが不足しています" });
  }

  // ポイント消費 + 履歴保存（同時実行）
  await Promise.all([
    supabase.from("profiles").update({ points: profile.points - price }).eq("id", userId),
    supabase.from("purchases").insert({ user_id: userId, oripa_name: oripaName, card_name: cardName, rarity, price }),
    supabase.from("point_history").insert({ user_id: userId, type: "use", points: -price, label: oripaName }),
  ]);

  res.json({ success: true, remainingPoints: profile.points - price });
});

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

if (process.env.NODE_ENV === "production") {
  const buildDir = path.join(__dirname, "build");
  app.use(express.static(buildDir));
  app.get(/.*/, (_, res) => {
    res.sendFile(path.join(buildDir, "index.html"));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PokeOripa server listening on port ${PORT}`));
