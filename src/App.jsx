import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const MODES = [
  { id: "pokemon", label: "Single Pokémon", desc: "Every card featuring one Pokémon", icon: "🔍", ready: true },
  { id: "set", label: "Master Set", desc: "Complete a full set like 151", icon: "📦", ready: true },
  { id: "rarity", label: "Full Arts / Rarity", desc: "Filter by rarity across all sets", icon: "✨", ready: false },
  { id: "custom", label: "Custom List", desc: "Paste your own list of cards", icon: "📋", ready: false },
];
const VL = { normal:"Normal",holofoil:"Holo","reverse-holofoil":"Reverse Holo","1st-edition-holofoil":"1st Ed. Holo","1st-edition":"1st Edition","unlimited-holofoil":"Unlimited Holo",unlimited:"Unlimited",shadowless:"Shadowless" };
const VBC = { "Holo":{bg:"rgba(255,215,0,0.15)",text:"#ffd700"},"Reverse Holo":{bg:"rgba(0,200,255,0.15)",text:"#00c8ff"},"1st Ed.":{bg:"rgba(255,100,100,0.15)",text:"#ff6464"},"1st Edition":{bg:"rgba(255,100,100,0.15)",text:"#ff6464"},"Shadowless":{bg:"rgba(255,180,50,0.15)",text:"#ffb432"},"Unlimited":{bg:"rgba(150,150,150,0.15)",text:"#aaa"},"4th Print":{bg:"rgba(150,200,150,0.15)",text:"#8bc48b"} };
const f$=v=>v!=null?`$${v.toFixed(2)}`:"—";
const fE=v=>v!=null?`€${v.toFixed(2)}`:"—";
const API="https://api.tcgdex.net/v2/en";
let sdc={};

function tcgdexIdToSymbolUrl(setId){if(!setId)return null;let id=setId;id=id.replace(/([a-z])0+(\d)/gi,"$1$2");id=id.replace(/\./g,"pt");return `https://images.pokemontcg.io/${id}/symbol.png`;}
function SetSymbol({setId,size}){const[err,setErr]=useState(false);const url=tcgdexIdToSymbolUrl(setId);if(err||!url)return <span style={{fontSize:size*0.7}}>📦</span>;return <img src={url} alt="" style={{width:size,height:size,objectFit:"contain"}} onError={()=>setErr(true)}/>;}

// --- PokeTrace ---
async function fetchPT(cardName,setName){try{const q=encodeURIComponent(cardName+" "+setName);const r=await fetch(`/api/poketrace/cards?search=${q}&market=US&limit=10`);if(!r.ok)return[];const d=await r.json();return d.data||[];}catch{return[];}}
function bestMatch(ptCards,card){
  const num=String(card.localId).replace(/^0+/,"");const setName=(card.set||"").toLowerCase();
  let best=null,bestScore=-1;
  for(const pt of ptCards){if(pt.name?.includes("Japanese"))continue;let score=0;const ptNum=(pt.cardNumber?.split("/")?.[0]||"").replace(/^0+/,"");if(ptNum===num)score+=10;const ptSet=(pt.set?.name||"").toLowerCase();if(ptSet.includes(setName)||setName.includes(ptSet.replace("sv: scarlet & violet ","").replace("swsh: sword & shield ","")))score+=5;const ptVar=(pt.variant||"").toLowerCase();const ourVar=(card.variant||"").toLowerCase();if(ourVar.includes("1st")&&ptVar.includes("1st"))score+=3;else if(ourVar.includes("shadowless")&&(ptSet.includes("shadowless")||ptVar.includes("unlimited")))score+=3;else if(ourVar.includes("reverse")&&ptVar.includes("reverse"))score+=3;else if(ourVar.includes("holo")&&ptVar.includes("holo")&&!ptVar.includes("reverse"))score+=2;else if(ourVar.includes("normal")&&(ptVar.includes("normal")||ptVar===""))score+=2;if(score>bestScore){bestScore=score;best=pt;}}
  return best;
}

