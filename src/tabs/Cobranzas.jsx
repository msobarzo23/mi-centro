import { useState, useMemo } from "react";
import {
  Receipt, AlertTriangle, Clock, Globe, Building2, Search, ChevronRight,
  TrendingDown, TrendingUp, CheckCircle2, XCircle, Filter, X,
} from "lucide-react";
import { SectionCard, KpiCard, StatusBadge, EmptyState } from "../components/common.jsx";
import { FileUploader } from "../components/FileUploader.jsx";
import { fmtM, fmtFull, fmtDateMed, fmtNum, normName, todayMidnight } from "../utils/format.js";

export function Cobranzas({
  cobranzas, C,
  saldosRaw, uploadSaldos, clearSaldos,
  historicoRaw, uploadHistorico, clearHistorico,
}) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos"); // todos | nacionales | internacionales | criticos
  const [bucketFocus, setBucketFocus] = useState(null); // null | "porVencer" | "vencidas_0_30" | ...

  // Si no hay saldos cargados: pantalla de onboarding
  if (!cobranzas || !saldosRaw) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Por cobrar
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            Sube el Informe por Análisis de Defontana para ver el aging, DSO y detalle por cliente.
          </p>
        </div>
        <FileUploader
          onUpload={uploadSaldos}
          onClear={clearSaldos}
          current={saldosRaw}
          title="Sube los saldos actuales"
          description="Informe por Análisis de Defontana. Puedes soltar el archivo de cuenta 1110401001 (Nacionales), 1110401002 (Internacionales), o ambos juntos."
        />
      </div>
    );
  }

  const clientes = cobranzas.clientesArray || [];
  const hoy = todayMidnight();

  // Filtros
  const clientesFiltrados = clientes.filter(c => {
    if (search && !c.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "nacionales" && c.esInternacional) return false;
    if (filter === "internacionales" && !c.esInternacional) return false;
    if (filter === "criticos" && c.montoCriticas <= 0) return false;
    return true;
  });

  // Aging buckets con labels
  const BUCKETS = [
    { key: "porVencer", label: "Por vencer", color: "var(--green)", bg: "var(--green-bg)" },
    { key: "vencidas_0_30", label: "1 a 30 días", color: "var(--amber)", bg: "var(--amber-bg)" },
    { key: "vencidas_31_60", label: "31 a 60 días", color: "var(--amber)", bg: "var(--amber-bg)" },
    { key: "vencidas_61_90", label: "61 a 90 días", color: "var(--red)", bg: "var(--red-bg)" },
    { key: "vencidas_91_180", label: "91 a 180 días", color: "var(--red)", bg: "var(--red-bg)" },
    { key: "vencidas_critica", label: "+180 días (crítica)", color: "var(--violet)", bg: "var(--violet-bg)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Por cobrar
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            {clientes.length} clientes con saldo · DSO global {cobranzas.dsoGlobal ? Math.round(cobranzas.dsoGlobal) + " días" : "sin muestra"} · {cobranzas.totalFacturasPendientes} facturas pendientes · al {fmtDateMed(cobranzas.fechaInforme)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <FileUploader compact current={saldosRaw} onUpload={uploadSaldos} />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={Receipt}
          label="Total pendiente"
          value={fmtM(cobranzas.totalPendiente)}
          sub={`${fmtNum(clientes.length)} clientes · ${fmtNum(cobranzas.totalFacturasPendientes)} facturas`}
          color="var(--accent)"
          colorBg="var(--accent-bg)"
          highlight
        />
        <KpiCard
          icon={CheckCircle2}
          label="Cobrable"
          value={fmtM(cobranzas.totalCobrable)}
          sub={`${((cobranzas.totalCobrable / cobranzas.totalPendiente) * 100).toFixed(0)}% del total`}
          color="var(--green)"
          colorBg="var(--green-bg)"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Vencido"
          value={fmtM(cobranzas.totalVencido)}
          sub={`${((cobranzas.totalVencido / cobranzas.totalPendiente) * 100).toFixed(0)}% del total`}
          color="var(--amber)"
          colorBg="var(--amber-bg)"
        />
        <KpiCard
          icon={XCircle}
          label="Crítico (+180d)"
          value={fmtM(cobranzas.totalCritico)}
          sub={`${cobranzas.aging.vencidas_critica.count} facturas · Cobranza especial`}
          color="var(--violet)"
          colorBg="var(--violet-bg)"
        />
        {cobranzas.totalPorCuenta?.internacional > 0 && (
          <KpiCard
            icon={Globe}
            label="Internacional"
            value={fmtM(cobranzas.totalPorCuenta.internacional)}
            sub={`${((cobranzas.totalPorCuenta.internacional / cobranzas.totalPendiente) * 100).toFixed(0)}% del total`}
            color="var(--blue)"
            colorBg="var(--blue-bg)"
          />
        )}
      </div>

      {/* Aging tablero */}
      <SectionCard
        title="Aging"
        subtitle="Click en un bucket para filtrar las facturas abajo"
        icon={Clock}
        color="var(--accent)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {BUCKETS.map(b => {
            const data = cobranzas.aging[b.key];
            const pct = cobranzas.totalPendiente > 0 ? (data.monto / cobranzas.totalPendiente) * 100 : 0;
            const active = bucketFocus === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setBucketFocus(active ? null : b.key)}
                style={{
                  background: active ? b.bg : "var(--bg-surface)",
                  border: `1px solid ${active ? b.color : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: b.color, opacity: active ? 1 : 0.5 }} />
                <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
                  {b.label}
                </div>
                <div className="serif tabular" style={{ fontSize: 18, fontWeight: 700, color: data.monto > 0 ? b.color : "var(--tx-faint)", letterSpacing: -0.5 }}>
                  {fmtM(data.monto)}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 3 }}>
                  {data.count} fact · {pct.toFixed(0)}%
                </div>
              </button>
            );
          })}
        </div>
        {bucketFocus && (
          <div style={{ marginTop: 14 }}>
            <BucketDetail bucket={cobranzas.aging[bucketFocus]} label={BUCKETS.find(b => b.key === bucketFocus).label} onClose={() => setBucketFocus(null)} />
          </div>
        )}
      </SectionCard>

      {/* Filtros de tabla */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
          <Search size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--tx-muted)" }} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 30px",
              fontSize: 12.5,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--tx)",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "nacionales", label: "Nacionales" },
            { id: "internacionales", label: "Internacionales" },
            { id: "criticos", label: "Con crítica" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "5px 11px",
                background: filter === f.id ? "var(--bg-surface)" : "transparent",
                border: "1px solid " + (filter === f.id ? "var(--border-strong)" : "transparent"),
                borderRadius: 6,
                fontSize: 11,
                color: filter === f.id ? "var(--tx)" : "var(--tx-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: filter === f.id ? 600 : 500,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--tx-muted)", marginLeft: "auto" }}>
          Mostrando {clientesFiltrados.length} de {clientes.length}
        </div>
      </div>

      {/* Tabla de clientes */}
      <SectionCard title="Clientes con saldo" icon={Receipt} color="var(--accent)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Cliente", "", "Saldo total", "Cobrable", "Crítico", "DSO", "# fact", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 10px",
                    textAlign: i <= 1 ? "left" : "right",
                    color: "var(--tx-muted)",
                    fontWeight: 600,
                    fontSize: 10.5,
                    borderBottom: "1px solid var(--border)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.slice(0, 100).map((c, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedClient(c)}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "10px 10px", color: "var(--tx)", fontWeight: 500, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.nombre}
                  </td>
                  <td style={{ padding: "10px 4px" }}>
                    {c.esInternacional && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "2px 7px",
                        background: "var(--blue-bg)",
                        color: "var(--blue)",
                        borderRadius: 999,
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                      }}>
                        <Globe size={9} /> INT
                      </span>
                    )}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 700 }}>
                    {fmtM(c.saldoPendiente)}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.montoCobrables > 0 ? "var(--green)" : "var(--tx-faint)" }}>
                    {c.montoCobrables > 0 ? fmtM(c.montoCobrables) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.montoCriticas > 0 ? "var(--violet)" : "var(--tx-faint)", fontWeight: c.montoCriticas > 0 ? 600 : 400 }}>
                    {c.montoCriticas > 0 ? fmtM(c.montoCriticas) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: dsoColor(c.dsoReal) }}>
                    {c.dsoReal != null ? `${Math.round(c.dsoReal)}d` : "—"}
                    {c.dsoReal != null && <span style={{ color: "var(--tx-faint)", fontSize: 9.5, marginLeft: 3 }}>({c.dsoMuestras})</span>}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx-muted)" }}>
                    {c.facturasCount}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx-muted)" }}>
                    <ChevronRight size={13} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientesFiltrados.length > 100 && (
          <div style={{ fontSize: 11, color: "var(--tx-muted)", textAlign: "center", marginTop: 10 }}>
            Mostrando los primeros 100 de {clientesFiltrados.length}. Filtra más arriba para ver otros.
          </div>
        )}
      </SectionCard>

      {/* Drawer detalle cliente */}
      {selectedClient && (
        <ClienteDrawer cliente={selectedClient} hoy={hoy} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function BucketDetail({ bucket, label, onClose }) {
  const ordenadas = [...bucket.facturas].sort((a, b) => b.monto - a.monto).slice(0, 30);
  return (
    <div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-surface-3, var(--bg-surface))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="serif" style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: "var(--tx-muted)", marginLeft: 10 }}>
            Top 30 por monto · {bucket.count} facturas · {fmtM(bucket.monto)} total
          </span>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--tx-muted)", padding: 4, display: "flex" }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--bg-surface-2)" }}>
            <tr>
              {["Cliente", "Folio", "Emisión", "Vencimiento", "Atraso", "Monto"].map((h, i) => (
                <th key={i} style={{ padding: "7px 10px", textAlign: i < 1 ? "left" : i > 3 ? "right" : "left", color: "var(--tx-muted)", fontWeight: 600, fontSize: 10, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 10px", color: "var(--tx)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.cliente}</td>
                <td style={{ padding: "6px 10px", color: "var(--tx-muted)", fontFamily: "var(--mono)" }}>{f.folio || "—"}</td>
                <td style={{ padding: "6px 10px", color: "var(--tx-muted)" }}>{f.fecha ? fmtDateMed(f.fecha) : "—"}</td>
                <td style={{ padding: "6px 10px", color: "var(--tx-muted)" }}>{f.vencimiento ? fmtDateMed(f.vencimiento) : "—"}</td>
                <td style={{ padding: "6px 10px", color: f.diasAtraso > 0 ? "var(--red)" : "var(--tx-faint)", textAlign: "right" }}>
                  {f.diasAtraso != null && f.diasAtraso > 0 ? `${f.diasAtraso}d` : "—"}
                </td>
                <td className="tabular" style={{ padding: "6px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 600 }}>{fmtM(f.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClienteDrawer({ cliente, hoy, onClose }) {
  const facturas = [...(cliente.facturasPendientes || [])].sort((a, b) => {
    // Críticas primero, luego por días de atraso desc
    if (a.critica !== b.critica) return a.critica ? -1 : 1;
    return (b.diasAtraso || 0) - (a.diasAtraso || 0);
  });
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 50,
        display: "flex", justifyContent: "flex-end",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          height: "100%",
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          overflowY: "auto",
          padding: "20px 24px",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {cliente.esInternacional ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--blue-bg)", color: "var(--blue)", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                  <Globe size={9} /> INTERNACIONAL
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--accent-bg)", color: "var(--accent)", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                  <Building2 size={9} /> NACIONAL
                </span>
              )}
            </div>
            <h2 className="serif" style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.6, marginBottom: 4 }}>
              {cliente.nombre}
            </h2>
            {cliente.rut && <div style={{ fontSize: 11, color: "var(--tx-muted)", fontFamily: "var(--mono)" }}>{cliente.rut}</div>}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--tx-muted)", display: "flex" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Saldo total" value={fmtM(cliente.saldoPendiente)} color="var(--accent)" />
          <StatCard label="DSO real" value={cliente.dsoReal != null ? Math.round(cliente.dsoReal) + " días" : "sin muestra"} sub={cliente.dsoMuestras > 0 ? `${cliente.dsoMuestras} pagos observados` : "matcheo folio no disponible"} color={dsoColor(cliente.dsoReal)} />
          <StatCard label="Cobrable" value={fmtM(cliente.montoCobrables)} sub={`${cliente.facturasCobrables?.length || 0} facturas ≤180d`} color="var(--green)" />
          <StatCard label="Crítico" value={fmtM(cliente.montoCriticas)} sub={cliente.facturasCriticas?.length > 0 ? `${cliente.facturasCriticas.length} facturas +180d` : "sin facturas críticas"} color="var(--violet)" />
        </div>

        <div className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)", marginBottom: 10 }}>
          Facturas pendientes ({facturas.length})
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>
                  {["Folio", "Emisión", "Vencimiento", "Atraso", "Monto", ""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", textAlign: i === 0 || i === 1 || i === 2 ? "left" : "right", color: "var(--tx-muted)", fontSize: 10, fontWeight: 600, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facturas.map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: f.critica ? "var(--violet-bg)" : "transparent" }}>
                    <td style={{ padding: "7px 10px", color: "var(--tx-muted)", fontFamily: "var(--mono)" }}>{f.folio || "—"}</td>
                    <td style={{ padding: "7px 10px", color: "var(--tx-muted)" }}>{f.fecha ? fmtDateMed(f.fecha) : "—"}</td>
                    <td style={{ padding: "7px 10px", color: "var(--tx-muted)" }}>{f.vencimiento ? fmtDateMed(f.vencimiento) : "—"}</td>
                    <td className="tabular" style={{ padding: "7px 10px", textAlign: "right", color: f.diasAtraso > 0 ? "var(--red)" : "var(--tx-faint)" }}>
                      {f.diasAtraso != null && f.diasAtraso > 0 ? `${f.diasAtraso}d` : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "7px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 600 }}>{fmtM(f.monto)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right" }}>
                      {f.critica ? <StatusBadge level="violet" size="sm">Crítica</StatusBadge>
                       : f.diasAtraso > 60 ? <StatusBadge level="red" size="sm">Vencida</StatusBadge>
                       : f.diasAtraso > 0 ? <StatusBadge level="amber" size="sm">Atrasada</StatusBadge>
                       : <StatusBadge level="green" size="sm">Al día</StatusBadge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: "var(--tx-muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: 18, fontWeight: 700, color: color || "var(--tx)", letterSpacing: -0.4, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function dsoColor(dso) {
  if (dso == null) return "var(--tx-faint)";
  if (dso <= 45) return "var(--green)";
  if (dso <= 60) return "var(--amber)";
  return "var(--red)";
}
