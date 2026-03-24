import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const MODES = [
  { id: "pokemon", label: "Single Pokémon", desc: "Every card featuring one Pokémon across all sets", icon: "🔍", ready: true },
  { id: "set", label: "Master Set", desc: "Complete every card in a set like 151 or Base Set", icon: "📦", ready: true },
];
const PSRC = [
  { id: "tcgplayer", label: "TCGPlayer", sub: "USD" },
  { id: "cardmarket", label: "Cardmarket", sub: "EUR" },
];
const VL={normal:"Normal",holofoil:"Holo","reverse-holofoil":"Reverse Holo","1st-edition-holofoil":"1st Ed. Holo","1st-edition":"1st Edition","unlimited-holofoil":"Unlimited Holo",unlimited:"Unlimited",shadowless:"Shadowless"};
const VBC={"Holo":{bg:"rgba(255,215,0,0.15)",text:"#ffd700"},"Reverse Holo":{bg:"rgba(0,200,255,0.15)",text:"#00c8ff"},"1st Ed.":{bg:"rgba(255,100,100,0.15)",text:"#ff6464"},"1st Edition":{bg:"rgba(255,100,100,0.15)",text:"#ff6464"},"Shadowless":{bg:"rgba(255,180,50,0.15)",text:"#ffb432"},"Unlimited":{bg:"rgba(150,150,150,0.15)",text:"#aaa"},"4th Print":{bg:"rgba(150,200,150,0.15)",text:"#8bc48b"}};
const f$=v=>v!=null?`$${v.toFixed(2)}`:"—";
const fE=v=>v!=null?`€${v.toFixed(2)}`:"—";
const fP=(v,s)=>{if(v==null)return"—";return s==="cardmarket"?`€${v.toFixed(2)}`:`$${v.toFixed(2)}`;};
const API="https://api.tcgdex.net/v2/en";
let sdc={};

function tcgdexIdToSymbolUrl(si){if(!si)return null;let id=si;id=id.replace(/([a-z])0+(\d)/gi,"$1$2");id=id.replace(/\./g,"pt");return`https://images.pokemontcg.io/${id}/symbol.png`;}
function SetSymbol({setId,size}){const[err,setErr]=useState(false);const url=tcgdexIdToSymbolUrl(setId);if(err||!url)return<span style={{fontSize:size*0.7}}>📦</span>;return<img src={url} alt="" style={{width:size,height:size,objectFit:"contain"}} onError={()=>setErr(true)}/>;}

async function fetchPT(cn,sn){try{const q=encodeURIComponent(cn+" "+sn);const r=await fetch(`/api/poketrace/cards?search=${q}&market=US&limit=10`);if(!r.ok)return[];const d=await r.json();return d.data||[];}catch{return[];}}
function bestMatch(pts,card){const num=String(card.localId).replace(/^0+/,"");const sn=(card.set||"").toLowerCase();let best=null,bs=-1;for(const pt of pts){if(pt.name?.includes("Japanese"))continue;let sc=0;const pn=(pt.cardNumber?.split("/")?.[0]||"").replace(/^0+/,"");if(pn===num)sc+=10;const ps=(pt.set?.name||"").toLowerCase();if(ps.includes(sn)||sn.includes(ps.replace("sv: scarlet & violet ","").replace("swsh: sword & shield ","")))sc+=5;const pv=(pt.variant||"").toLowerCase();const ov=(card.variant||"").toLowerCase();if(ov.includes("1st")&&pv.includes("1st"))sc+=3;else if(ov.includes("shadowless")&&(ps.includes("shadowless")||pv.includes("unlimited")))sc+=3;else if(ov.includes("reverse")&&pv.includes("reverse"))sc+=3;else if(ov.includes("holo")&&pv.includes("holo")&&!pv.includes("reverse"))sc+=2;else if(ov.includes("normal")&&(pv.includes("normal")||pv===""))sc+=2;if(sc>bs){bs=sc;best=pt;}}return best;}

