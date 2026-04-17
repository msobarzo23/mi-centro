import { useState, useEffect } from "react";
import { Lock, ArrowRight } from "lucide-react";

const SESSION_KEY = "mi_centro_auth";
const EXPECTED = import.meta.env.VITE_APP_PASSWORD || "";

export function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === "ok"; } catch { return false; }
  });
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);

  // Si no hay password configurado (dev local), pasa directo
  useEffect(() => {
    if (!EXPECTED) setAuthed(true);
  }, []);

  if (authed) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pwd === EXPECTED) {
      setAuthed(true);
      try { sessionStorage.setItem(SESSION_KEY, "ok"); } catch {}
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 800);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 18, padding: "40px 36px",
        maxWidth: 400, width: "100%",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 24, right: 24, height: 2,
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
        }}/>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "var(--accent-bg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <Lock size={22} color="var(--accent)" strokeWidth={2.2} />
          </div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.8, marginBottom: 6 }}>
            Centro de Gestión
          </div>
          <div style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            Uso personal de Miguel Sobarzo
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            className={err ? "pulse-soft" : ""}
            style={{
              padding: "12px 16px",
              background: "var(--bg-surface-2)",
              border: `1px solid ${err ? "var(--red)" : "var(--border-strong)"}`,
              borderRadius: 10,
              color: "var(--tx)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              outline: "none",
              transition: "border 0.15s",
            }}
          />
          <button type="submit" style={{
            padding: "12px 16px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity 0.15s",
          }}>
            Entrar <ArrowRight size={14} />
          </button>
        </form>
        <div style={{ fontSize: 10.5, color: "var(--tx-faint)", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
          Tus datos nunca salen de este navegador.<br/>
          El archivo de cobranzas se procesa localmente.
        </div>
      </div>
    </div>
  );
}
