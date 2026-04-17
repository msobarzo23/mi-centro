import { useState, useEffect } from "react";
import {
  LayoutDashboard, TrendingUp, Receipt, Truck,
  Moon, Sun, RefreshCw, AlertCircle, Loader2,
} from "lucide-react";
import { PasswordGate } from "./components/PasswordGate.jsx";
import { useData } from "./hooks/useData.js";
import { useCompute } from "./hooks/useCompute.js";
import { Cockpit } from "./tabs/Cockpit.jsx";
import { FlujoCaja } from "./tabs/FlujoCaja.jsx";
import { Cobranzas } from "./tabs/Cobranzas.jsx";
import { CicloViajes } from "./tabs/CicloViajes.jsx";
import { fmtDateMed } from "./utils/format.js";

const TABS = [
  { id: "cockpit", label: "Cockpit", icon: LayoutDashboard, color: "var(--accent)" },
  { id: "flujo", label: "Flujo 90d", icon: TrendingUp, color: "var(--green)" },
  { id: "cobranzas", label: "Por cobrar", icon: Receipt, color: "var(--violet)" },
  { id: "ciclo", label: "Ciclo viajes", icon: Truck, color: "var(--teal)" },
];

function AppInner() {
  const [tab, setTab] = useState("cockpit");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("mi_centro_theme") || "dark"; } catch { return "dark"; }
  });
  const data = useData();
  const C = useCompute(data.sheets, data.cobranzas);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("mi_centro_theme", theme); } catch {}
  }, [theme]);

  if (data.loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
      }}>
        <Loader2 size={32} color="var(--accent)" className="spinning" />
        <div style={{ fontSize: 13, color: "var(--tx-muted)" }}>Cargando datos…</div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40,
      }}>
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--red-border)",
          borderRadius: 14, padding: 32, maxWidth: 500, textAlign: "center",
        }}>
          <AlertCircle size={32} color="var(--red)" style={{ marginBottom: 16 }} />
          <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: "var(--tx)", marginBottom: 8 }}>
            Error cargando datos
          </div>
          <div style={{ fontSize: 13, color: "var(--tx-muted)", marginBottom: 20 }}>
            {data.error}
          </div>
          <button
            onClick={data.refresh}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (tab) {
      case "cockpit":
        return <Cockpit
          C={C}
          cobranzas={data.cobranzas}
          cobranzasRaw={data.cobranzasRaw}
          uploadCobranzas={data.uploadCobranzas}
          clearCobranzas={data.clearCobranzas}
          setTab={setTab}
        />;
      case "flujo":
        return <FlujoCaja C={C} cobranzas={data.cobranzas} />;
      case "cobranzas":
        return <Cobranzas
          cobranzas={data.cobranzas}
          cobranzasRaw={data.cobranzasRaw}
          uploadCobranzas={data.uploadCobranzas}
          clearCobranzas={data.clearCobranzas}
          sheets={data.sheets}
        />;
      case "ciclo":
        return <CicloViajes C={C} cobranzas={data.cobranzas} sheets={data.sheets} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        backdropFilter: "saturate(150%) blur(10px)",
      }} className="no-print">
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-serif)", fontWeight: 800, fontSize: 18, color: "#fff",
            }}>M</div>
            <div className="hide-mobile">
              <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.3 }}>
                Centro de Gestión
              </div>
              <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: -1 }}>Miguel Sobarzo</div>
            </div>
          </div>

          {/* Tabs */}
          <nav style={{ flex: 1, display: "flex", gap: 4, justifyContent: "center", minWidth: 0, overflowX: "auto" }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px",
                    background: active ? t.color + "1a" : "transparent",
                    border: active ? `1px solid ${t.color}55` : "1px solid transparent",
                    borderRadius: 8,
                    color: active ? t.color : "var(--tx-muted)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {data.lastUpdate && (
              <div className="hide-mobile" style={{ fontSize: 10.5, color: "var(--tx-faint)", textAlign: "right" }}>
                <div>Act. {fmtTime(data.lastUpdate)}</div>
              </div>
            )}
            <button
              onClick={data.refresh}
              title="Actualizar datos"
              style={{
                padding: 8,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--tx-muted)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Cambiar tema"
              style={{
                padding: 8,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--tx-muted)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {renderTab()}
      </main>

      {/* Footer */}
      <footer style={{ padding: "32px 24px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 10.5, color: "var(--tx-faint)", lineHeight: 1.5 }}>
          Transportes Bello e Hijos Ltda. · Centro de Gestión Personal v1.0
          <br/>
          Procesamiento local · Datos sincronizados desde tus Google Sheets
        </div>
      </footer>
    </div>
  );
}

function fmtTime(d) {
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  return (
    <PasswordGate>
      <AppInner />
    </PasswordGate>
  );
}