async function gSD(sid){if(sdc[sid])return sdc[sid];try{const r=await fetch(`${API}/sets/${sid}`);if(!r.ok)return null;const d=await r.json();sdc[sid]=d.releaseDate||null;return sdc[sid];}catch{return null;}}
async function sPoke(q){const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${q.toLowerCase().trim()}`);if(!r.ok)return null;const d=await r.json();return{name:d.name,id:d.id,sprite:d.sprites.other["official-artwork"].front_default||d.sprites.front_default};}
async function gBriefs(name){const r=await fetch(`${API}/cards?name=${encodeURIComponent(name)}`);if(!r.ok)return[];const d=await r.json();return Array.isArray(d)?d:[];}
async function gCard(id){const r=await fetch(`${API}/cards/${id}`);if(!r.ok)return null;return await r.json();}
async function gAll(briefs,onP){const res=[],bs=10;for(let i=0;i<briefs.length;i+=bs){const batch=briefs.slice(i,i+bs);const det=await Promise.all(batch.map(b=>gCard(b.id)));res.push(...det.filter(Boolean));if(onP)onP(Math.min(res.length,briefs.length),briefs.length);}const us=[...new Set(res.map(c=>c.set?.id).filter(Boolean))];await Promise.all(us.map(s=>gSD(s)));for(const c of res)c._rd=sdc[c.set?.id]||"9999-01-01";res.sort((a,b)=>{if(a._rd!==b._rd)return a._rd.localeCompare(b._rd);return(parseInt(a.localId)||0)-(parseInt(b.localId)||0);});return res;}
let allSetsCache=null;async function fetchAllSets(){if(allSetsCache)return allSetsCache;const r=await fetch(`${API}/sets`);if(!r.ok)return[];const d=await r.json();allSetsCache=(Array.isArray(d)?d:[]).filter(s=>!/^[A-Z]/.test(s.id));return allSetsCache;}
async function fetchSet(si){const r=await fetch(`${API}/sets/${si}`);if(!r.ok)return null;return await r.json();}
let allPokemonCache=null;async function fetchAllPokemon(){if(allPokemonCache)return allPokemonCache;const r=await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");if(!r.ok)return[];const d=await r.json();allPokemonCache=(d.results||[]).map((p,i)=>({name:p.name,id:i+1}));return allPokemonCache;}

function dvL(dv){const p=[];if(Array.isArray(dv.stamp)&&dv.stamp.includes("1st-edition"))p.push("1st Ed.");else if(dv.subtype==="shadowless")p.push("Shadowless");else if(dv.subtype==="unlimited")p.push("Unlimited");else if(dv.subtype==="1999-2000-copyright")p.push("4th Print");else if(dv.subtype)p.push(dv.subtype);if(dv.type==="holo")p.push("Holo");else if(dv.type==="reverse")p.push("Reverse Holo");else if(dv.type==="normal"&&p.length===0)p.push("Normal");return p.join(" ")||"Normal";}

function explode(cards){
  const rows=[];
  for(let idx=0;idx<cards.length;idx++){
    const c=cards[idx];
    const tRaw=c.pricing?.tcgplayer||{};
    const cm=c.pricing?.cardmarket||{};
    const tv={};for(const[k,v]of Object.entries(tRaw)){if(typeof v==="object"&&v!==null&&k!=="updated"&&k!=="unit")tv[k]=v;}
    const mkTp=p=>p?{market:p.marketPrice,low:p.lowPrice,mid:p.midPrice,high:p.highPrice}:null;
    const mkCm=isR=>isR?(cm["avg-holo"]!=null?{avg:cm["avg-holo"],low:cm["low-holo"],trend:cm["trend-holo"]}:null):(cm.avg!=null?{avg:cm.avg,low:cm.low,trend:cm.trend}:null);
    const b={id:c.id,name:c.name,set:c.set?.name||"",setId:c.set?.id||"",localId:c.localId||"",rarity:c.rarity||"Unknown",
      image:c.image?c.image+"/low.webp":"",imageLarge:c.image?c.image+"/high.webp":"",
      artist:c.illustrator||"Unknown",category:c.category||"",hp:c.hp?String(c.hp):"",
      types:(c.types||[]).join(", "),stage:c.stage||"",dexId:c.dexId||[],variants:c.variants||{},
      releaseDate:c._rd||"9999-01-01",sortIndex:idx};
    const dvA=c.variants_detailed;
    if(Array.isArray(dvA)&&dvA.length>0){
      for(let i=0;i<dvA.length;i++){
        const dv=dvA[i],label=dvL(dv),uid=c.id+"::dv"+i;
        const isH=dv.type==="holo",isR=dv.type==="reverse",is1=Array.isArray(dv.stamp)&&dv.stamp.includes("1st-edition");
        let mp=null;if(is1&&isH)mp=tv["1st-edition-holofoil"];else if(is1&&!isH)mp=tv["1st-edition"];else if(isR)mp=tv["reverse-holofoil"];else if(isH)mp=tv["holofoil"]||tv["unlimited-holofoil"];else mp=tv["normal"]||tv["unlimited"];
        rows.push({...b,uid,variant:label,tcgplayer:mkTp(mp||null),cardmarket:mkCm(isR)});
      }continue;
    }
    const vk=Object.keys(tv);
    if(vk.length>0){for(const v of vk){const p=tv[v],isR=v.includes("reverse");rows.push({...b,uid:c.id+"::"+v,variant:VL[v]||v,tcgplayer:mkTp(p),cardmarket:mkCm(isR)});}continue;}
    rows.push({...b,uid:c.id+"::base",variant:"Normal",tcgplayer:null,cardmarket:mkCm(false)});
  }
  return rows;
}

function gPV(c,s){
  if(s==="tcgplayer"){const v=c.tcgplayer?.market??c.tcgplayer?.mid??null;if(v!=null)return v;}
  if(s==="cardmarket"){const v=c.cardmarket?.avg??null;if(v!=null)return v;}
  if(s==="tcgplayer"){const v=c.cardmarket?.avg??null;if(v!=null)return v;}
  if(s==="cardmarket"){const v=c.tcgplayer?.market??c.tcgplayer?.mid??null;if(v!=null)return v;}
  return null;
}
function gPVSrc(c,s){
  if(s==="tcgplayer"&&(c.tcgplayer?.market!=null||c.tcgplayer?.mid!=null))return"tcgplayer";
  if(s==="cardmarket"&&c.cardmarket?.avg!=null)return"cardmarket";
  if(s==="tcgplayer"&&c.cardmarket?.avg!=null)return"cardmarket";
  if(s==="cardmarket"&&(c.tcgplayer?.market!=null||c.tcgplayer?.mid!=null))return"tcgplayer";
  return null;
}

let GS={};function getG(n){return GS[n]||null;}function allG(){return Object.values(GS);}
function saveGLocal(key,label,icon,c,o,setId){GS[key]={key,label,icon,cards:c,owned:new Set(o),updatedAt:Date.now(),setId:setId||null};}
function rmGLocal(n){delete GS[n];}
function togGLocal(n,uid){const g=GS[n];if(!g)return new Set();g.owned.has(uid)?g.owned.delete(uid):g.owned.add(uid);g.updatedAt=Date.now();return new Set(g.owned);}

async function sbSaveGoal(uid,gk,label,icon,setId){await supabase.from("goals").upsert({user_id:uid,goal_key:gk,label,icon,set_id:setId,updated_at:new Date().toISOString()},{onConflict:"user_id,goal_key"});}
async function sbDeleteGoal(uid,gk){await supabase.from("goals").delete().eq("user_id",uid).eq("goal_key",gk);await supabase.from("owned_cards").delete().eq("user_id",uid).eq("goal_key",gk);}
async function sbSaveOwned(uid,gk,cardUid){await supabase.from("owned_cards").upsert({user_id:uid,goal_key:gk,card_uid:cardUid},{onConflict:"user_id,goal_key,card_uid"});}
async function sbRemoveOwned(uid,gk,cardUid){await supabase.from("owned_cards").delete().eq("user_id",uid).eq("goal_key",gk).eq("card_uid",cardUid);}
async function sbLoadGoals(uid){const{data}=await supabase.from("goals").select("*").eq("user_id",uid);return data||[];}
async function sbLoadOwnedCount(uid,gk){const{count}=await supabase.from("owned_cards").select("*",{count:"exact",head:true}).eq("user_id",uid).eq("goal_key",gk);return count||0;}
async function sbLoadOwned(uid,gk){const{data}=await supabase.from("owned_cards").select("card_uid").eq("user_id",uid).eq("goal_key",gk);return new Set((data||[]).map(r=>r.card_uid));}

const S={
  page:{background:"#0f1115",color:"#e8e8ec",minHeight:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:680,margin:"0 auto",WebkitTapHighlightColor:"transparent"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid #2a2d36",position:"sticky",top:0,background:"#0f1115",zIndex:100},
  content:{padding:"16px 16px 60px"},
  pill:a=>({padding:"8px 14px",borderRadius:99,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",background:a?"#6c5ce7":"#2a2d36",color:a?"#fff":"#7a7d88",minHeight:36,touchAction:"manipulation"}),
  pillSm:a=>({padding:"6px 12px",borderRadius:99,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:a?"#6c5ce7":"#2a2d36",color:a?"#fff":"#7a7d88",minHeight:32,touchAction:"manipulation"}),
  input:{width:"100%",padding:"14px 16px",borderRadius:12,border:"2px solid #2a2d36",background:"#181a20",color:"#e8e8ec",fontSize:16,outline:"none",boxSizing:"border-box"},
  btn:d=>({padding:"14px 20px",borderRadius:12,border:"none",background:"#6c5ce7",color:"#fff",fontWeight:700,fontSize:15,cursor:d?"wait":"pointer",opacity:d?0.6:1,touchAction:"manipulation",minHeight:48}),
  card:{background:"#181a20",borderRadius:14,border:"1px solid #2a2d36",padding:"14px 16px"},
};

function VB({variant}){let c=VBC[variant];if(!c){for(const[k,v]of Object.entries(VBC)){if(variant.includes(k)){c=v;break;}}}if(!c)c={bg:"rgba(42,45,54,0.5)",text:"#7a7d88"};return<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,background:c.bg,color:c.text,whiteSpace:"nowrap"}}>{variant}</span>;}
function GoalIcon({icon,setId,size}){if(icon&&icon.startsWith("http"))return<img src={icon} alt="" style={{width:size,height:size}}/>;if(setId)return<SetSymbol setId={setId} size={size}/>;return<span style={{fontSize:size*0.7}}>{icon||"📦"}</span>;}

// =============================================
// LANDING PAGE
// =============================================
const FEATURES = [
  { icon: "🔍", title: "Search Any Pokémon or Set", desc: "Find every card ever printed for your favorite Pokémon, or explore complete sets like Base Set, 151, or Obsidian Flames." },
  { icon: "💰", title: "Real Market Prices", desc: "Live pricing from TCGPlayer, Cardmarket, and eBay sold data — so you always know the real cost." },
  { icon: "✅", title: "Track What You Own", desc: "Check off cards as you collect them. See your completion percentage and what's left to finish." },
  { icon: "📊", title: "Know Your Cost to Complete", desc: "Instantly see how much it'll cost to finish your goal — broken down by owned value, missing cost, and full set value." },
];

const SCREENSHOTS = [
  { url: "/screenshots/image1_f.png", caption: "Every card. Every variant. Real prices." },
  { url: "/screenshots/image2.png", caption: "Track your progress and cost to complete." },
  { url: "/screenshots/image3.png", caption: "Tap any card for live sold prices." },
];

function LandingPage({ onAuth }) {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const authRef = useRef(null);

  const scrollToAuth = () => {
    setShowAuth(true);
    setTimeout(() => authRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmit = async () => {
    setLoading(true); setError(null); setMsg(null);
    if (mode === "login") {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (e) setError(e.message); else onAuth(data.user);
    } else {
      const { data, error: e } = await supabase.auth.signUp({ email, password: pass });
      if (e) setError(e.message);
      else if (data.user?.identities?.length === 0) setError("Account already exists. Try logging in.");
      else setMsg("Check your email to confirm your account, then log in.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#0f1115", color: "#e8e8ec", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Sticky nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", maxWidth: 680, margin: "0 auto", position: "sticky", top: 0, background: "#0f1115", zIndex: 100, borderBottom: "1px solid #2a2d36" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>CollecPath</span>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(108,92,231,0.12)", color: "#6c5ce7", fontWeight: 600 }}>BETA</span>
        </div>
        <button onClick={() => { setMode("login"); scrollToAuth(); }} style={{ background: "none", border: "none", color: "#7a7d88", fontSize: 13, fontWeight: 600, cursor: "pointer", touchAction: "manipulation", padding: "8px 0" }}>Log In</button>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", padding: "56px 0 44px" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2, margin: "0 0 16px", letterSpacing: "-0.5px" }}>
            Track the path to<br /><span style={{ color: "#6c5ce7" }}>completing your collection</span>
          </h1>
          <p style={{ fontSize: 16, color: "#7a7d88", lineHeight: 1.6, margin: "0 auto 32px", maxWidth: 460 }}>
            Search any Pokémon or set. See every card ever printed, check off what you own, and know exactly what's left to finish.
          </p>
          <button onClick={scrollToAuth} style={{ padding: "16px 32px", borderRadius: 14, border: "none", background: "#6c5ce7", color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", touchAction: "manipulation", boxShadow: "0 4px 24px rgba(108,92,231,0.35)" }}>
            Start Tracking — It's Free
          </button>
          <div style={{ marginTop: 12, fontSize: 13, color: "#555" }}>No credit card. No ads. Just cards.</div>
        </div>

        {/* Screenshots carousel */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
            {SCREENSHOTS.map((ss, i) => (
              <div key={i} style={{ flexShrink: 0, width: "80%", maxWidth: 300, scrollSnapAlign: "center" }}>
                <div style={{ background: "#181a20", borderRadius: 16, border: "1px solid #2a2d36", overflow: "hidden" }}>
                  <img src={ss.url} alt={ss.caption} style={{ width: "100%", display: "block", borderRadius: 16 }} />
                </div>
                <div style={{ fontSize: 13, color: "#7a7d88", textAlign: "center", marginTop: 10, fontWeight: 600 }}>{ss.caption}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 28 }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: "#181a20", borderRadius: 14, border: "1px solid #2a2d36", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e8ec", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#7a7d88", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 56, textAlign: "center" }}>
          {[
            { val: "900+", label: "Pokémon to track" },
            { val: "300+", label: "Sets supported" },
            { val: "Free", label: "Forever" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 8px", background: "#181a20", borderRadius: 14, border: "1px solid #2a2d36" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#6c5ce7" }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "#7a7d88", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Auth section */}
        <div ref={authRef} style={{ marginBottom: 60, scrollMarginTop: 80 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>Ready to start?</h2>
          <p style={{ fontSize: 14, color: "#7a7d88", textAlign: "center", marginBottom: 24 }}>Create a free account to save your collection across devices.</p>
          <div style={{ maxWidth: 380, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#181a20", borderRadius: 12, padding: 3 }}>
              <button onClick={() => { setMode("login"); setError(null); setMsg(null); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", background: mode === "login" ? "#6c5ce7" : "transparent", color: mode === "login" ? "#fff" : "#7a7d88", touchAction: "manipulation" }}>Log In</button>
              <button onClick={() => { setMode("signup"); setError(null); setMsg(null); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", background: mode === "signup" ? "#6c5ce7" : "transparent", color: mode === "signup" ? "#fff" : "#7a7d88", touchAction: "manipulation" }}>Sign Up</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#7a7d88", fontWeight: 600, marginBottom: 6 }}>Email</div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" type="email" style={S.input} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#7a7d88", fontWeight: 600, marginBottom: 6 }}>Password</div>
              <input value={pass} onChange={e => setPass(e.target.value)} placeholder={mode === "signup" ? "Min 6 characters" : "Your password"} type="password" style={S.input} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <button onClick={handleSubmit} disabled={loading || !email || !pass} style={{ ...S.btn(loading), width: "100%", fontSize: 16 }}>{loading ? "…" : mode === "login" ? "Log In" : "Create Account"}</button>
            {error && <div style={{ padding: 12, borderRadius: 10, background: "rgba(224,85,85,0.12)", color: "#e05555", fontSize: 13, marginTop: 16, textAlign: "center" }}>{error}</div>}
            {msg && <div style={{ padding: 12, borderRadius: 10, background: "rgba(108,92,231,0.12)", color: "#6c5ce7", fontSize: 13, marginTop: 16, textAlign: "center" }}>{msg}</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #2a2d36", padding: "24px 0 40px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: "#7a7d88" }}>CollecPath</span> — Track the journey. Complete the collection.
          </div>
          <a href="https://discord.gg/fS9yW6d9qB" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#6c5ce7", textDecoration: "none", fontWeight: 600 }}>Join our Discord</a>
          <div style={{ fontSize: 11, color: "#444", marginTop: 12 }}>Powered by TCGdex + PokeTrace</div>
        </div>
      </div>
    </div>
  );
}

// --- Modal with PokeTrace ---
function Modal({card,isOwned,onTog,onClose}){
  if(!card)return null;
  const[ptM,setPtM]=useState(null);const[ptL,setPtL]=useState(false);
  useEffect(()=>{if(!card)return;setPtM(null);setPtL(true);fetchPT(card.name,card.set).then(r=>{setPtM(bestMatch(r,card));setPtL(false);});},[card?.uid]);
  const eNM=ptM?.prices?.ebay?.NEAR_MINT;const eLP=ptM?.prices?.ebay?.LIGHTLY_PLAYED;
  const tNM=ptM?.prices?.tcgplayer?.NEAR_MINT;const tLP=ptM?.prices?.tcgplayer?.LIGHTLY_PLAYED;
  return(<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div onClick={e=>e.stopPropagation()} style={{background:"#181a20",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:440,maxHeight:"92vh",overflow:"auto",paddingBottom:"env(safe-area-inset-bottom,0px)",position:"relative"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px 4px"}}><div style={{width:36}}/><div style={{width:36,height:4,borderRadius:99,background:"#3a3d46"}}/><button onClick={onClose} style={{width:36,height:36,borderRadius:99,background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>×</button></div>
    <div style={{display:"flex",justifyContent:"center",padding:"8px 20px 12px"}}><img src={card.imageLarge||card.image} alt={card.name} style={{width:"55%",maxWidth:220,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}/></div>
    <div style={{padding:"0 20px 24px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><h2 style={{fontSize:19,fontWeight:800,color:"#e8e8ec",margin:0}}>{card.name}</h2><VB variant={card.variant}/></div>
      <div style={{fontSize:13,color:"#7a7d88",marginBottom:16}}>{card.set} · #{card.localId} · {card.rarity}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[{l:"Artist",v:card.artist},{l:"Type",v:card.types||"—"},{l:"HP",v:card.hp||"—"},{l:"Stage",v:card.stage||card.category||"—"}].map(m=>(<div key={m.l} style={{padding:"10px 12px",background:"#0f1115",borderRadius:10}}><div style={{fontSize:10,color:"#7a7d88",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{m.l}</div><div style={{fontSize:13,color:"#e8e8ec",fontWeight:600}}>{m.v}</div></div>))}
      </div>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{fontSize:13,color:"#e8e8ec",fontWeight:700}}>Market Prices</div>{ptL&&<div style={{width:14,height:14,border:"2px solid #6c5ce7",borderTopColor:"transparent",borderRadius:99,animation:"spin 0.8s linear infinite"}}/>}<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        {ptM?(<>
          <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#7a7d88",fontWeight:600,marginBottom:6}}>TCGPlayer</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Near Mint</div><div style={{fontSize:18,fontWeight:800,color:tNM?"#e8e8ec":"#555"}}>{tNM?f$(tNM.avg):"—"}</div>{tNM&&<div style={{fontSize:9,color:"#7a7d88"}}>{tNM.saleCount} sales · Low {f$(tNM.low)}</div>}</div>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Lightly Played</div><div style={{fontSize:18,fontWeight:800,color:tLP?"#e8e8ec":"#555"}}>{tLP?f$(tLP.avg):"—"}</div>{tLP&&<div style={{fontSize:9,color:"#7a7d88"}}>{tLP.saleCount} sales · Low {f$(tLP.low)}</div>}</div>
          </div></div>
          <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#7a7d88",fontWeight:600,marginBottom:6}}>eBay Sold</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Near Mint</div><div style={{fontSize:18,fontWeight:800,color:eNM?"#e8e8ec":"#555"}}>{eNM?f$(eNM.avg):"—"}</div>{eNM&&<div style={{fontSize:9,color:"#7a7d88"}}>{eNM.saleCount} sales · Low {f$(eNM.low)}</div>}</div>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Lightly Played</div><div style={{fontSize:18,fontWeight:800,color:eLP?"#e8e8ec":"#555"}}>{eLP?f$(eLP.avg):"—"}</div>{eLP&&<div style={{fontSize:9,color:"#7a7d88"}}>{eLP.saleCount} sales · Low {f$(eLP.low)}</div>}</div>
          </div></div>
          <div style={{fontSize:9,color:"#444",textAlign:"right"}}>Matched: {ptM.set?.name} · {ptM.variant} · {new Date(ptM.lastUpdated).toLocaleDateString()}</div>
        </>):!ptL?(<div style={{padding:16,background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:13,color:"#555"}}>No live pricing available</div></div>):null}
      </div>
      <button onClick={onTog} style={{width:"100%",padding:"16px",borderRadius:12,border:"none",fontSize:15,fontWeight:700,cursor:"pointer",background:isOwned?"rgba(224,85,85,0.15)":"#6c5ce7",color:isOwned?"#e05555":"#fff",minHeight:52,touchAction:"manipulation"}}>{isOwned?"Mark as Missing":"Mark as Owned"}</button>
    </div>
  </div></div>);
}

function CRow({card,isOwned,onTog,onImg,ps}){
  const price=gPV(card,ps);const src=gPVSrc(card,ps);const isFB=src&&src!==ps;const dp=price!=null?fP(price,src||ps):null;
  return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,background:isOwned?"rgba(108,92,231,0.1)":"#181a20",border:"1px solid #2a2d36",opacity:isOwned?0.65:1}}>
    <div onClick={onTog} style={{width:28,height:28,borderRadius:8,border:isOwned?"2px solid #6c5ce7":"2px solid #2a2d36",background:isOwned?"#6c5ce7":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",touchAction:"manipulation"}}>{isOwned&&<span style={{color:"#fff",fontSize:15,fontWeight:700}}>✓</span>}</div>
    <img src={card.image} alt={card.name} onClick={onImg} style={{width:44,height:62,borderRadius:5,objectFit:"cover",flexShrink:0,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}} loading="lazy"/>
    <div onClick={onImg} style={{flex:1,minWidth:0,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:700,color:"#e8e8ec",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100% - 80px)"}}>{card.name}</span><VB variant={card.variant}/></div><div style={{fontSize:12,color:"#7a7d88"}}>{card.set} · #{card.localId} · {card.rarity}</div></div>
    <div onClick={onImg} style={{textAlign:"right",flexShrink:0,minWidth:55,cursor:"pointer"}}><div style={{fontSize:14,fontWeight:700,color:isOwned?"#7a7d88":"#e8e8ec",textDecoration:isOwned?"line-through":"none"}}>{dp||"—"}</div>{isFB&&<div style={{fontSize:9,color:"#555"}}>{src==="cardmarket"?"€ CM":"$ TCP"}</div>}{price==null&&<div style={{fontSize:10,color:"#555"}}>No data</div>}</div>
  </div>);
}

function GCard({goal,onClick,onRm,ps}){
  const{label,icon,cards:cc,owned:oo,setId,ownedCount}=goal;
  const tot=cc.length;const oc=oo.size>0?oo.size:(ownedCount||0);const pct=tot>0?Math.round((oc/tot)*100):(ownedCount>0?null:0);
  const ctc=cc.length>0?cc.filter(c=>!oo.has(c.uid)).reduce((s,c)=>s+(gPV(c,ps)||0),0):null;
  return(<div onClick={onClick} style={{position:"relative",minWidth:160,maxWidth:200,padding:"14px 16px",borderRadius:14,background:"#181a20",border:"1px solid #2a2d36",cursor:"pointer",flexShrink:0,touchAction:"manipulation"}}>
    <button onClick={e=>{e.stopPropagation();onRm();}} style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:99,background:"#2a2d36",border:"none",color:"#7a7d88",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><GoalIcon icon={icon} setId={setId} size={36}/><div><div style={{fontSize:14,fontWeight:800,color:"#e8e8ec",textTransform:"capitalize"}}>{label}</div></div></div>
    <div style={{height:5,borderRadius:99,background:"#2a2d36",marginBottom:8,overflow:"hidden"}}><div style={{height:"100%",width:`${pct!=null?pct:0}%`,background:pct===100?"#2ecc71":"#6c5ce7",borderRadius:99}}/></div>
    <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:"#6c5ce7"}}>{tot>0?`${oc}/${tot}`:`${oc} owned`}</span>{ctc!=null&&ctc>0?<span style={{fontSize:12,color:"#e05555",fontWeight:600}}>{fP(ctc,ps)}</span>:<span style={{fontSize:10,color:"#7a7d88"}}>{pct!=null?`${pct}%`:"Tap to load"}</span>}</div>
  </div>);
}

function PokeSearch({onSelect,loading}){const[q,setQ]=useState("");const[pokes,setPokes]=useState([]);const[ll,setLl]=useState(false);const[focused,setFocused]=useState(false);useEffect(()=>{setLl(true);fetchAllPokemon().then(p=>{setPokes(p);setLl(false);});},[]);const filtered=q.trim().length>=2?pokes.filter(p=>p.name.includes(q.toLowerCase())).slice(0,10):[];const showDrop=focused&&filtered.length>0;const submit=name=>{onSelect(name);setQ("");};
  return(<div style={{position:"relative"}}><label style={{fontSize:13,fontWeight:600,color:"#7a7d88",marginBottom:8,display:"block"}}>Search a Pokémon</label><input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)} onKeyDown={e=>{if(e.key==="Enter"&&filtered.length>0)submit(filtered[0].name);else if(e.key==="Enter"&&q.trim())submit(q.trim());}} placeholder={ll?"Loading Pokémon…":"e.g. Jigglypuff, Charizard, Eevee…"} disabled={ll||loading} style={{...S.input,opacity:ll?0.5:1}}/>
    {showDrop&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,marginTop:4,background:"#1e2028",border:"1px solid #2a2d36",borderRadius:12,maxHeight:280,overflow:"auto",boxShadow:"0 12px 40px rgba(0,0,0,0.5)"}}>{filtered.map(p=>(<div key={p.id} onClick={()=>submit(p.name)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #2a2d36",touchAction:"manipulation"}} onMouseEnter={e=>e.currentTarget.style.background="#252830"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`} alt="" style={{width:32,height:32,imageRendering:"pixelated"}}/><div><div style={{fontSize:14,fontWeight:600,color:"#e8e8ec",textTransform:"capitalize"}}>{p.name}</div><div style={{fontSize:11,color:"#7a7d88"}}>#{String(p.id).padStart(4,"0")}</div></div></div>))}</div>)}
  </div>);
}

