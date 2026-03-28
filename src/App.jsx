import { useState } from "react";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
async function callClaude(description, diagramType) {
  const typeLabels = {
    class: "class diagram", sequence: "sequence diagram",
    usecase: "use case diagram", activity: "activity diagram",
  };
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    // fallback démo si pas de clé
    return EXAMPLES[diagramType];
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Generate valid PlantUML code for a ${typeLabels[diagramType]} based on: "${description}".
Add dark theme: skinparam backgroundColor #0A0B0F, main color #6C63FF, font color #F0F2FF.
Return ONLY the @startuml...@enduml code, nothing else.`
        }]
      }),
    });
    const data = await res.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    const match = text.match(/@startuml[\s\S]*?@enduml/);
    return match ? match[0] : EXAMPLES[diagramType];
  } catch {
    return EXAMPLES[diagramType];
  }
}

function encodePlantUML(text) {
  // PlantUML custom base64 alphabet
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

  function encode64(data) {
    let r = "";
    for (let i = 0; i < data.length; i += 3) {
      const b1 = data[i], b2 = data[i+1]||0, b3 = data[i+2]||0;
      r += chars[b1>>2]+chars[((b1&3)<<4)|(b2>>4)]+chars[((b2&15)<<2)|(b3>>6)]+chars[b3&63];
    }
    return r;
  }

  // Deflate compression using raw deflate via CompressionStream (modern browsers)
  async function deflateAsync(str) {
    const input = new TextEncoder().encode(str);
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();
    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }

  // Return a promise-based URL builder
  return deflateAsync(text).then(compressed => {
    return "~1" + encode64(compressed);
  }).catch(() => {
    // fallback: simple latin1 encoding without compression
    const bytes = new Uint8Array(unescape(encodeURIComponent(text)).split("").map(c=>c.charCodeAt(0)));
    return encode64(bytes);
  });
}

async function plantUMLUrl(code) {
  const encoded = await encodePlantUML(code);
  return `https://www.plantuml.com/plantuml/png/${encoded}`;
}

/* ─── exemples PlantUML ───────────────────────────────────────────────────── */
const EXAMPLES = {
  class: `@startuml
skinparam backgroundColor #0A0B0F
skinparam classBackgroundColor #12141A
skinparam classBorderColor #6C63FF
skinparam classArrowColor #8B85FF
skinparam classFontColor #F0F2FF

class User {
  +id: UUID
  +email: String
  +password: String
  --
  +register()
  +login()
}
class Project {
  +id: UUID
  +name: String
  --
  +create()
  +delete()
}
class Diagram {
  +id: UUID
  +type: String
  +imageUrl: String
  --
  +generate()
  +download()
}
User "1" --> "0..*" Project : owns
Project "1" --> "0..*" Diagram : contains
@enduml`,

  sequence: `@startuml
skinparam backgroundColor #0A0B0F
skinparam sequenceArrowColor #6C63FF
skinparam sequenceParticipantBackgroundColor #12141A
skinparam sequenceParticipantBorderColor #6C63FF
skinparam sequenceFontColor #F0F2FF

actor User
participant "React App" as FE
participant "Express API" as API
participant "Claude AI" as AI
participant "PlantUML" as UML

User -> FE: Saisit description
FE -> API: POST /generate
API -> AI: Génère code UML
AI --> API: Code PlantUML
API -> UML: Encode & render
UML --> API: Image PNG
API --> FE: imageUrl
FE --> User: Affiche diagramme
@enduml`,

  usecase: `@startuml
skinparam backgroundColor #0A0B0F
skinparam usecaseBackgroundColor #12141A
skinparam usecaseBorderColor #6C63FF
skinparam actorFontColor #F0F2FF
skinparam usecaseFontColor #F0F2FF

left to right direction
actor "Utilisateur Gratuit" as Free
actor "Utilisateur Pro" as Pro

rectangle "UMLify AI" {
  usecase "S'inscrire" as UC1
  usecase "Se connecter" as UC2
  usecase "Générer diagramme" as UC3
  usecase "Télécharger PNG" as UC4
  usecase "Voir historique" as UC5
}
Free --> UC1
Free --> UC2
Free --> UC3
Free --> UC4
Pro --> UC2
Pro --> UC3
Pro --> UC4
Pro --> UC5
@enduml`,

  activity: `@startuml
skinparam backgroundColor #0A0B0F
skinparam activityBackgroundColor #12141A
skinparam activityBorderColor #6C63FF
skinparam activityArrowColor #8B85FF
skinparam activityFontColor #F0F2FF

start
:Saisir description du projet;
if (Connecté ?) then (non)
  :Rediriger vers login;
endif
:Sélectionner type de diagramme;
if (Quota atteint ?) then (oui)
  :Afficher page Upgrade;
  stop
endif
:Envoyer à Claude AI;
:Générer code PlantUML;
:Rendre l'image;
:Afficher le diagramme;
if (Télécharger ?) then (oui)
  :Export PNG;
endif
stop
@enduml`,
};

