// ============================================================
//  PokeOripa - ログイン認証 + セキュアなポイント管理
//  npm install @stripe/react-stripe-js @stripe/stripe-js @supabase/supabase-js
// ============================================================
import { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createClient } from "@supabase/supabase-js";

// ── 初期化 ───────────────────────────────────────────────────
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

// ── Rarity ───────────────────────────────────────────────────
const R = {
  UR:  { label:"UR",  bg:"from-pink-400 via-violet-500 to-cyan-400", border:"border-pink-400",   glow:"0 0 40px rgba(236,72,153,.7)", emoji:"🌈" },
  SAR: { label:"SAR", bg:"from-amber-300 via-orange-400 to-red-500",  border:"border-orange-400", glow:"0 0 40px rgba(251,146,60,.7)",  emoji:"✨" },
  SR:  { label:"SR",  bg:"from-yellow-300 to-amber-500",             border:"border-yellow-400", glow:"0 0 30px rgba(251,191,36,.6)",  emoji:"⭐" },
  RR:  { label:"RR",  bg:"from-violet-400 to-purple-600",            border:"border-violet-400", glow:"0 0 25px rgba(167,139,250,.5)", emoji:"💫" },
  R:   { label:"R",   bg:"from-blue-400 to-blue-600",                border:"border-blue-400",   glow:"0 0 20px rgba(96,165,250,.4)",  emoji:"🔷" },
  U:   { label:"U",   bg:"from-slate-400 to-slate-600",              border:"border-slate-400",  glow:"",                               emoji:"🔹" },
  C:   { label:"C",   bg:"from-zinc-500 to-zinc-700",                border:"border-zinc-500",   glow:"",                               emoji:"⬜" },
};

const PACKAGES = [
  { id:"p500",   points:500,   price:500,   bonus:0,    popular:false },
  { id:"p1100",  points:1100,  price:1000,  bonus:100,  popular:false },
  { id:"p3300",  points:3300,  price:3000,  bonus:300,  popular:true  },
  { id:"p5500",  points:5500,  price:5000,  bonus:500,  popular:false },
  { id:"p11000", points:11000, price:10000, bonus:1000, popular:false },
];

const DEFAULTS = [
  {
    id:"1", name:"ポケモン151 スーパーオリパ", price:500,
    desc:"ポケモン151より厳選した高額カードが当たるオリパ！リザードンex SAR封入率UP！",
    remaining:50, total:50, active:true,
    featured:["リザードンex SAR","フシギバナex SAR","ピカチュウex UR"],
    lineup:[
      {name:"ピカチュウex UR",   rarity:"UR",  rate:0.5},
      {name:"リザードンex SAR",  rarity:"SAR", rate:2},
      {name:"フシギバナex SAR",  rarity:"SAR", rate:2},
      {name:"カメックスex SAR",  rarity:"SAR", rate:1},
      {name:"ミュウex SR",       rarity:"SR",  rate:5},
      {name:"ゲンガーex SR",     rarity:"SR",  rate:5},
      {name:"カイリューex RR",   rarity:"RR",  rate:10},
      {name:"ラプラスex RR",     rarity:"RR",  rate:10},
      {name:"各種Rカード",       rarity:"R",   rate:20},
      {name:"各種Uカード",       rarity:"U",   rate:25},
      {name:"各種Cカード",       rarity:"C",   rate:19.5},
    ],
  },
  {
    id:"2", name:"黒炎のマスター 高額オリパ", price:1000,
    desc:"リザードンexを中心とした黒炎の支配者オリパ！高額SARが高確率で当たる！",
    remaining:30, total:30, active:true,
    featured:["リザードンex SAR","マフォクシーex SAR"],
    lineup:[
      {name:"リザードンex SAR",  rarity:"SAR", rate:5},
      {name:"マフォクシーex SAR",rarity:"SAR", rate:5},
      {name:"リザードンex SR",   rarity:"SR",  rate:10},
      {name:"ガブリアスex SR",   rarity:"SR",  rate:10},
      {name:"各種RRカード",      rarity:"RR",  rate:20},
      {name:"各種Rカード",       rarity:"R",   rate:25},
      {name:"各種C/Uカード",     rarity:"C",   rate:25},
    ],
  },
  {
    id:"3", name:"レイジングサーフ お試しオリパ", price:300,
    desc:"気軽に楽しめるお試しオリパ！トドロクツキexが当たるかも？",
    remaining:100, total:100, active:true,
    featured:["トドロクツキex SAR","サーフゴーex SR"],
    lineup:[
      {name:"トドロクツキex SAR",rarity:"SAR", rate:3},
      {name:"サーフゴーex SR",   rarity:"SR",  rate:8},
      {name:"ハバタクカミex SR", rarity:"SR",  rate:8},
      {name:"各種RRカード",      rarity:"RR",  rate:15},
      {name:"各種Rカード",       rarity:"R",   rate:30},
      {name:"各種C/Uカード",     rarity:"C",   rate:36},
    ],
  },
];