// --- TCGdex ---
async function gSD(sid){if(sdc[sid])return sdc[sid];try{const r=await fetch(`${API}/sets/${sid}`);if(!r.ok)return null;const d=await r.json();sdc[sid]=d.releaseDate||null;return sdc[sid];}catch{return null;}}
async function sPoke(q){const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${q.toLowerCase().trim()}`);if(!r.ok)return null;const d=await r.json();return{name:d.name,id:d.id,sprite:d.sprites.other["official-artwork"].front_default||d.sprites.front_default};}
async function gBriefs(name){const r=await fetch(`${API}/cards?name=${encodeURIComponent(name)}`);if(!r.ok)return[];const d=await r.json();return Array.isArray(d)?d:[];}
async function gCard(id){const r=await fetch(`${API}/cards/${id}`);if(!r.ok)return null;return await r.json();}
async function gAll(briefs,onP){const res=[],bs=10;for(let i=0;i<briefs.length;i+=bs){const batch=briefs.slice(i,i+bs);const det=await Promise.all(batch.map(b=>gCard(b.id)));res.push(...det.filter(Boolean));if(onP)onP(Math.min(res.length,briefs.length),briefs.length);}const us=[...new Set(res.map(c=>c.set?.id).filter(Boolean))];await Promise.all(us.map(s=>gSD(s)));for(const c of res)c._rd=sdc[c.set?.id]||"9999-01-01";res.sort((a,b)=>{if(a._rd!==b._rd)return a._rd.localeCompare(b._rd);return(parseInt(a.localId)||0)-(parseInt(b.localId)||0);});return res;}
let allSetsCache=null;async function fetchAllSets(){if(allSetsCache)return allSetsCache;const r=await fetch(`${API}/sets`);if(!r.ok)return[];const d=await r.json();allSetsCache=(Array.isArray(d)?d:[]).filter(s=>!/^[A-Z]/.test(s.id));return allSetsCache;}
async function fetchSet(setId){const r=await fetch(`${API}/sets/${setId}`);if(!r.ok)return null;return await r.json();}
let allPokemonCache=null;async function fetchAllPokemon(){if(allPokemonCache)return allPokemonCache;const r=await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");if(!r.ok)return[];const d=await r.json();allPokemonCache=(d.results||[]).map((p,i)=>({name:p.name,id:i+1}));return allPokemonCache;}

// --- Variants ---
function dvL(dv){const p=[];if(Array.isArray(dv.stamp)&&dv.stamp.includes("1st-edition"))p.push("1st Ed.");else if(dv.subtype==="shadowless")p.push("Shadowless");else if(dv.subtype==="unlimited")p.push("Unlimited");else if(dv.subtype==="1999-2000-copyright")p.push("4th Print");else if(dv.subtype)p.push(dv.subtype);if(dv.type==="holo")p.push("Holo");else if(dv.type==="reverse")p.push("Reverse Holo");else if(dv.type==="normal"&&p.length===0)p.push("Normal");return p.join(" ")||"Normal";}
function explode(cards){const rows=[];for(let idx=0;idx<cards.length;idx++){const c=cards[idx],tRaw=c.pricing?.tcgplayer||{};const tv={};for(const[k,v]of Object.entries(tRaw)){if(typeof v==="object"&&v!==null&&k!=="updated"&&k!=="unit")tv[k]=v;}const b={id:c.id,name:c.name,set:c.set?.name||"",setId:c.set?.id||"",localId:c.localId||"",rarity:c.rarity||"Unknown",image:c.image?c.image+"/low.webp":"",imageLarge:c.image?c.image+"/high.webp":"",artist:c.illustrator||"Unknown",category:c.category||"",hp:c.hp?String(c.hp):"",types:(c.types||[]).join(", "),stage:c.stage||"",dexId:c.dexId||[],variants:c.variants||{},releaseDate:c._rd||"9999-01-01",sortIndex:idx};const dvA=c.variants_detailed;if(Array.isArray(dvA)&&dvA.length>0){for(let i=0;i<dvA.length;i++)rows.push({...b,uid:c.id+"::dv"+i,variant:dvL(dvA[i])});continue;}const vk=Object.keys(tv);if(vk.length>0){for(const v of vk)rows.push({...b,uid:c.id+"::"+v,variant:VL[v]||v});continue;}rows.push({...b,uid:c.id+"::base",variant:"Normal"});}return rows;}

// --- In-memory goal store (syncs with Supabase) ---
let GS={};function getG(n){return GS[n]||null;}function allG(){return Object.values(GS);}
function saveGLocal(key,label,icon,c,o,setId){GS[key]={key,label,icon,cards:c,owned:new Set(o),updatedAt:Date.now(),setId:setId||null};}
function rmGLocal(n){delete GS[n];}
function togGLocal(n,uid){const g=GS[n];if(!g)return new Set();g.owned.has(uid)?g.owned.delete(uid):g.owned.add(uid);g.updatedAt=Date.now();return new Set(g.owned);}

// --- Supabase sync ---
async function sbSaveGoal(userId,goalKey,label,icon,setId){
  await supabase.from("goals").upsert({user_id:userId,goal_key:goalKey,label,icon,set_id:setId,updated_at:new Date().toISOString()},{onConflict:"user_id,goal_key"});
}
async function sbDeleteGoal(userId,goalKey){
  await supabase.from("goals").delete().eq("user_id",userId).eq("goal_key",goalKey);
  await supabase.from("owned_cards").delete().eq("user_id",userId).eq("goal_key",goalKey);
}
async function sbSaveOwned(userId,goalKey,cardUid){
  await supabase.from("owned_cards").upsert({user_id:userId,goal_key:goalKey,card_uid:cardUid},{onConflict:"user_id,goal_key,card_uid"});
}
async function sbRemoveOwned(userId,goalKey,cardUid){
  await supabase.from("owned_cards").delete().eq("user_id",userId).eq("goal_key",goalKey).eq("card_uid",cardUid);
}
async function sbLoadGoals(userId){
  const{data}=await supabase.from("goals").select("*").eq("user_id",userId);
  return data||[];
}
async function sbLoadOwnedCount(userId,goalKey){
  const{count}=await supabase.from("owned_cards").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("goal_key",goalKey);
  return count||0;
}
async function sbLoadOwned(userId,goalKey){
  const{data}=await supabase.from("owned_cards").select("card_uid").eq("user_id",userId).eq("goal_key",goalKey);
  return new Set((data||[]).map(r=>r.card_uid));
}

// --- Styles ---
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

function VB({variant}){let c=VBC[variant];if(!c){for(const[k,v]of Object.entries(VBC)){if(variant.includes(k)){c=v;break;}}}if(!c)c={bg:"rgba(42,45,54,0.5)",text:"#7a7d88"};return <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,background:c.bg,color:c.text,whiteSpace:"nowrap"}}>{variant}</span>;}
function GoalIcon({icon,setId,size}){if(icon&&icon.startsWith("http"))return <img src={icon} alt="" style={{width:size,height:size}}/>;if(setId)return <SetSymbol setId={setId} size={size}/>;return <span style={{fontSize:size*0.7}}>{icon||"📦"}</span>;}

// --- Auth Screen ---
function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[msg,setMsg]=useState(null);

  const handleSubmit=async()=>{
    setLoading(true);setError(null);setMsg(null);
    if(mode==="login"){
      const{data,error:e}=await supabase.auth.signInWithPassword({email,password:pass});
      if(e)setError(e.message);else onAuth(data.user);
    }else{
      const{data,error:e}=await supabase.auth.signUp({email,password:pass});
      if(e)setError(e.message);
      else if(data.user?.identities?.length===0)setError("Account already exists. Try logging in.");
      else setMsg("Check your email to confirm your account, then log in.");
    }
    setLoading(false);
  };

  return(
    <div style={{...S.page,display:"flex",flexDirection:"column",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{padding:"0 24px",maxWidth:380,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
        {/* Logo + Tagline */}
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:36,fontWeight:800,color:"#e8e8ec",letterSpacing:"-0.5px"}}>CollecPath</div>
          <div style={{fontSize:15,color:"#7a7d88",marginTop:8,lineHeight:1.5}}>Track the journey.<br/>Complete the collection.</div>
        </div>

        {/* Auth toggle */}
        <div style={{display:"flex",gap:0,marginBottom:28,background:"#181a20",borderRadius:12,padding:3}}>
          <button onClick={()=>{setMode("login");setError(null);setMsg(null);}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",background:mode==="login"?"#6c5ce7":"transparent",color:mode==="login"?"#fff":"#7a7d88",transition:"all 0.15s",touchAction:"manipulation"}}>Log In</button>
          <button onClick={()=>{setMode("signup");setError(null);setMsg(null);}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",background:mode==="signup"?"#6c5ce7":"transparent",color:mode==="signup"?"#fff":"#7a7d88",transition:"all 0.15s",touchAction:"manipulation"}}>Sign Up</button>
        </div>

        {/* Form */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"#7a7d88",fontWeight:600,marginBottom:6}}>Email</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" type="email"
            style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:"#7a7d88",fontWeight:600,marginBottom:6}}>Password</div>
          <input value={pass} onChange={e=>setPass(e.target.value)} placeholder={mode==="signup"?"Min 6 characters":"Your password"} type="password"
            style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>

        <button onClick={handleSubmit} disabled={loading||!email||!pass}
          style={{...S.btn(loading),width:"100%",fontSize:16}}>{loading?"…":mode==="login"?"Log In":"Create Account"}</button>

        {error&&<div style={{padding:12,borderRadius:10,background:"rgba(224,85,85,0.12)",color:"#e05555",fontSize:13,marginTop:16,textAlign:"center"}}>{error}</div>}
        {msg&&<div style={{padding:12,borderRadius:10,background:"rgba(108,92,231,0.12)",color:"#6c5ce7",fontSize:13,marginTop:16,textAlign:"center"}}>{msg}</div>}

        {/* Trust + Discord */}
        <div style={{marginTop:32,textAlign:"center"}}>
          <div style={{fontSize:12,color:"#555",marginBottom:12}}>🔒 Your data is encrypted and synced across devices.</div>
          <a href="https://discord.gg/fS9yW6d9qB" target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#6c5ce7",textDecoration:"none",fontWeight:600}}>Join our Discord →</a>
        </div>
      </div>
    </div>
  );
}

// --- Modal ---
function Modal({card,isOwned,onTog,onClose}){
  if(!card)return null;
  const[ptMatched,setPtMatched]=useState(null);const[ptLoading,setPtLoading]=useState(false);
  useEffect(()=>{if(!card)return;setPtMatched(null);setPtLoading(true);fetchPT(card.name,card.set).then(results=>{setPtMatched(bestMatch(results,card));setPtLoading(false);});},[card?.uid]);
  const ebayNM=ptMatched?.prices?.ebay?.NEAR_MINT;const ebayLP=ptMatched?.prices?.ebay?.LIGHTLY_PLAYED;
  const tcgNM=ptMatched?.prices?.tcgplayer?.NEAR_MINT;const tcgLP=ptMatched?.prices?.tcgplayer?.LIGHTLY_PLAYED;
  return(<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div onClick={e=>e.stopPropagation()} style={{background:"#181a20",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:440,maxHeight:"92vh",overflow:"auto",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
    <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}><div style={{width:36,height:4,borderRadius:99,background:"#3a3d46"}}/></div>
    <div style={{display:"flex",justifyContent:"center",padding:"8px 20px 12px"}}><img src={card.imageLarge||card.image} alt={card.name} style={{width:"55%",maxWidth:220,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}/></div>
    <div style={{padding:"0 20px 24px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><h2 style={{fontSize:19,fontWeight:800,color:"#e8e8ec",margin:0}}>{card.name}</h2><VB variant={card.variant}/></div>
      <div style={{fontSize:13,color:"#7a7d88",marginBottom:16}}>{card.set} · #{card.localId} · {card.rarity}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[{l:"Artist",v:card.artist},{l:"Type",v:card.types||"—"},{l:"HP",v:card.hp||"—"},{l:"Stage",v:card.stage||card.category||"—"}].map(m=>(<div key={m.l} style={{padding:"10px 12px",background:"#0f1115",borderRadius:10}}><div style={{fontSize:10,color:"#7a7d88",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{m.l}</div><div style={{fontSize:13,color:"#e8e8ec",fontWeight:600}}>{m.v}</div></div>))}
      </div>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{fontSize:13,color:"#e8e8ec",fontWeight:700}}>Market Prices</div>
          {ptLoading&&<div style={{width:14,height:14,border:"2px solid #6c5ce7",borderTopColor:"transparent",borderRadius:99,animation:"spin 0.8s linear infinite"}}/>}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
        {ptMatched?(<>
          <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#7a7d88",fontWeight:600,marginBottom:6}}>TCGPlayer</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Near Mint</div><div style={{fontSize:18,fontWeight:800,color:tcgNM?"#e8e8ec":"#555"}}>{tcgNM?f$(tcgNM.avg):"—"}</div>{tcgNM&&<div style={{fontSize:9,color:"#7a7d88"}}>{tcgNM.saleCount} sales · Low {f$(tcgNM.low)}</div>}</div>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Lightly Played</div><div style={{fontSize:18,fontWeight:800,color:tcgLP?"#e8e8ec":"#555"}}>{tcgLP?f$(tcgLP.avg):"—"}</div>{tcgLP&&<div style={{fontSize:9,color:"#7a7d88"}}>{tcgLP.saleCount} sales · Low {f$(tcgLP.low)}</div>}</div>
          </div></div>
          <div style={{marginBottom:8}}><div style={{fontSize:11,color:"#7a7d88",fontWeight:600,marginBottom:6}}>eBay Sold</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Near Mint</div><div style={{fontSize:18,fontWeight:800,color:ebayNM?"#e8e8ec":"#555"}}>{ebayNM?f$(ebayNM.avg):"—"}</div>{ebayNM&&<div style={{fontSize:9,color:"#7a7d88"}}>{ebayNM.saleCount} sales · Low {f$(ebayNM.low)}</div>}</div>
            <div style={{padding:"10px",background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:9,color:"#7a7d88",marginBottom:2}}>Lightly Played</div><div style={{fontSize:18,fontWeight:800,color:ebayLP?"#e8e8ec":"#555"}}>{ebayLP?f$(ebayLP.avg):"—"}</div>{ebayLP&&<div style={{fontSize:9,color:"#7a7d88"}}>{ebayLP.saleCount} sales · Low {f$(ebayLP.low)}</div>}</div>
          </div></div>
          <div style={{fontSize:9,color:"#444",textAlign:"right"}}>Matched: {ptMatched.set?.name} · {ptMatched.variant} · {new Date(ptMatched.lastUpdated).toLocaleDateString()}</div>
        </>):!ptLoading?(<div style={{padding:16,background:"#0f1115",borderRadius:10,textAlign:"center"}}><div style={{fontSize:13,color:"#555"}}>No live pricing available</div></div>):null}
      </div>
      <button onClick={onTog} style={{width:"100%",padding:"16px",borderRadius:12,border:"none",fontSize:15,fontWeight:700,cursor:"pointer",background:isOwned?"rgba(224,85,85,0.15)":"#6c5ce7",color:isOwned?"#e05555":"#fff",minHeight:52,touchAction:"manipulation"}}>{isOwned?"Mark as Missing":"Mark as Owned"}</button>
    </div>
  </div></div>);
}

function CRow({card,isOwned,onTog,onImg}){return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,background:isOwned?"rgba(108,92,231,0.1)":"#181a20",border:"1px solid #2a2d36",opacity:isOwned?0.65:1}}>
  <div onClick={onTog} style={{width:28,height:28,borderRadius:8,border:isOwned?"2px solid #6c5ce7":"2px solid #2a2d36",background:isOwned?"#6c5ce7":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",touchAction:"manipulation"}}>{isOwned&&<span style={{color:"#fff",fontSize:15,fontWeight:700}}>✓</span>}</div>
  <img src={card.image} alt={card.name} onClick={onImg} style={{width:44,height:62,borderRadius:5,objectFit:"cover",flexShrink:0,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}} loading="lazy"/>
  <div onClick={onImg} style={{flex:1,minWidth:0,cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:700,color:"#e8e8ec",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100% - 80px)"}}>{card.name}</span><VB variant={card.variant}/></div><div style={{fontSize:12,color:"#7a7d88"}}>{card.set} · #{card.localId} · {card.rarity}</div></div>
  <div onClick={onImg} style={{flexShrink:0,cursor:"pointer",padding:"4px 8px",borderRadius:8,background:"#0f1115",touchAction:"manipulation"}}><div style={{fontSize:11,color:"#6c5ce7",fontWeight:600}}>Price →</div></div>
</div>);}

function GCard({goal,onClick,onRm}){const{label,icon,cards:cc,owned:oo,setId,ownedCount}=goal;const tot=cc.length;const oc=oo.size>0?oo.size:(ownedCount||0);const pct=tot>0?Math.round((oc/tot)*100):(ownedCount>0?null:0);
  return(<div onClick={onClick} style={{position:"relative",minWidth:160,maxWidth:200,padding:"14px 16px",borderRadius:14,background:"#181a20",border:"1px solid #2a2d36",cursor:"pointer",flexShrink:0,touchAction:"manipulation"}}>
    <button onClick={e=>{e.stopPropagation();onRm();}} style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:99,background:"#2a2d36",border:"none",color:"#7a7d88",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><GoalIcon icon={icon} setId={setId} size={36}/><div><div style={{fontSize:14,fontWeight:800,color:"#e8e8ec",textTransform:"capitalize"}}>{label}</div></div></div>
    <div style={{height:5,borderRadius:99,background:"#2a2d36",marginBottom:8,overflow:"hidden"}}><div style={{height:"100%",width:`${pct!=null?pct:0}%`,background:pct===100?"#2ecc71":"#6c5ce7",borderRadius:99}}/></div>
    <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:"#6c5ce7"}}>{tot>0?`${oc}/${tot}`:`${oc} owned`}</span><span style={{fontSize:10,color:"#7a7d88"}}>{pct!=null?`${pct}%`:"Tap to load"}</span></div>
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
  const[user,setUser]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[view,setView]=useState("home");const[mode,setMode]=useState("pokemon");
  const[loading,setLoading]=useState(false);const[progress,setProgress]=useState(null);const[error,setError]=useState(null);
  const[goalKey,setGoalKey]=useState(null);const[goalLabel,setGoalLabel]=useState("");const[goalIcon,setGoalIcon]=useState("📦");const[goalSetId,setGoalSetId]=useState(null);
  const[cards,setCards]=useState([]);const[baseCt,setBaseCt]=useState(0);const[owned,setOwned]=useState(new Set());
  const[filter,setFilter]=useState("all");const[vf,setVf]=useState("all");const[sort,setSort]=useState("set");
  const[goals,setGoals]=useState([]);const[detail,setDetail]=useState(null);
  const[syncStatus,setSyncStatus]=useState("");

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setUser(session?.user||null);setAuthLoading(false);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{setUser(session?.user||null);});
    return()=>subscription.unsubscribe();
  },[]);

  // Load goals from Supabase when user logs in
  useEffect(()=>{
    if(!user)return;
    setSyncStatus("Syncing…");
    sbLoadGoals(user.id).then(async dbGoals=>{
      GS={};
      for(const g of dbGoals){
        const ownedCount=await sbLoadOwnedCount(user.id,g.goal_key);
        GS[g.goal_key]={key:g.goal_key,label:g.label,icon:g.icon||"📦",cards:[],owned:new Set(),updatedAt:new Date(g.updated_at).getTime(),setId:g.set_id||null,needsCards:true,ownedCount};
      }
      setGoals([...allG()]);
      setSyncStatus("");
    });
  },[user]);

  const rG=()=>setGoals([...allG()]);

  const openGoal=async(key,label,icon,cardData,ownedSet,setId)=>{
    setGoalKey(key);setGoalLabel(label);setGoalIcon(icon);setGoalSetId(setId||null);
    setCards(cardData);setBaseCt(new Set(cardData.map(c=>c.id)).size);setOwned(ownedSet);
    setFilter("all");setVf("all");setSort("set");setView("results");
  };

  const loadGoalCards=async(goal)=>{
    // If cards not loaded yet, re-fetch from TCGdex
    if(goal.needsCards||goal.cards.length===0){
      setLoading(true);setProgress(null);
      try{
        let cardData=[];
        if(goal.key.startsWith("poke::")){
          const pokeName=goal.key.replace("poke::","");
          const br=await gBriefs(pokeName);
          const brF=br.filter(b=>!/^[A-Z]/.test(b.id.split("-")[0]));
          setProgress({c:0,t:brF.length});
          const full=await gAll(brF,(cur,tot)=>setProgress({c:cur,t:tot}));
          cardData=explode(full);
        }else if(goal.key.startsWith("set::")){
          const setId=goal.key.replace("set::","");
          const setData=await fetchSet(setId);
          if(setData?.cards){
            setProgress({c:0,t:setData.cards.length});
            const full=await gAll(setData.cards,(cur,tot)=>setProgress({c:cur,t:tot}));
            full.sort((a,b)=>(parseInt(a.localId)||0)-(parseInt(b.localId)||0));
            for(let i=0;i<full.length;i++)full[i]._rd=setData.releaseDate||"9999-01-01";
            cardData=explode(full);
          }
        }
        goal.cards=cardData;goal.needsCards=false;
        // Load owned cards from Supabase
        const ownedSet=await sbLoadOwned(user.id,goal.key);
        goal.owned=ownedSet;
        rG();
        openGoal(goal.key,goal.label,goal.icon,cardData,ownedSet,goal.setId);
      }catch(e){setError("Failed to load cards.");console.error(e);}
      setLoading(false);setProgress(null);
    }else{
      // Cards already loaded, just load owned from memory
      openGoal(goal.key,goal.label,goal.icon,goal.cards,goal.owned,goal.setId);
    }
  };

  const doPokeSearch=async q=>{
    setLoading(true);setError(null);setProgress(null);
    try{const pk=await sPoke(q);if(!pk){setError(`Couldn't find "${q}".`);setLoading(false);return;}
      const key="poke::"+pk.name;
      const ex=getG(key);if(ex&&ex.cards.length>0){await loadGoalCards(ex);setLoading(false);return;}
      const br=await gBriefs(pk.name);const brF=br.filter(b=>!/^[A-Z]/.test(b.id.split("-")[0]));
      if(brF.length===0){setError(`No physical cards found for "${pk.name}".`);setLoading(false);return;}
      setProgress({c:0,t:brF.length});const full=await gAll(brF,(cur,tot)=>setProgress({c:cur,t:tot}));
      const ex2=explode(full);
      saveGLocal(key,pk.name,pk.sprite,ex2,new Set(),null);
      if(user)await sbSaveGoal(user.id,key,pk.name,pk.sprite,null);
      rG();openGoal(key,pk.name,pk.sprite,ex2,new Set(),null);
    }catch(e){setError("Something went wrong.");console.error(e);}setLoading(false);setProgress(null);
  };

  const doSetSearch=async setInfo=>{
    setLoading(true);setError(null);setProgress(null);
    try{const key="set::"+setInfo.id;
      const ex=getG(key);if(ex&&ex.cards.length>0){await loadGoalCards(ex);setLoading(false);return;}
      const setData=await fetchSet(setInfo.id);if(!setData?.cards?.length){setError(`No cards found for "${setInfo.name}".`);setLoading(false);return;}
      setProgress({c:0,t:setData.cards.length});const full=await gAll(setData.cards,(cur,tot)=>setProgress({c:cur,t:tot}));
      full.sort((a,b)=>(parseInt(a.localId)||0)-(parseInt(b.localId)||0));for(let i=0;i<full.length;i++)full[i]._rd=setData.releaseDate||"9999-01-01";
      const ex2=explode(full);
      saveGLocal(key,setInfo.name,"📦",ex2,new Set(),setInfo.id);
      if(user)await sbSaveGoal(user.id,key,setInfo.name,"📦",setInfo.id);
      rG();openGoal(key,setInfo.name,"📦",ex2,new Set(),setInfo.id);
    }catch(e){setError("Something went wrong.");console.error(e);}setLoading(false);setProgress(null);
  };

  const selG=g=>loadGoalCards(g);

  const tog=async uid=>{
    if(!goalKey)return;
    const g=GS[goalKey];if(!g)return;
    const wasOwned=g.owned.has(uid);
    const next=togGLocal(goalKey,uid);setOwned(new Set(next));rG();
    // Sync to Supabase
    if(user){
      if(wasOwned)sbRemoveOwned(user.id,goalKey,uid);
      else sbSaveOwned(user.id,goalKey,uid);
    }
  };

  const rmGoal=async key=>{
    rmGLocal(key);rG();
    if(user)await sbDeleteGoal(user.id,key);
  };

  const goHome=()=>{setView("home");setCards([]);setGoalKey(null);setError(null);setFilter("all");setVf("all");};
  const signOut=async()=>{await supabase.auth.signOut();GS={};setGoals([]);setView("home");setCards([]);};

  const vOpts=[...new Set(cards.map(c=>c.variant))].sort();
  const sorted=[...cards].sort((a,b)=>{if(sort==="rarity")return(a.rarity||"").localeCompare(b.rarity||"");return a.sortIndex-b.sortIndex;});
  const filt=sorted.filter(c=>{if(filter==="owned"&&!owned.has(c.uid))return false;if(filter==="missing"&&owned.has(c.uid))return false;if(vf!=="all"&&c.variant!==vf)return false;return true;});
  const tot=cards.length,oc=owned.size,pct=tot>0?Math.round((oc/tot)*100):0;

  if(authLoading)return <div style={S.page}><div style={{padding:60,textAlign:"center",color:"#7a7d88"}}>Loading…</div></div>;
  if(!user)return <AuthScreen onAuth={setUser}/>;

  return(
    <div style={S.page}>
      <div style={S.header}>
        <div onClick={goHome} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:8,touchAction:"manipulation"}}><span style={{fontSize:20,fontWeight:800,color:"#e8e8ec"}}>CollecPath</span><span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"rgba(108,92,231,0.12)",color:"#6c5ce7",fontWeight:600}}>BETA</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <a href="https://discord.gg/fS9yW6d9qB" target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#7a7d88",textDecoration:"none",padding:"6px 10px",borderRadius:8,border:"1px solid #2a2d36",touchAction:"manipulation"}}>Discord</a>
          <button onClick={signOut} style={{background:"none",border:"1px solid #2a2d36",borderRadius:8,padding:"6px 12px",color:"#7a7d88",fontSize:11,cursor:"pointer",touchAction:"manipulation"}}>Sign Out</button>
        </div>
      </div>
      <div style={S.content}>
        {view==="home"&&(<>
          {syncStatus&&<div style={{textAlign:"center",padding:8,color:"#6c5ce7",fontSize:12,marginBottom:8}}>{syncStatus}</div>}
          {goals.length>0&&(<div style={{marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><h3 style={{fontSize:15,fontWeight:800,color:"#e8e8ec",margin:0}}>Your Goals</h3><span style={{fontSize:12,color:"#7a7d88"}}>{goals.length} active</span></div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,WebkitOverflowScrolling:"touch"}}>{goals.sort((a,b)=>b.updatedAt-a.updatedAt).map(g=>(<GCard key={g.key} goal={g} onClick={()=>selG(g)} onRm={()=>rmGoal(g.key)}/>))}</div>
          </div>)}
          <div style={{marginBottom:20}}><h2 style={{fontSize:21,fontWeight:800,marginBottom:4}}>{goals.length>0?"Start a new goal":"What are you collecting?"}</h2><p style={{fontSize:14,color:"#7a7d88",margin:0}}>{goals.length>0?"Add another goal to track.":"Pick your goal. We'll show you the path."}</p></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:24}}>
            {MODES.map(m=>(<button key={m.id} onClick={()=>m.ready&&setMode(m.id)} style={{position:"relative",background:mode===m.id?"rgba(108,92,231,0.12)":"#181a20",border:mode===m.id?"2px solid #6c5ce7":"2px solid #2a2d36",borderRadius:12,padding:"14px 12px",cursor:m.ready?"pointer":"default",opacity:m.ready?1:0.4,textAlign:"left",touchAction:"manipulation"}}><div style={{fontSize:18,marginBottom:3}}>{m.icon}</div><div style={{fontSize:13,fontWeight:700,color:"#e8e8ec",marginBottom:2}}>{m.label}</div><div style={{fontSize:11,color:"#7a7d88",lineHeight:1.3}}>{m.desc}</div>{!m.ready&&<span style={{position:"absolute",top:7,right:8,fontSize:9,color:"#7a7d88",fontWeight:600,background:"#2a2d36",padding:"2px 6px",borderRadius:99}}>SOON</span>}</button>))}
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
          <div style={{...S.card,padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:700,color:"#e8e8ec"}}>Completion</span><span style={{fontSize:13,fontWeight:700,color:"#6c5ce7"}}>{oc}/{tot} ({pct}%)</span></div>
            <div style={{height:7,borderRadius:99,background:"#2a2d36",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct===100?"#2ecc71":"#6c5ce7",borderRadius:99,transition:"width 0.4s"}}/></div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8}}>
              <div style={{display:"flex",gap:4,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>{["all","owned","missing"].map(fl=>(<button key={fl} onClick={()=>setFilter(fl)} style={S.pill(filter===fl)}>{fl==="all"?`All (${tot})`:fl.charAt(0).toUpperCase()+fl.slice(1)}</button>))}</div>
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:"8px 10px",borderRadius:8,border:"1px solid #2a2d36",background:"#181a20",color:"#e8e8ec",fontSize:12,minHeight:36}}><option value="set">Sort: {goalKey?.startsWith("set::")?"Card #":"Set"}</option><option value="rarity">Rarity</option></select>
            </div>
            {vOpts.length>1&&(<div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}><button onClick={()=>setVf("all")} style={S.pillSm(vf==="all")}>All variants</button>{vOpts.map(v=>(<button key={v} onClick={()=>setVf(v)} style={S.pillSm(vf===v)}>{v}</button>))}</div>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {filt.length===0&&<div style={{textAlign:"center",padding:40,color:"#7a7d88",fontSize:14}}>{filter==="owned"?"Tap the checkbox on any card to mark it owned.":"No cards to show."}</div>}
            {filt.map(c=>(<CRow key={c.uid} card={c} isOwned={owned.has(c.uid)} onTog={()=>tog(c.uid)} onImg={()=>setDetail(c)}/>))}
          </div>
        </>)}
      </div>
      <Modal card={detail} isOwned={detail?owned.has(detail.uid):false} onTog={()=>{if(detail)tog(detail.uid);}} onClose={()=>setDetail(null)}/>
    </div>
  );
}