/* ─── constantes UI ───────────────────────────────────────────────────────── */
const TYPES = [
  { id: "class",    label: "Classes",       icon: "⬡", color: "#6C63FF" },
  { id: "sequence", label: "Séquence",      icon: "⟶", color: "#00D68F" },
  { id: "usecase",  label: "Cas d'utilisation", icon: "◎", color: "#FFB547" },
  { id: "activity", label: "Activité",      icon: "◈", color: "#FF5B79" },
];

const FREE_LIMIT = 2;

/* ─── styles inline globaux ──────────────────────────────────────────────── */
const G = {
  bg: "#0A0B0F", bgCard: "#12141A", bgHover: "#1A1D27",
  border: "#1E2130", accent: "#6C63FF", accentLight: "#8B85FF",
  accentDim: "rgba(108,99,255,0.12)", green: "#00D68F", amber: "#FFB547",
  red: "#FF5B79", text: "#F0F2FF", textSec: "#8890B0", textMuted: "#4A5070",
};

/* ─── composants simples ─────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
      <div style={{
        width:44, height:44, borderRadius:"50%",
        border:`3px solid ${G.border}`, borderTopColor:G.accent,
        animation:"spin 0.8s linear infinite",
      }}/>
      <span style={{ color:G.textSec, fontSize:13 }}>Génération en cours…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0A0B0F}
        textarea{resize:none}
        textarea::placeholder,input::placeholder{color:#4A5070}
        textarea:focus,input:focus{outline:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1E2130;border-radius:4px}
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}

/* ─── AUTH ───────────────────────────────────────────────────────────────── */
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const inputSt = {
    width:"100%", padding:"11px 14px", borderRadius:10,
    background:G.bgHover, border:`1px solid ${G.border}`,
    color:G.text, fontSize:14,
  };

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    setLoading(false);
    onLogin({ name: name || email.split("@")[0], email, plan:"free", used:0 });
  };

  return (
    <div style={{
      minHeight:"100vh", background:G.bg, display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"Inter, system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:#4A5070}
        input:focus{outline:none;border-color:#6C63FF!important}
      `}</style>

      {/* glow */}
      <div style={{
        position:"fixed", width:500, height:500, borderRadius:"50%",
        background:`radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)`,
        top:"5%", left:"50%", transform:"translateX(-50%)", pointerEvents:"none",
      }}/>

      <div style={{ width:"100%", maxWidth:400, padding:"0 20px" }}>
        {/* logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width:56, height:56, borderRadius:16,
            background:`linear-gradient(135deg, ${G.accent}, ${G.accentLight})`,
            fontSize:26, marginBottom:12,
          }}>⬡</div>
          <h1 style={{ color:G.text, fontSize:22, fontWeight:700, marginBottom:4 }}>UMLify AI</h1>
          <p style={{ color:G.textSec, fontSize:13 }}>Génère des diagrammes UML en secondes</p>
        </div>

        <div style={{
          background:G.bgCard, borderRadius:16, padding:28,
          border:`1px solid ${G.border}`,
        }}>
          {/* tabs */}
          <div style={{
            display:"flex", background:G.bg, borderRadius:10, padding:4, marginBottom:24,
          }}>
            {[["login","Connexion"],["register","Inscription"]].map(([m,l]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, padding:"8px 0", borderRadius:8, border:"none", cursor:"pointer",
                background: mode===m ? G.bgCard : "transparent",
                color: mode===m ? G.text : G.textSec,
                fontWeight: mode===m ? 600 : 400, fontSize:13, transition:"all 0.2s",
                boxShadow: mode===m ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {mode==="register" && (
              <div>
                <label style={{ fontSize:12, color:G.textSec, display:"block", marginBottom:5 }}>Nom</label>
                <input style={inputSt} placeholder="Ton prénom" value={name} onChange={e=>setName(e.target.value)}/>
              </div>
            )}
            <div>
              <label style={{ fontSize:12, color:G.textSec, display:"block", marginBottom:5 }}>Email</label>
              <input style={inputSt} type="email" placeholder="toi@exemple.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            </div>
            <div>
              <label style={{ fontSize:12, color:G.textSec, display:"block", marginBottom:5 }}>Mot de passe</label>
              <input style={inputSt} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
            </div>
            <button onClick={handleSubmit} disabled={loading||!email||!password} style={{
              marginTop:8, padding:12, borderRadius:10, border:"none", cursor:"pointer",
              background: loading||!email||!password ? G.bgHover : `linear-gradient(135deg,${G.accent},${G.accentLight})`,
              color: loading||!email||!password ? G.textMuted : "white",
              fontSize:14, fontWeight:600, transition:"all 0.2s",
            }}>
              {loading ? "Chargement…" : mode==="login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </div>

          <p style={{ textAlign:"center", color:G.textMuted, fontSize:12, marginTop:20 }}>
            2 diagrammes gratuits · Sans carte bancaire
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── PRICING MODAL ──────────────────────────────────────────────────────── */
function PricingModal({ onClose, onUpgrade }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:200, padding:20, backdropFilter:"blur(6px)",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:G.bgCard, borderRadius:20, padding:36,
        border:`1px solid ${G.border}`, maxWidth:480, width:"100%",
      }}>
        <h2 style={{ color:G.text, fontSize:22, fontWeight:700, textAlign:"center", marginBottom:8 }}>
          ⚡ Passer au Plan Pro
        </h2>
        <p style={{ color:G.textSec, fontSize:14, textAlign:"center", marginBottom:24 }}>
          Tu as atteint la limite de 2 diagrammes gratuits.
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
          {[
            { plan:"Gratuit", price:"0€", features:["2 diagrammes","PNG uniquement"], dim:true },
            { plan:"Pro", price:"12€/mois", features:["Illimité","PNG + PDF","Historique"], dim:false },
          ].map(p => (
            <div key={p.plan} style={{
              padding:16, borderRadius:14,
              border:`2px solid ${p.dim ? G.border : G.accent}`,
              background: p.dim ? "transparent" : G.accentDim,
            }}>
              <div style={{ fontWeight:700, color: p.dim ? G.textSec : G.accent, marginBottom:4 }}>{p.plan}</div>
              <div style={{ fontSize:22, fontWeight:700, color:G.text, marginBottom:10 }}>{p.price}</div>
              {p.features.map(f => (
                <div key={f} style={{ fontSize:12, color: p.dim ? G.textMuted : G.textSec, marginBottom:4 }}>
                  {p.dim ? "✗" : "✓"} {f}
                </div>
              ))}
            </div>
          ))}
        </div>

        <button onClick={onUpgrade} style={{
          width:"100%", padding:13, borderRadius:12, border:"none", cursor:"pointer",
          background:`linear-gradient(135deg,${G.accent},${G.accentLight})`,
          color:"white", fontSize:15, fontWeight:700,
        }}>
          Passer au Pro — 12€/mois
        </button>
        <p style={{ textAlign:"center", color:G.textMuted, fontSize:11, marginTop:10 }}>
          Paiement sécurisé Stripe · Annulable à tout moment
        </p>
      </div>
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("generate");
  const [inputType, setInputType] = useState("text");
  const [selectedType, setSelectedType] = useState("class");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [history, setHistory] = useState([]);
  const [showPricing, setShowPricing] = useState(false);

  if (!user) return <AuthPage onLogin={setUser} />;

  const dt = TYPES.find(t => t.id === selectedType);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    if (user.plan === "free" && user.used >= FREE_LIMIT) {
      setShowPricing(true); return;
    }
    setLoading(true); setResult(null); setImgError(false);
    const code = await callClaude(inputText, selectedType);
    const imageUrl = await plantUMLUrl(code);
    setResult({ code, imageUrl });
    setHistory(h => [{
      id: Date.now(), title: inputText.slice(0,40), type: selectedType,
      date: new Date().toLocaleDateString("fr-FR"), imageUrl, code,
    }, ...h]);
    setUser(u => ({ ...u, used: u.used + 1 }));
    setLoading(false);
  };

  const loadExample = async (type) => {
    setSelectedType(type);
    const code = EXAMPLES[type];
    const imageUrl = await plantUMLUrl(code);
    setResult({ code, imageUrl });
    setImgError(false);
  };

  const sideW = 210;

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:G.bg, fontFamily:"Inter, system-ui, sans-serif", color:G.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        textarea{resize:none} textarea::placeholder{color:#4A5070} textarea:focus{outline:none}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1E2130;border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        button{font-family:inherit} input{font-family:inherit}
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={{
        width:sideW, background:G.bgCard, borderRight:`1px solid ${G.border}`,
        display:"flex", flexDirection:"column", padding:"18px 10px",
        position:"fixed", top:0, left:0, bottom:0,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"0 8px", marginBottom:28 }}>
          <div style={{
            width:32, height:32, borderRadius:9,
            background:`linear-gradient(135deg,${G.accent},${G.accentLight})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
          }}>⬡</div>
          <span style={{ fontWeight:700, fontSize:16 }}>UMLify AI</span>
        </div>

        {/* Nav */}
        {[
          { id:"generate", icon:"⚡", label:"Générer" },
          { id:"history",  icon:"🕐", label:"Historique" },
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            display:"flex", alignItems:"center", gap:9, padding:"10px 12px",
            borderRadius:10, border:"none", cursor:"pointer", width:"100%", marginBottom:3,
            background: view===item.id ? G.accentDim : "transparent",
            color: view===item.id ? G.accent : G.textSec,
            fontSize:14, fontWeight: view===item.id ? 600 : 400, transition:"all 0.15s",
          }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}

        <div style={{ flex:1 }}/>

        {/* Plan */}
        <div style={{ padding:12, borderRadius:12, background:G.bg, border:`1px solid ${G.border}`, marginBottom:10 }}>
          {user.plan === "free" ? (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7, fontSize:12 }}>
                <span style={{ color:G.textSec }}>Plan Gratuit</span>
                <span style={{ color: user.used >= FREE_LIMIT ? G.red : G.accent, fontWeight:600 }}>
                  {user.used}/{FREE_LIMIT}
                </span>
              </div>
              <div style={{ height:4, background:G.border, borderRadius:99, marginBottom:10 }}>
                <div style={{
                  height:"100%", borderRadius:99,
                  width:`${Math.min((user.used/FREE_LIMIT)*100,100)}%`,
                  background: user.used >= FREE_LIMIT ? G.red : G.accent,
                  transition:"width 0.4s",
                }}/>
              </div>
              <button onClick={() => setShowPricing(true)} style={{
                width:"100%", padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer",
                background:`linear-gradient(135deg,${G.accent},${G.accentLight})`,
                color:"white", fontSize:12, fontWeight:700,
              }}>⚡ Passer au Pro</button>
            </>
          ) : (
            <div style={{ fontSize:13, color:G.amber, fontWeight:700 }}>👑 Plan Pro — Illimité</div>
          )}
        </div>

        {/* User */}
        <div style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 4px" }}>
          <div style={{
            width:32, height:32, borderRadius:"50%", flexShrink:0,
            background:`linear-gradient(135deg,${G.accent},#FF6B9D)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:700, fontSize:13,
          }}>{user.name[0].toUpperCase()}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
            <div style={{ fontSize:11, color:G.textMuted, overflow:"hidden", textOverflow:"ellipsis" }}>{user.email}</div>
          </div>
          <button onClick={() => setUser(null)} title="Déconnexion" style={{
            background:"none", border:"none", cursor:"pointer", color:G.textMuted, fontSize:16, padding:4,
          }}>↩</button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft:sideW, flex:1, padding:"28px 28px 28px 28px", overflowY:"auto" }}>

        {/* ── VUE GENERATE ─────────────────────────────────────────────── */}
        {view === "generate" && (
          <div style={{ animation:"fadeIn 0.3s ease", maxWidth:1100 }}>
            <h1 style={{ fontSize:24, fontWeight:700, marginBottom:6 }}>Générer un diagramme</h1>
            <p style={{ color:G.textSec, fontSize:14, marginBottom:24 }}>
              Décris ton projet ou colle du code — l'IA génère le diagramme automatiquement.
            </p>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, alignItems:"start" }}>

              {/* colonne gauche */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* toggle text/code */}
                <div style={{ display:"flex", gap:8 }}>
                  {[["text","📝 Description"],["code","💻 Code source"]].map(([id,lbl]) => (
                    <button key={id} onClick={() => setInputType(id)} style={{
                      padding:"7px 14px", borderRadius:8, border:`1px solid ${inputType===id ? G.accent : G.border}`,
                      background: inputType===id ? G.accentDim : G.bgCard,
                      color: inputType===id ? G.accent : G.textSec,
                      fontSize:13, fontWeight:500, cursor:"pointer", transition:"all 0.2s",
                    }}>{lbl}</button>
                  ))}
                </div>

                {/* type de diagramme */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {TYPES.map(t => (
                    <button key={t.id} onClick={() => setSelectedType(t.id)} style={{
                      padding:"10px 12px", borderRadius:10, textAlign:"left", cursor:"pointer",
                      border:`1px solid ${selectedType===t.id ? t.color : G.border}`,
                      background: selectedType===t.id ? t.color+"18" : G.bgCard,
                      color: selectedType===t.id ? t.color : G.textSec,
                      fontSize:12, fontWeight:600, transition:"all 0.2s",
                      display:"flex", alignItems:"center", gap:8,
                    }}>
                      <span style={{ fontSize:16 }}>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>

                {/* textarea */}
                <div style={{ background:G.bgCard, borderRadius:14, border:`1px solid ${G.border}`, overflow:"hidden" }}>
                  <div style={{ padding:"10px 14px", borderBottom:`1px solid ${G.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:G.textSec }}>
                      {inputType==="text" ? "Description du projet" : "Code source (Java, PHP, JS…)"}
                    </span>
                    <span style={{ fontSize:11, fontWeight:600, color:dt?.color, background:dt?.color+"20", padding:"2px 8px", borderRadius:99 }}>
                      {dt?.icon} {dt?.label}
                    </span>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={inputType==="text"
                      ? "Ex : Une plateforme e-commerce avec des utilisateurs, produits, commandes et paiements…"
                      : "Collez votre code Java, PHP ou JavaScript ici…"}
                    style={{
                      width:"100%", height:190, padding:14,
                      background:"transparent", border:"none", color:G.text,
                      fontSize: inputType==="code" ? 12 : 14,
                      fontFamily: inputType==="code" ? "'JetBrains Mono', monospace" : "inherit",
                      lineHeight:1.6,
                    }}
                  />
                </div>

                {/* bouton générer */}
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  style={{
                    padding:13, borderRadius:12, border:"none",
                    cursor: loading||!inputText.trim() ? "not-allowed" : "pointer",
                    background: loading||!inputText.trim()
                      ? G.bgHover
                      : `linear-gradient(135deg,${G.accent},${G.accentLight})`,
                    color: loading||!inputText.trim() ? G.textMuted : "white",
                    fontSize:15, fontWeight:700, transition:"all 0.2s",
                    boxShadow: loading||!inputText.trim() ? "none" : `0 8px 24px rgba(108,99,255,0.3)`,
                  }}>
                  ✦ {loading ? "Génération en cours…" : "Générer le diagramme"}
                </button>

                {/* exemples rapides */}
                <div>
                  <p style={{ fontSize:12, color:G.textMuted, marginBottom:7 }}>Exemples rapides :</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {[
                      { l:"E-Commerce", t:"class",    tx:"Plateforme e-commerce avec User, Product, Cart, Order, Payment" },
                      { l:"Auth JWT",   t:"sequence", tx:"Authentification JWT avec refresh token et middleware" },
                      { l:"Blog App",   t:"class",    tx:"Application blog avec Post, User, Comment, Tag, Category" },
                    ].map(ex => (
                      <button key={ex.l} onClick={() => { setInputText(ex.tx); setSelectedType(ex.t); }}
                        style={{
                          padding:"5px 10px", borderRadius:7, border:`1px solid ${G.border}`,
                          background:G.bgHover, color:G.textSec, fontSize:12, cursor:"pointer",
                        }}>
                        {ex.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* colonne droite — aperçu */}
              <div style={{
                background:G.bgCard, borderRadius:16, border:`1px solid ${G.border}`,
                minHeight:460, display:"flex", flexDirection:"column", overflow:"hidden",
              }}>
                <div style={{
                  padding:"13px 16px", borderBottom:`1px solid ${G.border}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>Aperçu</span>
                  {result && !imgError && (
                    <a href={result.imageUrl} download="diagram.png" style={{
                      display:"flex", alignItems:"center", gap:5, padding:"5px 11px",
                      borderRadius:8, border:`1px solid ${G.border}`, background:G.bgHover,
                      color:G.textSec, fontSize:12, textDecoration:"none",
                    }}>⬇ PNG</a>
                  )}
                </div>

                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
                  {loading ? (
                    <Spinner />
                  ) : result && !imgError ? (
                    <div style={{ animation:"fadeIn 0.4s ease", textAlign:"center", width:"100%" }}>
                      <img
                        src={result.imageUrl} alt="Diagramme UML"
                        onError={() => setImgError(true)}
                        style={{ maxWidth:"100%", borderRadius:8, border:`1px solid ${G.border}` }}
                      />
                    </div>
                  ) : result && imgError ? (
                    <div style={{ animation:"fadeIn 0.3s ease", width:"100%" }}>
                      <div style={{
                        background:G.green+"15", border:`1px solid ${G.green}33`,
                        borderRadius:12, padding:14, marginBottom:12,
                      }}>
                        <div style={{ color:G.green, fontSize:12, fontWeight:600, marginBottom:8 }}>
                          ✓ Code PlantUML généré — Copiez-le sur plantuml.com
                        </div>
                        <pre style={{
                          color:G.textSec, fontSize:10, fontFamily:"'JetBrains Mono', monospace",
                          overflow:"auto", maxHeight:260, lineHeight:1.6,
                          whiteSpace:"pre-wrap", wordBreak:"break-word",
                        }}>{result.code}</pre>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:40, marginBottom:14, opacity:0.2 }}>⬡</div>
                      <p style={{ color:G.textMuted, fontSize:13, marginBottom:16 }}>
                        Saisis une description puis clique sur Générer
                      </p>
                      <p style={{ color:G.textMuted, fontSize:12, marginBottom:8 }}>Ou charge un exemple :</p>
                      <div style={{ display:"flex", gap:7, justifyContent:"center", flexWrap:"wrap" }}>
                        {TYPES.map(t => (
                          <button key={t.id} onClick={() => loadExample(t.id)} style={{
                            padding:"5px 11px", borderRadius:8,
                            border:`1px solid ${t.color}44`, background:t.color+"15",
                            color:t.color, fontSize:11, fontWeight:600, cursor:"pointer",
                          }}>{t.icon} {t.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {result && (
                  <div style={{
                    padding:"10px 16px", borderTop:`1px solid ${G.border}`, background:G.bg,
                    display:"flex", gap:8, alignItems:"center",
                  }}>
                    <span style={{ fontSize:11, fontWeight:600, color:G.green }}>● Généré</span>
                    <span style={{ fontSize:11, color:G.textMuted }}>—</span>
                    <span style={{ fontSize:11, color:G.textMuted }}>{dt?.label}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── VUE HISTORIQUE ───────────────────────────────────────────── */}
        {view === "history" && (
          <div style={{ animation:"fadeIn 0.3s ease", maxWidth:800 }}>
            <h1 style={{ fontSize:24, fontWeight:700, marginBottom:6 }}>Historique</h1>
            <p style={{ color:G.textSec, fontSize:14, marginBottom:24 }}>
              {history.length} diagramme{history.length!==1?"s":""} générés dans cette session.
            </p>

            {user.plan==="free" && (
              <div style={{
                padding:14, borderRadius:12, background:G.accentDim,
                border:`1px solid ${G.accent}33`, marginBottom:16,
                display:"flex", alignItems:"center", justifyContent:"space-between",
              }}>
                <span style={{ fontSize:13, color:G.accent }}>🔒 Historique persistant disponible en plan Pro</span>
                <button onClick={() => setShowPricing(true)} style={{
                  padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer",
                  background:G.accent, color:"white", fontSize:12, fontWeight:700,
                }}>Upgrade</button>
              </div>
            )}

            {history.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:G.textMuted }}>
                Aucun diagramme encore. Va dans "Générer" pour commencer !
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {history.map(item => {
                  const t = TYPES.find(t => t.id === item.type);
                  return (
                    <div key={item.id} style={{
                      padding:"14px 16px", borderRadius:12, background:G.bgCard,
                      border:`1px solid ${G.border}`, display:"flex", alignItems:"center", gap:12,
                    }}>
                      <div style={{
                        width:38, height:38, borderRadius:10, flexShrink:0,
                        background:t?.color+"20", display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:18, color:t?.color,
                      }}>{t?.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{item.title}</div>
                        <div style={{ fontSize:12, color:G.textMuted }}>{item.date}</div>
                      </div>
                      <span style={{
                        fontSize:11, fontWeight:600, color:t?.color,
                        background:t?.color+"18", padding:"3px 9px", borderRadius:99,
                      }}>{t?.label}</span>
                      <button onClick={() => setHistory(h => h.filter(i => i.id !== item.id))} style={{
                        background:"none", border:"none", cursor:"pointer", color:G.textMuted, fontSize:16, padding:4,
                      }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          onUpgrade={() => { setUser(u => ({...u, plan:"pro"})); setShowPricing(false); }}
        />
      )}
    </div>
  );
}