function draw(lineup) {
  const r = Math.random() * 100; let c = 0;
  for (const x of lineup) { c += x.rate; if (r <= c) return x; }
  return lineup[lineup.length - 1];
}

function RarityBadge({ rarity, small }) {
  const cfg = R[rarity] || R.C;
  return <span className={`inline-block bg-gradient-to-r ${cfg.bg} text-white font-black rounded-full ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"}`}>{cfg.label}</span>;
}

// ── ログイン・登録画面 ────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setError("パスワードリセット用のメールを送りました。メールのリンクを確認してください。");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "メール確認に失敗しました");
        if (data.exists) {
          setError(data.emailConfirmed
            ? "このメールアドレスは既に登録済みです。ログインするか、パスワードをリセットしてください。"
            : "このメールアドレスは登録済みです。確認メールのリンクを開いてからログインしてください。"
          );
          setLoading(false);
          return;
        }
      } catch (err) {
        setError(err.message || "メール確認に失敗しました");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setDone(true);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError("メールアドレスまたはパスワードが違います"); setLoading(false); return; }
      onAuth(data.session);
    }
    setLoading(false);
  }

  if (done) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-black text-white mb-2">確認メールを送りました</h2>
        <p className="text-zinc-400 text-sm">メールのリンクをクリックして登録を完了してください</p>
        <button onClick={()=>{setMode("login");setDone(false);}} className="mt-6 text-yellow-400 text-sm hover:text-yellow-300">ログインへ →</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">PokeOripa</h1>
          <p className="text-zinc-500 text-sm mt-1">{mode === "login" ? "ログイン" : mode === "signup" ? "新規登録" : "パスワードリセット"}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500/50 placeholder-zinc-600 text-sm"
              placeholder="example@gmail.com"/>
          </div>
          {mode !== "reset" && (
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">パスワード（6文字以上）</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500/50 placeholder-zinc-600 text-sm"
                placeholder="••••••••"/>
            </div>
          )}
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">⚠️ {error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black py-3 rounded-xl hover:brightness-110 disabled:opacity-40 transition">
            {loading ? "処理中..." : mode === "login" ? "ログイン" : mode === "signup" ? "登録する" : "リセットメールを送る"}
          </button>
        </form>
        <div className="text-center mt-4 space-y-2">
          <button onClick={()=>{ setError(null); setMode(mode==="login"?"signup":"login"); }} className="block w-full text-zinc-500 text-sm hover:text-white transition">
            {mode === "login" ? "アカウントを作成する →" : "← ログインへ戻る"}
          </button>
          {mode === "login" && (
            <button onClick={()=>{ setError(null); setMode("reset"); }} className="block w-full text-zinc-600 text-xs hover:text-yellow-400 transition">
              パスワードを忘れた方
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stripe 決済フォーム ──────────────────────────────────────
function PointCheckoutForm({ pkg, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (err) { setError(err.message); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 mb-5 text-center">
        <p className="text-yellow-400 text-xs mb-1 tracking-wider">購入するポイント</p>
        <p className="text-white font-black text-4xl">{pkg.points.toLocaleString()} <span className="text-yellow-400 text-2xl">pt</span></p>
        {pkg.bonus > 0 && <p className="text-emerald-400 text-xs mt-1">うちボーナス {pkg.bonus}pt 含む</p>}
        <p className="text-zinc-400 text-sm mt-2">¥{pkg.price.toLocaleString()}</p>
      </div>
      <div className="mb-5"><PaymentElement options={{ layout:"tabs" }}/></div>
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">⚠️ {error}</div>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl text-sm font-bold hover:bg-white/10 transition">キャンセル</button>
        <button type="submit" disabled={!stripe||loading}
          className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black py-3 rounded-xl hover:brightness-110 disabled:opacity-40 transition">
          {loading?"処理中...":`¥${pkg.price.toLocaleString()} 支払う`}
        </button>
      </div>
      <p className="text-zinc-600 text-xs text-center mt-3">🔒 Stripe による安全な決済</p>
      <p className="text-zinc-700 text-[10px] text-center mt-1">テスト: 4242 4242 4242 4242 / 任意の日付・CVV</p>
    </form>
  );
}

// ── ポイント購入モーダル ──────────────────────────────────────
function PointShopModal({ onClose, onPurchased, session, onSessionExpired }) {
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  async function startCheckout(pkg) {
    setSelectedPkg(pkg); setClientSecret(null); setFetchError(null);
    try {
      const { data: current } = await supabase.auth.getSession();
      const activeSession = current?.session || session;
      if (!activeSession?.access_token) {
        setFetchError("セッションの有効期限が切れました。もう一度ログインしてください。");
        onSessionExpired?.();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/buy-points`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeSession.access_token}`, // ← 認証トークン送信
        },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setFetchError("セッションの有効期限が切れました。もう一度ログインしてください。");
        onSessionExpired?.();
        return;
      }
      if (data.error) { setFetchError(data.error); return; }
      setClientSecret(data.clientSecret);
    } catch { setFetchError("サーバーに接続できません"); }
  }

  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: { theme:"night", variables:{ colorPrimary:"#facc15", borderRadius:"12px" } },
  } : null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar" onClick={e=>e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-white">💎 ポイントを購入</h2>
              <p className="text-zinc-500 text-xs mt-0.5">ポイントでオリパを引けます</p>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-white text-xl transition">✕</button>
          </div>
          {!selectedPkg ? (
            <div className="space-y-3">
              {PACKAGES.map(pkg=>(
                <button key={pkg.id} onClick={()=>startCheckout(pkg)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all relative overflow-hidden ${pkg.popular?"border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10":"border-white/10 bg-white/3 hover:bg-white/8"}`}>
                  {pkg.popular && <span className="absolute top-0 right-0 bg-yellow-400 text-gray-900 text-[10px] font-black px-3 py-1 rounded-bl-xl">人気No.1</span>}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-white text-lg">{pkg.points.toLocaleString()} <span className="text-yellow-400">pt</span></p>
                      {pkg.bonus>0 && <p className="text-emerald-400 text-xs mt-0.5">✓ ボーナス +{pkg.bonus}pt おトク！</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white text-xl">¥{pkg.price.toLocaleString()}</p>
                      <p className="text-zinc-500 text-xs">1pt = {(pkg.price/pkg.points).toFixed(1)}円</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : fetchError ? (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm mb-4">{fetchError}</p>
              <button onClick={()=>setSelectedPkg(null)} className="bg-white/10 px-6 py-2 rounded-xl text-sm hover:bg-white/20 transition">← 戻る</button>
            </div>
          ) : !clientSecret ? (
            <div className="text-center py-12 text-zinc-500"><div className="text-3xl animate-spin mb-3">⚡</div><p className="text-sm">準備中...</p></div>
          ) : (
            <Elements stripe={stripePromise} options={stripeOptions}>
              <button onClick={()=>{setSelectedPkg(null);setClientSecret(null);}} className="text-zinc-500 hover:text-white text-sm mb-5 transition flex items-center gap-1">← 戻る</button>
              <PointCheckoutForm pkg={selectedPkg} onSuccess={()=>{onPurchased();onClose();}} onCancel={()=>{setSelectedPkg(null);setClientSecret(null);}}/>
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("home");
  const [oripas] = useState(DEFAULTS);
  const [purchases, setPurchases] = useState([]);
  const [pointHistory, setPointHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showPointShop, setShowPointShop] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  // セッション監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(session) {
    // プロフィールがなければ作成
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (error) {
      await supabase.from("profiles").insert({ id: session.user.id, email: session.user.email, points: 0 });
      setProfile({ id: session.user.id, email: session.user.email, points: 0 });
    } else {
      setProfile(data);
    }
    // 履歴読み込み
    const { data: ph } = await supabase.from("point_history").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(30);
    const { data: pu } = await supabase.from("purchases").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(50);
    if (ph) setPointHistory(ph);
    if (pu) setPurchases(pu);
  }

  function notify(msg, err=false) {
    clearTimeout(toastRef.current);
    setToast({msg,err});
    toastRef.current = setTimeout(()=>setToast(null),3000);
  }

  async function handleBuy(oripa) {
    if (!profile || profile.points < oripa.price) { notify("ポイントが不足しています",true); return; }
    if (oripa.remaining <= 0) { notify("売り切れです",true); return; }

    const card = draw(oripa.lineup);
    const { data: current } = await supabase.auth.getSession();
    const activeSession = current?.session || session;
    if (!activeSession?.access_token) {
      notify("セッションの有効期限が切れました。もう一度ログインしてください。", true);
      await handleLogout();
      return;
    }

    // サーバー側でポイント消費（改ざん防止）
    const res = await fetch(`${API_BASE_URL}/api/purchase`, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${activeSession.access_token}` },
      body: JSON.stringify({ oripaName:oripa.name, cardName:card.name, rarity:card.rarity, price:oripa.price }),
    });
    const data = await res.json();
    if (res.status === 401) {
      notify("セッションの有効期限が切れました。もう一度ログインしてください。", true);
      await handleLogout();
      return;
    }
    if (!res.ok) { notify(data.error||"エラーが発生しました",true); return; }

    setProfile(prev => ({ ...prev, points: data.remainingPoints }));
    setResult({ cardName:card.name, rarity:card.rarity, oripaId:oripa.id, oripaName:oripa.name, price:oripa.price });
    setRevealed(false);
    setPage("result");
  }

  // ポイントチャージ後にプロフィール再取得
  async function handlePointPurchased() {
    notify("決済完了！ポイントが反映されるまで少し待ってください");
    // Webhookの処理を待つ
    setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) setProfile(data);
      const { data: ph } = await supabase.from("point_history").select("*").eq("user_id", session.user.id).order("created_at", { ascending:false }).limit(30);
      if (ph) setPointHistory(ph);
      notify("ポイントが追加されました！");
    }, 3000);
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
      setShowPointShop(false);
      setPage("home");
    }
  }

  function loginAdmin() {
    if (adminPw==="admin123") { setAdminMode(true); setShowLogin(false); setAdminPw(""); setPage("admin"); }
    else notify("パスワードが違います",true);
  }

  if (!session) return <AuthPage onAuth={(s)=>{ setSession(s); loadProfile(s); }}/>;

  const liveOripa = selected ? oripas.find(o=>o.id===selected.id)||selected : null;
  const points = profile?.points || 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" style={{fontFamily:"'Hiragino Sans','Yu Gothic',sans-serif"}}>
      <style>{`
        @keyframes flip{0%{transform:rotateY(0)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
        @keyframes slide-up{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        .flip-in{animation:flip 0.6s ease-out}
        .slide-up{animation:slide-up 0.35s ease-out forwards}
      `}</style>

      {toast && <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl font-bold text-sm slide-up shadow-2xl ${toast.err?"bg-red-600":"bg-emerald-600"}`}>{toast.msg}</div>}

      {showPointShop && <PointShopModal onClose={()=>setShowPointShop(false)} onPurchased={handlePointPurchased} session={session} onSessionExpired={()=>{ setShowPointShop(false); handleLogout(); }}/>}

      {/* 管理者ログイン */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" onClick={()=>setShowLogin(false)}>
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-80" onClick={e=>e.stopPropagation()}>
            <div className="text-center mb-6"><div className="text-3xl mb-2">🔐</div><h2 className="text-lg font-black text-yellow-400">管理者ログイン</h2></div>
            <input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loginAdmin()}
              placeholder="パスワード" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-500/50 mb-4 placeholder-zinc-600"/>
            <div className="flex gap-2">
              <button onClick={loginAdmin} className="flex-1 bg-yellow-400 text-gray-900 font-black py-2.5 rounded-xl hover:bg-yellow-300 transition">ログイン</button>
              <button onClick={()=>setShowLogin(false)} className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl hover:bg-white/10 transition">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button onClick={()=>setPage("home")} className="flex items-center gap-2 shrink-0">
            <span className="text-xl">⚡</span>
            <span className="font-black text-lg bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">PokeOripa</span>
          </button>
          <nav className="flex items-center gap-1">
            {["home","mypage"].map(p=>(
              <button key={p} onClick={()=>setPage(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${page===p?"bg-yellow-400/10 text-yellow-400":"text-zinc-500 hover:text-white"}`}>
                {p==="home"?"ホーム":"マイページ"}
              </button>
            ))}
            {adminMode
              ? <button onClick={()=>setPage("admin")} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${page==="admin"?"bg-red-500/20 text-red-400":"text-zinc-600 hover:text-red-400"}`}>管理</button>
              : <button onClick={()=>setShowLogin(true)} className="text-zinc-700 hover:text-zinc-500 px-2 text-lg">⚙</button>
            }
            <button onClick={handleLogout} className="text-zinc-600 hover:text-red-400 text-xs px-2 transition">ログアウト</button>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-yellow-400">💎</span>
              <span className="text-yellow-400 font-black text-sm">{points.toLocaleString()}<span className="text-yellow-500/70 text-xs ml-0.5">pt</span></span>
            </div>
            <button onClick={()=>setShowPointShop(true)}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black text-xs px-3 py-1.5 rounded-full hover:brightness-110 transition whitespace-nowrap">
              チャージ
            </button>
          </div>
        </div>
      </header>

      {/* ── HOME ─────────────────────────────────────────────── */}
      {page==="home" && (
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="text-center mb-12">
            <div className="inline-block mb-4 px-4 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold tracking-widest">POKEMON CARD ORIPA</div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-transparent">オリパを引いてみよう</h1>
            <p className="text-zinc-500 text-sm">ようこそ、{profile?.email} さん！</p>
            {points===0 && <button onClick={()=>setShowPointShop(true)} className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black px-6 py-3 rounded-full hover:brightness-110 transition">💎 まずはポイントをチャージ</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {oripas.filter(o=>o.active).map(oripa=>{
              const pct=Math.round((oripa.remaining/oripa.total)*100);
              const canBuy=points>=oripa.price&&oripa.remaining>0;
              return (
                <div key={oripa.id} onClick={()=>{setSelected(oripa);setPage("detail");}}
                  className="bg-[#111827] rounded-2xl overflow-hidden border border-white/5 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-500/10 cursor-pointer group">
                  <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 h-40 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_60%)]"/>
                    <span className="text-6xl relative z-10 group-hover:scale-110 transition-transform duration-300">🎴</span>
                    <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
                      <span className="text-yellow-400 text-xs">💎</span>
                      <span className="text-yellow-300 font-black">{oripa.price.toLocaleString()}pt</span>
                    </div>
                    {oripa.remaining===0&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white font-black text-2xl">SOLD OUT</span></div>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-white text-sm leading-tight mb-1">{oripa.name}</h3>
                    <p className="text-zinc-500 text-xs mb-3 line-clamp-2">{oripa.desc}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {oripa.featured.slice(0,2).map((f,i)=>(<span key={i} className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5">✨{f}</span>))}
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>残{oripa.remaining}枚</span><span>{pct}%</span></div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct>50?"bg-emerald-500":pct>20?"bg-yellow-500":"bg-red-500"}`} style={{width:`${pct}%`}}/></div>
                    </div>
                    <button disabled={!canBuy} className={`w-full font-black text-sm py-2.5 rounded-xl transition-all ${canBuy?"bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 hover:brightness-110":"bg-white/5 text-zinc-600 cursor-not-allowed border border-white/10"}`}>
                      {oripa.remaining===0?"SOLD OUT":!canBuy?"ポイント不足":"引く →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DETAIL ───────────────────────────────────────────── */}
      {page==="detail"&&liveOripa&&(
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={()=>setPage("home")} className="text-zinc-500 hover:text-white text-sm mb-6 flex items-center gap-2 transition">← ホームへ戻る</button>
          <div className="bg-[#111827] rounded-2xl overflow-hidden border border-white/5">
            <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-8 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]"/>
              <div className="relative z-10"><div className="text-5xl mb-3">🎴</div><h1 className="text-xl font-black text-gray-900 mb-1">{liveOripa.name}</h1><p className="text-gray-800 text-sm">{liveOripa.desc}</p></div>
              <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 text-right">
                <div className="flex items-center gap-1 justify-end"><span className="text-yellow-300 text-lg">💎</span><span className="text-yellow-200 font-black text-2xl">{liveOripa.price.toLocaleString()}</span><span className="text-yellow-300 text-sm">pt</span></div>
                <div className="text-gray-300 text-xs">残り {liveOripa.remaining}枚</div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-yellow-400 font-black text-sm mb-3 tracking-wider">✨ 注目カード</h2>
                <div className="flex flex-wrap gap-2">{liveOripa.featured.map((f,i)=>(<span key={i} className="bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 rounded-lg px-3 py-1 text-sm font-bold">{f}</span>))}</div>
              </div>
              <div>
                <h2 className="text-yellow-400 font-black text-sm mb-3 tracking-wider">📋 ラインナップ・排出率</h2>
                <div className="rounded-xl overflow-hidden border border-white/5">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-white/3 text-zinc-500 text-xs"><th className="text-left px-4 py-2">カード名</th><th className="text-center px-3 py-2">レアリティ</th><th className="text-right px-4 py-2">排出率</th></tr></thead>
                    <tbody>{liveOripa.lineup.map((item,i)=>(<tr key={i} className="border-t border-white/3 hover:bg-white/3 transition"><td className="px-4 py-2.5 text-zinc-300">{(R[item.rarity]||R.C).emoji} {item.name}</td><td className="px-3 py-2.5 text-center"><RarityBadge rarity={item.rarity} small/></td><td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400">{item.rate}%</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3 bg-white/3 rounded-xl px-4 py-3">
                  <span className="text-zinc-400 text-sm">所持ポイント</span>
                  <div className="flex items-center gap-1"><span className="text-yellow-400">💎</span><span className="text-yellow-400 font-black">{points.toLocaleString()}pt</span></div>
                </div>
                {points<liveOripa.price&&liveOripa.remaining>0&&(
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-3 flex items-center justify-between">
                    <p className="text-orange-400 text-sm">ポイントが{(liveOripa.price-points).toLocaleString()}pt 不足しています</p>
                    <button onClick={()=>setShowPointShop(true)} className="bg-orange-400 text-gray-900 font-black text-xs px-3 py-1.5 rounded-lg hover:bg-orange-300 transition whitespace-nowrap">チャージ →</button>
                  </div>
                )}
                <button onClick={()=>handleBuy(liveOripa)} disabled={liveOripa.remaining===0||points<liveOripa.price}
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black text-xl py-4 rounded-2xl hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg shadow-yellow-500/20">
                  {liveOripa.remaining===0?"SOLD OUT":`💎 ${liveOripa.price.toLocaleString()}pt で引く！`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────── */}
      {page==="result"&&result&&(
        <div className="max-w-sm mx-auto px-4 py-12 text-center">
          <h1 className="text-yellow-400 font-black text-2xl mb-2">結果発表！</h1>
          <p className="text-zinc-500 text-sm mb-8">カードをタップして開封しよう</p>
          <div className={`relative rounded-2xl mb-8 overflow-hidden cursor-pointer transition-transform hover:scale-105 ${revealed?"border-2 "+(R[result.rarity]?.border||""):""}`}
            style={{boxShadow:revealed?(R[result.rarity]?.glow||""):"",minHeight:280}} onClick={()=>setRevealed(true)}>
            {!revealed?(
              <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex flex-col items-center justify-center p-12 min-h-[280px]">
                <div className="text-8xl mb-4 animate-bounce">🎴</div><p className="text-gray-900 font-black text-lg">タップして開封！</p>
              </div>
            ):(
              <div className={`bg-gradient-to-br ${R[result.rarity]?.bg||"from-zinc-600 to-zinc-800"} flex flex-col items-center justify-center p-10 min-h-[280px] flip-in`}>
                <div className="text-6xl mb-3">{R[result.rarity]?.emoji||"🃏"}</div>
                <RarityBadge rarity={result.rarity}/>
                <h2 className="text-white font-black text-2xl mt-3 mb-1">{result.cardName}</h2>
                <p className="text-white/60 text-xs">{result.oripaName}</p>
                {["UR","SAR"].includes(result.rarity)&&<div className="mt-3 text-yellow-300 text-sm font-bold animate-pulse">🎊 激レア排出！</div>}
              </div>
            )}
          </div>
          {revealed&&(
            <div className="space-y-3 slide-up">
              <button onClick={()=>{const o=oripas.find(o=>o.id===result.oripaId);if(o){setSelected(o);setPage("detail");}}} className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black py-3.5 rounded-xl hover:brightness-110 transition">もう一度引く</button>
              <button onClick={()=>setPage("home")} className="w-full bg-white/5 border border-white/10 py-3.5 rounded-xl hover:bg-white/10 transition text-sm font-bold">ホームへ戻る</button>
            </div>
          )}
        </div>
      )}

      {/* ── MYPAGE ───────────────────────────────────────────── */}
      {page==="mypage"&&(
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black text-yellow-400 mb-6">マイページ</h1>
          <div className="bg-[#111827] border border-white/5 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400/20 rounded-full flex items-center justify-center text-yellow-400 font-black">👤</div>
            <div><p className="font-bold text-sm">{profile?.email}</p><p className="text-zinc-500 text-xs">会員</p></div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-5">
            <p className="text-zinc-400 text-xs mb-1">ポイント残高</p>
            <div className="flex items-end gap-2 mb-4"><span className="text-5xl">💎</span><span className="text-4xl font-black text-yellow-400">{points.toLocaleString()}</span><span className="text-yellow-500 text-lg mb-1">pt</span></div>
            <button onClick={()=>setShowPointShop(true)} className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black px-6 py-2.5 rounded-xl hover:brightness-110 transition text-sm">💎 ポイントをチャージする</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {label:"総購入回数",value:`${purchases.length}回`,color:"text-white"},
              {label:"総使用pt",value:`${purchases.reduce((s,p)=>s+(p.price||0),0).toLocaleString()}pt`,color:"text-yellow-400"},
              {label:"高額排出数",value:`${purchases.filter(p=>["UR","SAR","SR"].includes(p.rarity)).length}枚`,color:"text-orange-400"},
            ].map(s=>(<div key={s.label} className="bg-[#111827] rounded-xl p-4 border border-white/5 text-center"><div className={`text-xl font-black ${s.color}`}>{s.value}</div><div className="text-zinc-600 text-[10px] mt-0.5">{s.label}</div></div>))}
          </div>
          <h2 className="text-yellow-400 font-black text-sm tracking-wider mb-3">💎 ポイント履歴</h2>
          {pointHistory.length===0?<div className="text-zinc-600 text-center py-8 text-sm mb-6">履歴なし</div>:(
            <div className="space-y-2 mb-6">
              {pointHistory.map(h=>(<div key={h.id} className="bg-[#111827] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between"><div><span className={`text-xs font-bold ${h.type==="charge"?"text-emerald-400":"text-zinc-400"}`}>{h.type==="charge"?"チャージ":"使用"}</span>{h.label&&<span className="text-zinc-600 text-xs ml-2">{h.label}</span>}<div className="text-zinc-600 text-[10px]">{new Date(h.created_at).toLocaleString("ja-JP")}</div></div><span className={`font-black text-sm ${h.points>0?"text-emerald-400":"text-zinc-400"}`}>{h.points>0?"+":""}{h.points.toLocaleString()}pt</span></div>))}
            </div>
          )}
          <h2 className="text-yellow-400 font-black text-sm tracking-wider mb-3">📋 購入履歴</h2>
          {purchases.length===0?(
            <div className="text-center py-10 text-zinc-600"><div className="text-4xl mb-3">🎴</div><p className="text-sm">まだ購入履歴がありません</p></div>
          ):(
            <div className="space-y-2">
              {purchases.map(p=>(<div key={p.id} className="bg-[#111827] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3"><RarityBadge rarity={p.rarity} small/><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{p.card_name}</div><div className="text-zinc-600 text-[10px] truncate">{p.oripa_name} · {new Date(p.created_at).toLocaleString("ja-JP")}</div></div><div className="text-zinc-500 text-xs font-bold shrink-0">-{p.price}pt</div></div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
