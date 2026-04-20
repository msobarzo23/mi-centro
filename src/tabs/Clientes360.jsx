import { useState, useMemo } from "react";
import {
  Users, Search, Globe, Building2, TrendingUp, TrendingDown,
  Clock, AlertTriangle, X, ChevronRight, Sparkles, Filter, BarChart3,
  Calendar as CalendarIcon,
} from "lucide-react";
import { SectionCard, KpiCard, StatusBadge } from "../components/common.jsx";
import { FileUploader } from "../components/FileUploader.jsx";
import { buildClientesMaestro, ESTADO_META } from "../utils/clientesMaestro.js";
import { fmtM, fmtFull, fmtDateMed, fmtPct, fmtNum, MESES_SHORT, todayMidnight } from "../utils/helpers_v2.js";

export function Clientes360({
  saldosRaw, historicoRaw, cobranzas, sheets,
  uploadSaldos, clearSaldos,
  uploadHistorico, clearHistorico,
}) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterCuenta, setFilterCuenta] = useState("todos"); // todos | nacional | internacional

  const maestro = useMemo(() => {
    if (!saldosRaw) return null;
    return buildClientesMaestro({
      rawRows: saldosRaw?.movimientos || [],
      historicoRows: historicoRaw?.movimientos || [],
      cobranzas,
      viajes: null,
      hoy: todayMidnight(),
    });
  }, [saldosRaw, historicoRaw, cobranzas]);

  // Onboarding si no hay saldos
  if (!saldosRaw || !maestro) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Clientes 360
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            Vista unificada: facturación mensual, DSO real, aging, tendencia vs trimestre anterior y estado clasificado.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx)", marginBottom: 8 }}>Saldos actuales (requerido)</div>
            <FileUploader onUpload={uploadSaldos} onClear={clearSaldos} current={saldosRaw} title="Sube los saldos" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx)", marginBottom: 8 }}>Histórico largo (muy recomendado)</div>
            <FileUploader onUpload={uploadHistorico} onClear={clearHistorico} current={historicoRaw} title="Sube el histórico" description="Informe amplio (1 año+) — solo para clasificación correcta." />
          </div>
        </div>
      </div>
    );
  }

  const clientes = maestro.clientes || [];

  const clientesFiltrados = clientes.filter(c => {
    if (search && !c.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEstado !== "todos" && c.estado !== filterEstado) return false;
    if (filterCuenta === "nacional" && c.esInternacional) return false;
    if (filterCuenta === "internacional" && !c.esInternacional) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Clientes 360
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            {clientes.length} clientes · {maestro.totales.nClientesActivos3m} activos últ. 3m · {maestro.totales.nInternacionales} internacionales
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <FileUploader compact current={saldosRaw} onUpload={uploadSaldos} />
          {historicoRaw && (
            <FileUploader compact current={historicoRaw} onUpload={uploadHistorico} />
          )}
        </div>
      </div>

      {/* Banner: histórico activo */}
      {maestro.usandoHistoricoLargo ? (
        <div style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--violet-bg)",
          border: "1px solid var(--violet)33",
          borderRadius: 10,
          fontSize: 11.5,
          color: "var(--violet)",
        }}>
          <Clock size={12} />
          <span>
            Clasificación usando histórico largo:{" "}
            <strong>{maestro.historicoFechaMin ? fmtDateMed(maestro.historicoFechaMin) : "?"} → {maestro.historicoFechaMax ? fmtDateMed(maestro.historicoFechaMax) : "?"}</strong>
            {" "}({Math.round(maestro.historicoCubreDias)} días)
          </span>
        </div>
      ) : historicoRaw ? null : (
        <div style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--amber-bg)",
          border: "1px solid var(--amber-border)",
          borderRadius: 10,
          fontSize: 11.5,
          color: "var(--amber)",
        }}>
          <AlertTriangle size={12} />
          <span>
            Clasificación con archivo actual únicamente ({Math.round(maestro.historicoCubreDias || 0)} días). Sube un histórico largo para clasificar correctamente clientes como MAXAM, ENAEX, Calidra.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard icon={Users} label="Clientes totales" value={fmtNum(clientes.length)} sub={`${maestro.totales.nClientesConSaldo} con saldo pendiente`} color="var(--accent)" colorBg="var(--accent-bg)" highlight />
        <KpiCard icon={TrendingUp} label="Facturación últ. 3m" value={fmtM(maestro.totales.facturacion3m)} sub={`${maestro.totales.nClientesActivos3m} clientes activos`} color="var(--green)" colorBg="var(--green-bg)" />
        <KpiCard icon={BarChart3} label="Facturación 12m" value={fmtM(maestro.totales.facturacion12m)} sub="Rolling últimos 12 meses" color="var(--teal)" colorBg="var(--teal-bg)" />
        <KpiCard icon={AlertTriangle} label="Saldo crítico" value={fmtM(maestro.totales.saldoCritico)} sub="Facturas +180 días (cobranza especial)" color="var(--violet)" colorBg="var(--violet-bg)" />
      </div>

      {/* Distribución por estado */}
      <SectionCard title="Distribución por estado" subtitle="Click en un estado para filtrar" icon={Sparkles} color="var(--accent)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {Object.entries(ESTADO_META).map(([key, meta]) => {
            const count = maestro.distribucionEstado[key] || 0;
            const active = filterEstado === key;
            return (
              <button
                key={key}
                onClick={() => setFilterEstado(active ? "todos" : key)}
                style={{
                  background: active ? meta.bg : "var(--bg-surface)",
                  border: `1px solid ${active ? meta.color : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  position: "relative",
                  overflow: "hidden",
                  opacity: count === 0 ? 0.5 : 1,
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: meta.color, opacity: active ? 1 : 0.6 }} />
                <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
                  {meta.label}
                </div>
                <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? meta.color : "var(--tx-faint)", letterSpacing: -0.5 }}>
                  {count}
                </div>
                <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: 3, lineHeight: 1.4 }}>
                  {meta.desc}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
          <Search size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--tx-muted)" }} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 30px",
              fontSize: 12.5, background: "var(--bg-surface)",
              border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--tx)", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "nacional", label: "Nacionales" },
            { id: "internacional", label: "Internacionales" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterCuenta(f.id)}
              style={{
                padding: "5px 11px",
                background: filterCuenta === f.id ? "var(--bg-surface)" : "transparent",
                border: "1px solid " + (filterCuenta === f.id ? "var(--border-strong)" : "transparent"),
                borderRadius: 6, fontSize: 11,
                color: filterCuenta === f.id ? "var(--tx)" : "var(--tx-muted)",
                cursor: "pointer", fontFamily: "inherit",
                fontWeight: filterCuenta === f.id ? 600 : 500,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(filterEstado !== "todos" || filterCuenta !== "todos") && (
          <button
            onClick={() => { setFilterEstado("todos"); setFilterCuenta("todos"); }}
            style={{ padding: "5px 11px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--tx-muted)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
          >
            <X size={10} /> Limpiar filtros
          </button>
        )}
        <div style={{ fontSize: 11, color: "var(--tx-muted)", marginLeft: "auto" }}>
          {clientesFiltrados.length} de {clientes.length}
        </div>
      </div>

      {/* Lista de clientes */}
      <SectionCard title="Lista de clientes" icon={Users} color="var(--accent)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Cliente", "", "Estado", "Fact. últ. 3m", "Δ vs 3m ant.", "Saldo pend.", "DSO", "Última factura", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 10px", textAlign: i <= 2 ? "left" : "right",
                    color: "var(--tx-muted)", fontWeight: 600, fontSize: 10.5,
                    borderBottom: "1px solid var(--border)", textTransform: "uppercase",
                    letterSpacing: 0.6, whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.slice(0, 100).map((c, i) => {
                const meta = ESTADO_META[c.estado] || ESTADO_META.activo;
                const delta = c.deltaPctVs3mAnterior;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelected(c)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 10px", color: "var(--tx)", fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nombre}
                    </td>
                    <td style={{ padding: "10px 4px" }}>
                      {c.esInternacional && (
                        <span title="Internacional" style={{ display: "inline-flex", padding: "2px 6px", background: "var(--blue-bg)", color: "var(--blue)", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                          <Globe size={9} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        display: "inline-flex", padding: "2px 8px",
                        background: meta.bg, color: meta.color,
                        borderRadius: 999, fontSize: 10, fontWeight: 700,
                        letterSpacing: 0.3,
                      }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.facturacionUlt3m > 0 ? "var(--tx)" : "var(--tx-faint)", fontWeight: 600 }}>
                      {c.facturacionUlt3m > 0 ? fmtM(c.facturacionUlt3m) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: deltaColor(delta) }}>
                      {delta != null ? `${delta > 0 ? "+" : ""}${Math.round(delta)}%` : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.saldoTotal > 0 ? "var(--tx)" : "var(--tx-faint)" }}>
                      {c.saldoTotal > 0 ? fmtM(c.saldoTotal) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: dsoColor(c.dsoProm) }}>
                      {c.dsoProm != null ? Math.round(c.dsoProm) + "d" : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx-muted)", fontSize: 11 }}>
                      {c.ultimaFactura ? fmtDateMed(c.ultimaFactura) : "—"}
                    </td>
                    <td style={{ padding: "10px 10px", color: "var(--tx-muted)" }}>
                      <ChevronRight size={13} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {clientesFiltrados.length > 100 && (
          <div style={{ fontSize: 11, color: "var(--tx-muted)", textAlign: "center", marginTop: 10 }}>
            Mostrando los primeros 100 de {clientesFiltrados.length}.
          </div>
        )}
      </SectionCard>

      {selected && <ClienteDrawer cliente={selected} maestro={maestro} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function ClienteDrawer({ cliente, maestro, onClose }) {
  const meta = ESTADO_META[cliente.estado] || ESTADO_META.activo;
  const heatMax = Math.max(...cliente.facturacionMensual.map(m => m.monto), 1);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(3px)" }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)", height: "100%",
          background: "var(--bg)", borderLeft: "1px solid var(--border)",
          overflowY: "auto", padding: "20px 24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              {cliente.esInternacional ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--blue-bg)", color: "var(--blue)", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                  <Globe size={9} /> INTERNACIONAL
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--accent-bg)", color: "var(--accent)", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                  <Building2 size={9} /> NACIONAL
                </span>
              )}
              <span style={{ display: "inline-flex", padding: "2px 8px", background: meta.bg, color: meta.color, borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                {meta.label}
              </span>
            </div>
            <h2 className="serif" style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.6, marginBottom: 4 }}>{cliente.nombre}</h2>
            {cliente.idFicha && <div style={{ fontSize: 11, color: "var(--tx-muted)", fontFamily: "var(--mono)" }}>{cliente.idFicha}</div>}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--tx-muted)", display: "flex" }}>
            <X size={14} />
          </button>
        </div>

        {/* Descripción estado */}
        <div style={{ padding: "10px 14px", background: meta.bg, borderRadius: 8, marginBottom: 16, fontSize: 12, color: meta.color, lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 700 }}>{meta.label}:</strong> {meta.desc}
        </div>

        {/* Alertas */}
        {cliente.alertas && cliente.alertas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Alertas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cliente.alertas.map((a, i) => (
                <div key={i} style={{ padding: "8px 12px", background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11.5, color: "var(--tx-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={12} color="var(--amber)" />
                  {a.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          <MiniStat label="Fact. últ. 3m" value={fmtM(cliente.facturacionUlt3m)} />
          <MiniStat
            label="Δ vs 3m anterior"
            value={cliente.deltaPctVs3mAnterior != null ? `${cliente.deltaPctVs3mAnterior > 0 ? "+" : ""}${Math.round(cliente.deltaPctVs3mAnterior)}%` : "—"}
            color={deltaColor(cliente.deltaPctVs3mAnterior)}
          />
          <MiniStat label="Fact. 12m" value={fmtM(cliente.facturacionUlt12m)} />
          <MiniStat label="Saldo pendiente" value={fmtM(cliente.saldoTotal)} color={cliente.saldoTotal > 0 ? "var(--accent)" : "var(--tx-faint)"} />
          <MiniStat label="DSO real" value={cliente.dsoProm != null ? `${Math.round(cliente.dsoProm)}d` : "—"} sub={cliente.nPagosObservados > 0 ? `${cliente.nPagosObservados} pagos` : "sin muestra"} color={dsoColor(cliente.dsoProm)} />
          <MiniStat label="Meses activos 12m" value={`${cliente.mesesConFacturacion12m}/12`} />
          <MiniStat label="Última factura" value={cliente.ultimaFactura ? fmtDateMed(cliente.ultimaFactura) : "—"} sub={cliente.diasDesdeUltimaVenta != null ? `hace ${cliente.diasDesdeUltimaVenta}d` : ""} />
          <MiniStat label="Primera factura" value={cliente.primeraFactura ? fmtDateMed(cliente.primeraFactura) : "—"} sub={cliente.primeraFacturaDiasAtras != null ? `hace ${cliente.primeraFacturaDiasAtras}d` : ""} />
          <MiniStat label="Participación" value={`${((cliente.participacion || 0) * 100).toFixed(1)}%`} sub="De facturación 3m" />
        </div>

        {/* Heatmap 12 meses */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarIcon size={11} /> Facturación mensual (últ. 12 meses)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
            {cliente.facturacionMensual.map((m, i) => {
              const intensity = m.monto / heatMax;
              const bg = m.monto === 0
                ? "var(--bg-surface-2)"
                : `rgba(217, 119, 6, ${0.15 + intensity * 0.65})`;
              const [year, month] = m.mes.split("-");
              return (
                <div
                  key={i}
                  title={`${m.mes}: ${fmtFull(m.monto)}`}
                  style={{
                    background: bg,
                    border: `1px solid ${m.monto > 0 ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 6,
                    padding: "8px 4px",
                    textAlign: "center",
                    cursor: "default",
                  }}
                >
                  <div style={{ fontSize: 9, color: "var(--tx-muted)", textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 600 }}>
                    {MESES_SHORT[parseInt(month, 10) - 1]}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: m.monto > 0 ? "var(--tx)" : "var(--tx-faint)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {m.monto > 0 ? fmtM(m.monto).replace("$", "") : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Facturas pendientes */}
        {cliente.facturasPendientes && cliente.facturasPendientes.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
              Facturas pendientes ({cliente.facturasPendientes.length})
            </div>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr>
                    {["Folio", "Vencimiento", "Atraso", "Monto", "Estado"].map((h, i) => (
                      <th key={i} style={{ padding: "7px 10px", textAlign: i === 0 || i === 1 ? "left" : i === 4 ? "right" : "right", color: "var(--tx-muted)", fontSize: 10, fontWeight: 600, borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cliente.facturasPendientes.slice(0, 20).map((f, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: f.critica ? "var(--violet-bg)" : "transparent" }}>
                      <td style={{ padding: "6px 10px", color: "var(--tx-muted)", fontFamily: "var(--mono)" }}>{f.folio || "—"}</td>
                      <td style={{ padding: "6px 10px", color: "var(--tx-muted)" }}>{f.vencimiento ? fmtDateMed(f.vencimiento) : "—"}</td>
                      <td className="tabular" style={{ padding: "6px 10px", textAlign: "right", color: f.diasAtraso > 0 ? "var(--red)" : "var(--tx-faint)" }}>
                        {f.diasAtraso > 0 ? `${f.diasAtraso}d` : "—"}
                      </td>
                      <td className="tabular" style={{ padding: "6px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 600 }}>{fmtM(f.monto)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>
                        {f.critica ? <StatusBadge level="violet" size="sm">Crítica</StatusBadge>
                         : f.diasAtraso > 60 ? <StatusBadge level="red" size="sm">Vencida</StatusBadge>
                         : f.diasAtraso > 0 ? <StatusBadge level="amber" size="sm">Atrasada</StatusBadge>
                         : <StatusBadge level="green" size="sm">Al día</StatusBadge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cliente.facturasPendientes.length > 20 && (
                <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--tx-muted)", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                  Mostrando 20 de {cliente.facturasPendientes.length}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px" }}>
      <div style={{ fontSize: 9.5, color: "var(--tx-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: 15, fontWeight: 700, color: color || "var(--tx)", letterSpacing: -0.3, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: "var(--tx-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function dsoColor(dso) {
  if (dso == null) return "var(--tx-faint)";
  if (dso <= 45) return "var(--green)";
  if (dso <= 60) return "var(--amber)";
  return "var(--red)";
}

function deltaColor(d) {
  if (d == null) return "var(--tx-faint)";
  if (d >= 10) return "var(--green)";
  if (d >= -10) return "var(--tx-muted)";
  if (d >= -40) return "var(--amber)";
  return "var(--red)";
}
