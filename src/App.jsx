import { useState, useEffect } from "react";
import {
  LayoutDashboard, TrendingUp, Receipt, Truck, Users,
  RefreshCw, AlertCircle, Moon, Sun,
} from "lucide-react";
import { useData } from "./hooks/useData.js";
import { useCompute } from "./hooks/useCompute.js";
import { Cockpit } from "./tabs/Cockpit.jsx";
import { FlujoCaja } from "./tabs/FlujoCaja.jsx";
import { Cobranzas } from "./tabs/Cobranzas.jsx";
import { CicloViajes } from "./tabs/CicloViajes.jsx";
import { Clientes360 } from "./tabs/Clientes360.jsx";
import { fmtDateTime } from "./utils/helpers_v2.js";

const TABS = [
  { id: "cockpit", label: "Cockpit", icon: LayoutDashboard },
  { id: "flujo", label: "Flujo 90d", icon: TrendingUp },
  { id: "cobranzas", label: "Por cobrar", icon: Receipt },
  { id: "ciclo", label: "Ciclo viajes", icon: Truck },
  { id: "clientes", label: "Clientes 360", icon: Users },
];

export default function App() {
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("mi_centro_tab");
    return saved && TABS.some(t => t.id === saved) ? saved : "cockpit";
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("mi_centro_theme") || "dark");

  const {
    sheets,
    cobranzas,
    saldosRaw, historicoRaw,
    uploadSaldos, clearSaldos,
    uploadHistorico, clearHistorico,
    loading, error, lastUpdate, refresh,
  } = useData();

  const C = useCompute(sheets, cobranzas);

  useEffect(() => { localStorage.setItem("mi_centro_tab", tab); }, [tab]);
  useEffect(() => {
    localStorage.setItem("mi_centro_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (loading && !sheets) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--tx-muted)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinning" style={{ display: "inline-block", marginBottom: 12 }}>
            <RefreshCw size={22} color="var(--accent)" />
          </div>
          <div className="serif" style={{ fontSize: 15 }}>Cargando Centro de Gestión...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--tx)" }}>
      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--bg)", fontSize: 15, fontFamily: "var(--serif, 'Fraunces')", letterSpacing: -0.5 }}>
              M
            </div>
            <div>
              <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.4, lineHeight: 1 }}>
                Centro de Gestión
              </div>
              <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 2, letterSpacing: 0.3 }}>
                Transportes Bello · Miguel
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpdate && (
              <span style={{ fontSize: 10.5, color: "var(--tx-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: error ? "var(--red)" : "var(--green)" }} />
                Actualizado {fmtDateTime(lastUpdate)}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              title="Actualizar datos"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 10px", cursor: loading ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "var(--tx-muted)",
              }}
            >
              <RefreshCw size={11} className={loading ? "spinning" : ""} /> Refrescar
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Cambiar tema"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 9px", cursor: "pointer",
                display: "flex", alignItems: "center",
                color: "var(--tx-muted)",
              }}
            >
              {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <nav style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px", display: "flex", gap: 2, overflowX: "auto" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12.5, fontWeight: 600,
                color: tab === t.id ? "var(--tx)" : "var(--tx-muted)",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ maxWidth: 1440, margin: "12px auto 0", padding: "0 24px" }}>
          <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--red)" }}>
            <AlertCircle size={14} /> {error}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 24px 60px" }}>
        {tab === "cockpit" && (
          <Cockpit
            C={C}
            cobranzas={cobranzas}
            saldosRaw={saldosRaw}
            uploadSaldos={uploadSaldos}
            clearSaldos={clearSaldos}
            historicoRaw={historicoRaw}
            uploadHistorico={uploadHistorico}
            clearHistorico={clearHistorico}
            setTab={setTab}
          />
        )}
        {tab === "flujo" && (
          <FlujoCaja C={C} cobranzas={cobranzas} />
        )}
        {tab === "cobranzas" && (
          <Cobranzas
            cobranzas={cobranzas}
            saldosRaw={saldosRaw}
            uploadSaldos={uploadSaldos}
            clearSaldos={clearSaldos}
            historicoRaw={historicoRaw}
            uploadHistorico={uploadHistorico}
            clearHistorico={clearHistorico}
            C={C}
          />
        )}
        {tab === "ciclo" && (
          <CicloViajes C={C} cobranzas={cobranzas} />
        )}
        {tab === "clientes" && (
          <Clientes360
            saldosRaw={saldosRaw}
            historicoRaw={historicoRaw}
            cobranzas={cobranzas}
            sheets={sheets}
            uploadSaldos={uploadSaldos}
            clearSaldos={clearSaldos}
            uploadHistorico={uploadHistorico}
            clearHistorico={clearHistorico}
          />
        )}
      </main>
    </div>
  );
}