function SetSearch({onSelect,loading}){const[q,setQ]=useState("");const[sets,setSets]=useState([]);const[ll,setLl]=useState(false);const[focused,setFocused]=useState(false);useEffect(()=>{setLl(true);fetchAllSets().then(s=>{setSets(s);setLl(false);});},[]);const filtered=q.trim()?sets.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())).slice(0,12):[];const showDrop=focused&&filtered.length>0;
  return(<div style={{position:"relative"}}><label style={{fontSize:13,fontWeight:600,color:"#7a7d88",marginBottom:8,display:"block"}}>Search a set</label><input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)} placeholder={ll?"Loading sets…":"e.g. 151, Obsidian Flames, Base Set…"} disabled={ll||loading} style={{...S.input,opacity:ll?0.5:1}}/>
    {showDrop&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,marginTop:4,background:"#1e2028",border:"1px solid #2a2d36",borderRadius:12,maxHeight:320,overflow:"auto",boxShadow:"0 12px 40px rgba(0,0,0,0.5)"}}>{filtered.map(s=>{const symUrl=tcgdexIdToSymbolUrl(s.id);return(<div key={s.id} onClick={()=>{onSelect(s);setQ("");setFocused(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer",borderBottom:"1px solid #2a2d36",touchAction:"manipulation"}} onMouseEnter={e=>e.currentTarget.style.background="#252830"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{symUrl?<img src={symUrl} alt="" style={{width:24,height:24,objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>:<span style={{fontSize:18}}>📦</span>}<div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#e8e8ec"}}>{s.name}</div><div style={{fontSize:11,color:"#7a7d88"}}>{s.cardCount?.total||"?"} cards</div></div></div>)})}</div>)}
  </div>);
}

// --- Main App ---
export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[view,setView]=useState("home");const[mode,setMode]=useState("pokemon");
  const[loading,setLoading]=useState(false);const[progress,setProgress]=useState(null);const[error,setError]=useState(null);
  const[goalKey,setGoalKey]=useState(null);const[goalLabel,setGoalLabel]=useState("");const[goalIcon,setGoalIcon]=useState("📦");const[goalSetId,setGoalSetId]=useState(null);
  const[cards,setCards]=useState([]);const[baseCt,setBaseCt]=useState(0);const[owned,setOwned]=useState(new Set());
  const[ps,setPs]=useState("tcgplayer");
  const[filter,setFilter]=useState("all");const[vf,setVf]=useState("all");const[sort,setSort]=useState("set");
  const[goals,setGoals]=useState([]);const[detail,setDetail]=useState(null);const[syncStatus,setSyncStatus]=useState("");

  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{const u=session?.user||null;setUser(u);setAuthLoading(false);if(u)window.history.replaceState({collecpathView:"app"},"");});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{const u=session?.user||null;setUser(u);if(u)window.history.pushState({collecpathView:"app"},"");});return()=>subscription.unsubscribe();},[]);

  useEffect(()=>{if(!user)return;setSyncStatus("Syncing…");sbLoadGoals(user.id).then(async dbGoals=>{GS={};for(const g of dbGoals){const oc=await sbLoadOwnedCount(user.id,g.goal_key);GS[g.goal_key]={key:g.goal_key,label:g.label,icon:g.icon||"📦",cards:[],owned:new Set(),updatedAt:new Date(g.updated_at).getTime(),setId:g.set_id||null,needsCards:true,ownedCount:oc};}setGoals([...allG()]);setSyncStatus("");});},[user]);

  const rG=()=>setGoals([...allG()]);

  const openGoal=(key,label,icon,cardData,ownedSet,setId)=>{setGoalKey(key);setGoalLabel(label);setGoalIcon(icon);setGoalSetId(setId||null);setCards(cardData);setBaseCt(new Set(cardData.map(c=>c.id)).size);setOwned(ownedSet);
    const tcgCt=cardData.filter(c=>c.tcgplayer&&c.tcgplayer.market!=null).length;const cmCt=cardData.filter(c=>c.cardmarket&&c.cardmarket.avg!=null).length;if(cmCt>tcgCt)setPs("cardmarket");else setPs("tcgplayer");
    setFilter("all");setVf("all");setSort("set");setView("results");
    window.history.pushState({collecpathView:"results"},"");};

  const loadGoalCards=async goal=>{
    if(goal.needsCards||goal.cards.length===0){setLoading(true);setProgress(null);
      try{let cardData=[];
        if(goal.key.startsWith("poke::")){const pn=goal.key.replace("poke::","");const br=await gBriefs(pn);const brF=br.filter(b=>!/^[A-Z]/.test(b.id.split("-")[0]));setProgress({c:0,t:brF.length});const full=await gAll(brF,(c,t)=>setProgress({c,t}));cardData=explode(full);}
        else if(goal.key.startsWith("set::")){const si=goal.key.replace("set::","");const sd=await fetchSet(si);if(sd?.cards){setProgress({c:0,t:sd.cards.length});const full=await gAll(sd.cards,(c,t)=>setProgress({c,t}));full.sort((a,b)=>(parseInt(a.localId)||0)-(parseInt(b.localId)||0));for(let i=0;i<full.length;i++)full[i]._rd=sd.releaseDate||"9999-01-01";cardData=explode(full);}}
        goal.cards=cardData;goal.needsCards=false;const ownedSet=await sbLoadOwned(user.id,goal.key);goal.owned=ownedSet;rG();openGoal(goal.key,goal.label,goal.icon,cardData,ownedSet,goal.setId);
      }catch(e){setError("Failed to load cards.");console.error(e);}setLoading(false);setProgress(null);
    }else{openGoal(goal.key,goal.label,goal.icon,goal.cards,goal.owned,goal.setId);}
  };

  const doPokeSearch=async q=>{setLoading(true);setError(null);setProgress(null);
    try{const pk=await sPoke(q);if(!pk){setError(`Couldn't find "${q}".`);setLoading(false);return;}
      const key="poke::"+pk.name;const ex=getG(key);if(ex&&ex.cards.length>0){await loadGoalCards(ex);setLoading(false);return;}
      const br=await gBriefs(pk.name);const brF=br.filter(b=>!/^[A-Z]/.test(b.id.split("-")[0]));if(brF.length===0){setError(`No physical cards found for "${pk.name}".`);setLoading(false);return;}
      setProgress({c:0,t:brF.length});const full=await gAll(brF,(c,t)=>setProgress({c,t}));const ex2=explode(full);
      saveGLocal(key,pk.name,pk.sprite,ex2,new Set(),null);if(user)await sbSaveGoal(user.id,key,pk.name,pk.sprite,null);rG();openGoal(key,pk.name,pk.sprite,ex2,new Set(),null);
    }catch(e){setError("Something went wrong.");console.error(e);}setLoading(false);setProgress(null);};

  const doSetSearch=async si=>{setLoading(true);setError(null);setProgress(null);
    try{const key="set::"+si.id;const ex=getG(key);if(ex&&ex.cards.length>0){await loadGoalCards(ex);setLoading(false);return;}
      const sd=await fetchSet(si.id);if(!sd?.cards?.length){setError(`No cards found for "${si.name}".`);setLoading(false);return;}
      setProgress({c:0,t:sd.cards.length});const full=await gAll(sd.cards,(c,t)=>setProgress({c,t}));full.sort((a,b)=>(parseInt(a.localId)||0)-(parseInt(b.localId)||0));for(let i=0;i<full.length;i++)full[i]._rd=sd.releaseDate||"9999-01-01";
      const ex2=explode(full);saveGLocal(key,si.name,"📦",ex2,new Set(),si.id);if(user)await sbSaveGoal(user.id,key,si.name,"📦",si.id);rG();openGoal(key,si.name,"📦",ex2,new Set(),si.id);
    }catch(e){setError("Something went wrong.");console.error(e);}setLoading(false);setProgress(null);};

  const selG=g=>loadGoalCards(g);
  const tog=async uid=>{if(!goalKey)return;const g=GS[goalKey];if(!g)return;const was=g.owned.has(uid);const next=togGLocal(goalKey,uid);setOwned(new Set(next));rG();if(user){if(was)sbRemoveOwned(user.id,goalKey,uid);else sbSaveOwned(user.id,goalKey,uid);}};
  const rmGoal=async key=>{rmGLocal(key);rG();if(user)await sbDeleteGoal(user.id,key);};

  const goHome=(pushState=true)=>{setView("home");setCards([]);setGoalKey(null);setError(null);setFilter("all");setVf("all");if(pushState&&window.history.state?.collecpathView==="results"){window.history.back();}};

  // Browser back button support
  useEffect(()=>{const onPop=(e)=>{if(view==="results"){e.preventDefault();goHome(false);}else if(user&&view==="home"){e.preventDefault();signOut();}};window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop);},[view,user]);

  const signOut=async()=>{await supabase.auth.signOut();GS={};setGoals([]);setView("home");setCards([]);};

  const vOpts=[...new Set(cards.map(c=>c.variant))].sort();
  const sorted=[...cards].sort((a,b)=>{if(sort==="price-desc")return(gPV(b,ps)||0)-(gPV(a,ps)||0);if(sort==="price-asc")return(gPV(a,ps)||0)-(gPV(b,ps)||0);if(sort==="rarity")return(a.rarity||"").localeCompare(b.rarity||"");return a.sortIndex-b.sortIndex;});
  const filt=sorted.filter(c=>{if(filter==="owned"&&!owned.has(c.uid))return false;if(filter==="missing"&&owned.has(c.uid))return false;if(vf!=="all"&&c.variant!==vf)return false;return true;});
  const tot=cards.length,oc=owned.size,pct=tot>0?Math.round((oc/tot)*100):0;
  const cO=cards.filter(c=>owned.has(c.uid)).reduce((s,c)=>s+(gPV(c,ps)||0),0);
  const cM=cards.filter(c=>!owned.has(c.uid)).reduce((s,c)=>s+(gPV(c,ps)||0),0);

  if(authLoading)return<div style={S.page}><div style={{padding:60,textAlign:"center",color:"#7a7d88"}}>Loading…</div></div>;
  if(!user)return<LandingPage onAuth={setUser}/>;

  return(
    <div style={S.page}>
      <div style={S.header}>
        <div onClick={goHome} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8,touchAction:"manipulation"}}><span style={{fontSize:20,fontWeight:800,color:"#e8e8ec"}}>CollecPath</span><span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"rgba(108,92,231,0.12)",color:"#6c5ce7",fontWeight:600}}>BETA</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}><a href="https://discord.gg/fS9yW6d9qB" target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#7a7d88",textDecoration:"none",padding:"6px 10px",borderRadius:8,border:"1px solid #2a2d36",touchAction:"manipulation"}}>Discord</a><button onClick={signOut} style={{background:"none",border:"1px solid #2a2d36",borderRadius:8,padding:"6px 12px",color:"#7a7d88",fontSize:11,cursor:"pointer",touchAction:"manipulation"}}>Sign Out</button></div>
      </div>
      <div style={S.content}>
        {view==="home"&&(<>
          {syncStatus&&<div style={{textAlign:"center",padding:8,color:"#6c5ce7",fontSize:12,marginBottom:8}}>{syncStatus}</div>}
          {goals.length>0&&(<div style={{marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><h3 style={{fontSize:15,fontWeight:800,color:"#e8e8ec",margin:0}}>Your Goals</h3><span style={{fontSize:12,color:"#7a7d88"}}>{goals.length} active</span></div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,WebkitOverflowScrolling:"touch"}}>{goals.sort((a,b)=>b.updatedAt-a.updatedAt).map(g=>(<GCard key={g.key} goal={g} onClick={()=>selG(g)} onRm={()=>rmGoal(g.key)} ps={ps}/>))}</div>
          </div>)}
          <div style={{marginBottom:20}}><h2 style={{fontSize:21,fontWeight:800,marginBottom:4}}>{goals.length>0?"Start a new goal":"What are you collecting?"}</h2><p style={{fontSize:14,color:"#7a7d88",margin:0}}>{goals.length>0?"Add another goal to track.":"Pick your goal. We'll show you the path."}</p></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {MODES.map(m=>(<button key={m.id} onClick={()=>setMode(m.id)} style={{background:mode===m.id?"rgba(108,92,231,0.12)":"#181a20",border:mode===m.id?"2px solid #6c5ce7":"2px solid #2a2d36",borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"left",touchAction:"manipulation"}}><div style={{fontSize:24,marginBottom:6}}>{m.icon}</div><div style={{fontSize:15,fontWeight:700,color:"#e8e8ec",marginBottom:4}}>{m.label}</div><div style={{fontSize:12,color:"#7a7d88",lineHeight:1.4}}>{m.desc}</div></button>))}
          </div>
          {mode==="pokemon"&&<PokeSearch onSelect={doPokeSearch} loading={loading}/>}
          {mode==="set"&&<SetSearch onSelect={doSetSearch} loading={loading}/>}
          {loading&&progress&&(<div style={{marginTop:12}}><div style={{fontSize:12,color:"#7a7d88",marginBottom:4}}>Loading card details… {progress.c}/{progress.t}</div><div style={{height:4,borderRadius:99,background:"#2a2d36",overflow:"hidden"}}><div style={{height:"100%",width:`${(progress.c/progress.t)*100}%`,background:"#6c5ce7",borderRadius:99,transition:"width 0.3s"}}/></div></div>)}
          {error&&<div style={{padding:14,borderRadius:10,background:"rgba(224,85,85,0.12)",color:"#e05555",fontSize:13,marginTop:12}}>{error}</div>}
          <div style={{marginTop:16,padding:"8px 12px",background:"#181a20",borderRadius:8,border:"1px solid #2a2d36"}}><span style={{fontSize:11,color:"#7a7d88"}}>Powered by </span><span style={{fontSize:11,color:"#6c5ce7",fontWeight:600}}>TCGdex</span><span style={{fontSize:11,color:"#7a7d88"}}> + </span><span style={{fontSize:11,color:"#6c5ce7",fontWeight:600}}>PokeTrace</span></div>
        </>)}
        {view==="results"&&(<>
          <button onClick={goHome} style={{background:"none",border:"none",color:"#6c5ce7",cursor:"pointer",fontSize:13,fontWeight:600,padding:"4px 0",marginBottom:12,touchAction:"manipulation"}}>← Your Goals</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"12px 14px",...S.card}}><GoalIcon icon={goalIcon} setId={goalSetId} size={48}/><div><div style={{fontSize:18,fontWeight:800,color:"#e8e8ec",textTransform:"capitalize"}}>{goalLabel}</div><div style={{fontSize:12,color:"#7a7d88"}}>{cards.length} variants · {baseCt} cards</div></div></div>
          <div style={{display:"flex",gap:6,marginBottom:14}}>{PSRC.map(s=>(<button key={s.id} onClick={()=>setPs(s.id)} style={{padding:"8px 14px",borderRadius:99,border:ps===s.id?"2px solid #6c5ce7":"2px solid #2a2d36",background:ps===s.id?"rgba(108,92,231,0.12)":"transparent",cursor:"pointer",fontSize:12,fontWeight:600,color:ps===s.id?"#6c5ce7":"#7a7d88",touchAction:"manipulation"}}>{s.label} · {s.sub}</button>))}</div>
          <div style={{...S.card,padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:700,color:"#e8e8ec"}}>Completion</span><span style={{fontSize:13,fontWeight:700,color:"#6c5ce7"}}>{oc}/{tot} ({pct}%)</span></div>
            <div style={{height:7,borderRadius:99,background:"#2a2d36",marginBottom:14,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct===100?"#2ecc71":"#6c5ce7",borderRadius:99,transition:"width 0.4s"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
              <div style={{padding:"10px 4px",background:"#0f1115",borderRadius:10}}><div style={{fontSize:16,fontWeight:800,color:"#e8e8ec"}}>{fP(cO,ps)}</div><div style={{fontSize:10,color:"#7a7d88",marginTop:2}}>Owned Value</div></div>
              <div style={{padding:"10px 4px",background:"#0f1115",borderRadius:10}}><div style={{fontSize:16,fontWeight:800,color:"#e05555"}}>{fP(cM,ps)}</div><div style={{fontSize:10,color:"#7a7d88",marginTop:2}}>To Complete</div></div>
              <div style={{padding:"10px 4px",background:"#0f1115",borderRadius:10}}><div style={{fontSize:16,fontWeight:800,color:"#6c5ce7"}}>{fP(cO+cM,ps)}</div><div style={{fontSize:10,color:"#7a7d88",marginTop:2}}>Full Value</div></div>
            </div>
            <div style={{fontSize:9,color:"#444",textAlign:"right",marginTop:6}}>Estimates from TCGdex · Tap a card for live prices</div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8}}>
              <div style={{display:"flex",gap:4,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>{["all","owned","missing"].map(fl=>(<button key={fl} onClick={()=>setFilter(fl)} style={S.pill(filter===fl)}>{fl==="all"?`All (${tot})`:fl.charAt(0).toUpperCase()+fl.slice(1)}</button>))}</div>
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"8px 10px",borderRadius:8,border:"1px solid #2a2d36",background:"#181a20",color:"#e8e8ec",fontSize:12,minHeight:36}}><option value="set">Sort: {goalKey?.startsWith("set::")?"Card #":"Set"}</option><option value="price-desc">Price ↓</option><option value="price-asc">Price ↑</option><option value="rarity">Rarity</option></select>
            </div>
            {vOpts.length>1&&(<div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}><button onClick={()=>setVf("all")} style={S.pillSm(vf==="all")}>All variants</button>{vOpts.map(v=>(<button key={v} onClick={()=>setVf(v)} style={S.pillSm(vf===v)}>{v}</button>))}</div>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {filt.length===0&&<div style={{textAlign:"center",padding:40,color:"#7a7d88",fontSize:14}}>{filter==="owned"?"Tap the checkbox on any card to mark it owned.":"No cards to show."}</div>}
            {filt.map(c=>(<CRow key={c.uid} card={c} isOwned={owned.has(c.uid)} onTog={()=>tog(c.uid)} onImg={()=>setDetail(c)} ps={ps}/>))}
          </div>
        </>)}
      </div>
      <Modal card={detail} isOwned={detail?owned.has(detail.uid):false} onTog={()=>{if(detail)tog(detail.uid);}} onClose={()=>setDetail(null)}/>
    </div>
  );
}