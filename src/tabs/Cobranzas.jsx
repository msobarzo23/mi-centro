import { useState, useMemo } from "react";
import {
  Receipt, AlertTriangle, Clock, TrendingDown, Search,
  ChevronDown, ChevronRight, Building2, FileText, Calendar,
  CheckCircle2, XCircle, Download,
} from "lucide-react";
import { SectionCard, KpiCard, StatusBadge, EmptyState } from "../components/common.jsx";
import { FileUploader } from "../components/FileUploader.jsx";
import { fmtM, fmtFull, fmtDateMed, fmtNum, fmtPct, fmtPctNoSign } from "../utils/format.js";

export function Cobranzas({ cobranzas, cobranzasRaw, uploadCobranzas, clearCobranzas, sheets }) {
  const [query, setQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [sortBy, setSortBy] = useState("monto"); // monto | dso | cantidad | vencidas

  // Sin archivo cargado: mostrar uploader grande
  if (!cobranzas) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Cuentas por cobrar
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            Aging de la cuenta 1110401001 — Clientes Nacionales
          </p>
        </div>
        <SectionCard title="Sube el informe de Defontana" icon={Receipt} color="var(--accent)">
          <FileUploader onUpload={uploadCobranzas} onClear={clearCobranzas} current={cobranzasRaw} />
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-surface-2)", borderRadius: 10, fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--tx)" }}>Cómo exportarlo:</strong> en Defontana → Informe por Análisis → Cuenta <strong style={{ color: "var(--tx)" }}>1110401001 Clientes Nacionales</strong> → descarga .xlsx. El app procesa todo localmente en tu navegador; nada sale de este equipo.
          </div>
        </SectionCard>
      </div>
    );
  }

  // Cliente seleccionado para drill-down
  if (selectedCliente) {
    const c = cobranzas.porCliente[selectedCliente];
    if (!c) { setSelectedCliente(null); return null; }
    return (
      <DetalleCliente
        cliente={c}
        onBack={() => setSelectedCliente(null)}
        cobranzas={cobranzas}
      />
    );
  }

  // Filtrar por búsqueda
  const clientes = useMemo(() => {
    let arr = cobranzas.clientesArray.filter(c => c.saldoPendiente > 0);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      arr = arr.filter(c => c.nombre.toLowerCase().includes(q) || (c.rut || "").includes(q));
    }
    switch (sortBy) {
      case "dso":
        arr = [...arr].sort((a, b) => (b.dsoReal || 0) - (a.dsoReal || 0));
        break;
      case "cantidad":
        arr = [...arr].sort((a, b) => b.facturasPendientes.length - a.facturasPendientes.length);
        break;
      case "vencidas":
        arr = [...arr].sort((a, b) => {
          const av = a.facturasPendientes.filter(f => f.diasAtraso > 0).reduce((s, f) => s + f.monto, 0);
          const bv = b.facturasPendientes.filter(f => f.diasAtraso > 0).reduce((s, f) => s + f.monto, 0);
          return bv - av;
        });
        break;
      default:
        arr = [...arr].sort((a, b) => b.saldoPendiente - a.saldoPendiente);
    }
    return arr;
  }, [cobranzas, query, sortBy]);

  const aging = cobranzas.aging;
  const totalVencido = aging.vencidas_0_30.monto + aging.vencidas_31_60.monto + aging.vencidas_61_90.monto + aging.vencidas_90plus.monto;
  const totalVencidoCount = aging.vencidas_0_30.count + aging.vencidas_31_60.count + aging.vencidas_61_90.count + aging.vencidas_90plus.count;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
            Cuentas por cobrar
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
            {cobranzas.clientesArray.length} clientes · informe al {fmtDateMed(cobranzas.fechaInforme)}
          </p>
        </div>
        <FileUploader compact current={cobranzasRaw} onUpload={uploadCobranzas} />
      </div>

      {/* KPIs principales */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={Receipt}
          label="Total por cobrar"
          value={fmtM(cobranzas.totalPendiente)}
          sub={`${cobranzas.totalFacturasPendientes} facturas · ${cobranzas.clientesArray.filter(c => c.saldoPendiente > 0).length} clientes`}
          color="var(--accent)"
          colorBg="var(--accent-bg)"
          highlight
        />
        <KpiCard
          icon={AlertTriangle}
          label="Total vencido"
          value={fmtM(totalVencido)}
          sub={`${totalVencidoCount} facturas · ${cobranzas.totalPendiente > 0 ? fmtPctNoSign(totalVencido / cobranzas.totalPendiente * 100) : "0%"} del total`}
          color={totalVencido > cobranzas.totalPendiente * 0.2 ? "var(--red)" : "var(--amber)"}
          colorBg={totalVencido > cobranzas.totalPendiente * 0.2 ? "var(--red-bg)" : "var(--amber-bg)"}
          highlight
        />
        <KpiCard
          icon={Clock}
          label="DSO promedio"
          value={cobranzas.dsoGlobal ? Math.round(cobranzas.dsoGlobal) + " días" : "—"}
          sub={cobranzas.dsoGlobal ? (cobranzas.dsoGlobal <= 35 ? "Dentro de rango" : cobranzas.dsoGlobal <= 50 ? "Elevado" : "Crítico") : "Sin historial"}
          color={!cobranzas.dsoGlobal ? "var(--tx-muted)" : cobranzas.dsoGlobal <= 35 ? "var(--green)" : cobranzas.dsoGlobal <= 50 ? "var(--amber)" : "var(--red)"}
          colorBg={!cobranzas.dsoGlobal ? "var(--bg-surface-3)" : cobranzas.dsoGlobal <= 35 ? "var(--green-bg)" : cobranzas.dsoGlobal <= 50 ? "var(--amber-bg)" : "var(--red-bg)"}
        />
        <KpiCard
          icon={TrendingDown}
          label="+90 días vencidas"
          value={fmtM(aging.vencidas_90plus.monto)}
          sub={`${aging.vencidas_90plus.count} facturas críticas`}
          color={aging.vencidas_90plus.monto > 0 ? "var(--red)" : "var(--green)"}
          colorBg={aging.vencidas_90plus.monto > 0 ? "var(--red-bg)" : "var(--green-bg)"}
        />
      </div>

      {/* Aging buckets */}
      <SectionCard
        title="Aging de cartera"
        subtitle="Distribución de facturas por días desde vencimiento"
        icon={Calendar}
        color="var(--accent)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <AgingBucket
            label="Por vencer"
            count={aging.porVencer.count}
            monto={aging.porVencer.monto}
            total={cobranzas.totalPendiente}
            color="var(--green)"
            description="Aún no vencidas"
          />
          <AgingBucket
            label="1 — 30 días"
            count={aging.vencidas_0_30.count}
            monto={aging.vencidas_0_30.monto}
            total={cobranzas.totalPendiente}
            color="var(--amber)"
            description="Recién vencidas"
          />
          <AgingBucket
            label="31 — 60 días"
            count={aging.vencidas_31_60.count}
            monto={aging.vencidas_31_60.monto}
            total={cobranzas.totalPendiente}
            color="var(--accent)"
            description="Seguimiento"
          />
          <AgingBucket
            label="61 — 90 días"
            count={aging.vencidas_61_90.count}
            monto={aging.vencidas_61_90.monto}
            total={cobranzas.totalPendiente}
            color="var(--red)"
            description="Gestión urgente"
          />
          <AgingBucket
            label="+90 días"
            count={aging.vencidas_90plus.count}
            monto={aging.vencidas_90plus.monto}
            total={cobranzas.totalPendiente}
            color="var(--red)"
            description="Riesgo alto"
            critical
          />
        </div>
      </SectionCard>

      {/* Filtros y tabla de clientes */}
      <SectionCard
        title={`Clientes con saldo pendiente — ${clientes.length}`}
        subtitle="Click en cualquier fila para ver las facturas del cliente"
        icon={Building2}
        color="var(--accent)"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={12} color="var(--tx-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Buscar cliente o RUT"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  padding: "6px 12px 6px 28px",
                  background: "var(--bg-surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--tx)",
                  fontSize: 11.5,
                  outline: "none",
                  fontFamily: "inherit",
                  width: 180,
                }}
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: "6px 10px",
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--tx)",
                fontSize: 11.5,
                outline: "none",
                fontFamily: "inherit",
              }}
            >
              <option value="monto">Por monto</option>
              <option value="dso">Por DSO</option>
              <option value="vencidas">Por vencidas</option>
              <option value="cantidad">Por # facturas</option>
            </select>
          </div>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Cliente", "RUT", "Facturas", "Pendiente", "DSO real", "Vencido", "Vence en 30d", "Acción"].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 10px",
                    textAlign: i === 0 || i === 1 ? "left" : "right",
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
              {clientes.map((c, i) => {
                const vencidas = c.facturasPendientes.filter(f => f.diasAtraso > 0);
                const vencidasMonto = vencidas.reduce((s, f) => s + f.monto, 0);
                const prox30 = c.facturasPendientes.filter(f => f.vencimiento && f.diasAtraso != null && f.diasAtraso <= 0 && f.diasAtraso >= -30).reduce((s, f) => s + f.monto, 0);
                const dsoColor = !c.dsoReal ? "var(--tx-muted)" : c.dsoReal <= 35 ? "var(--green)" : c.dsoReal <= 50 ? "var(--amber)" : "var(--red)";
                const pctVsTotal = cobranzas.totalPendiente > 0 ? (c.saldoPendiente / cobranzas.totalPendiente * 100) : 0;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedCliente(Object.keys(cobranzas.porCliente).find(k => cobranzas.porCliente[k].nombre === c.nombre))}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-surface-2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 10px", color: "var(--tx)", fontWeight: 500, maxWidth: 280 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</span>
                        <span style={{ fontSize: 10, color: "var(--tx-faint)" }}>
                          {pctVsTotal.toFixed(1)}% del total
                        </span>
                      </div>
                    </td>
                    <td className="mono" style={{ padding: "10px 10px", color: "var(--tx-muted)", fontSize: 11 }}>{c.rut}</td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx-muted)" }}>
                      {c.facturasPendientes.length}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 700 }}>
                      {fmtM(c.saldoPendiente)}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: dsoColor, fontWeight: 600 }}>
                      {c.dsoReal ? Math.round(c.dsoReal) + "d" : "—"}
                      {c.dsoMuestras > 0 && <span style={{ color: "var(--tx-faint)", fontSize: 10, marginLeft: 4 }}>n={c.dsoMuestras}</span>}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: vencidasMonto > 0 ? "var(--red)" : "var(--tx-faint)", fontWeight: vencidasMonto > 0 ? 700 : 400 }}>
                      {vencidasMonto > 0 ? fmtM(vencidasMonto) : "—"}
                      {vencidas.length > 0 && <span style={{ color: "var(--tx-faint)", fontSize: 10, marginLeft: 4 }}>({vencidas.length})</span>}
                    </td>
                    <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: prox30 > 0 ? "var(--green)" : "var(--tx-faint)" }}>
                      {prox30 > 0 ? fmtM(prox30) : "—"}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <ChevronRight size={14} color="var(--tx-muted)" style={{ display: "inline-block" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function AgingBucket({ label, count, monto, total, color, description, critical }) {
  const pct = total > 0 ? (monto / total * 100) : 0;
  return (
    <div style={{
      background: critical && monto > 0 ? `${color}15` : "var(--bg-surface-2)",
      border: `1px solid ${critical && monto > 0 ? color + "55" : "var(--border)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      {critical && monto > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <AlertTriangle size={12} color={color} />
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div className="serif tabular" style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.6, lineHeight: 1.1, marginBottom: 4 }}>
        {fmtM(monto)}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginBottom: 8 }}>
        {count} {count === 1 ? "factura" : "facturas"} · {pct.toFixed(1)}%
      </div>
      <div style={{ height: 3, background: "var(--bg-surface-3)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--tx-faint)", marginTop: 6, fontStyle: "italic" }}>
        {description}
      </div>
    </div>
  );
}

function DetalleCliente({ cliente, onBack, cobranzas }) {
  const vencidas = cliente.facturasPendientes.filter(f => f.diasAtraso > 0).sort((a, b) => b.diasAtraso - a.diasAtraso);
  const porVencer = cliente.facturasPendientes.filter(f => !f.diasAtraso || f.diasAtraso <= 0).sort((a, b) => (a.vencimiento || 0) - (b.vencimiento || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            color: "var(--tx-muted)",
            fontSize: 11.5,
            cursor: "pointer",
            marginBottom: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
          }}
        >
          ← Volver a todos los clientes
        </button>
        <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.8, marginBottom: 4 }}>
          {cliente.nombre}
        </h1>
        <p className="mono" style={{ fontSize: 12, color: "var(--tx-muted)" }}>
          {cliente.rut}
        </p>
      </div>

      {/* KPIs del cliente */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={Receipt}
          label="Saldo pendiente"
          value={fmtM(cliente.saldoPendiente)}
          sub={`${cliente.facturasPendientes.length} facturas por cobrar`}
          color="var(--accent)"
          colorBg="var(--accent-bg)"
          highlight
        />
        <KpiCard
          icon={Clock}
          label="DSO real"
          value={cliente.dsoReal ? Math.round(cliente.dsoReal) + " días" : "—"}
          sub={cliente.dsoMuestras > 0 ? `Basado en ${cliente.dsoMuestras} pagos históricos` : "Sin pagos registrados"}
          color={!cliente.dsoReal ? "var(--tx-muted)" : cliente.dsoReal <= 35 ? "var(--green)" : cliente.dsoReal <= 50 ? "var(--amber)" : "var(--red)"}
          colorBg={!cliente.dsoReal ? "var(--bg-surface-3)" : cliente.dsoReal <= 35 ? "var(--green-bg)" : cliente.dsoReal <= 50 ? "var(--amber-bg)" : "var(--red-bg)"}
        />
        <KpiCard
          icon={TrendingDown}
          label="Facturado histórico"
          value={fmtM(cliente.totalCargo)}
          sub={`Cobrado ${fmtM(cliente.totalAbono)} (${((cliente.totalAbono / Math.max(cliente.totalCargo, 1)) * 100).toFixed(0)}%)`}
          color="var(--tx-muted)"
          colorBg="var(--bg-surface-3)"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Facturas vencidas"
          value={vencidas.length.toString()}
          sub={vencidas.length > 0 ? `${fmtM(vencidas.reduce((s, f) => s + f.monto, 0))} total` : "Ninguna atrasada"}
          color={vencidas.length > 0 ? "var(--red)" : "var(--green)"}
          colorBg={vencidas.length > 0 ? "var(--red-bg)" : "var(--green-bg)"}
        />
      </div>

      {/* Facturas vencidas */}
      {vencidas.length > 0 && (
        <SectionCard
          title={`Facturas vencidas — ${vencidas.length}`}
          subtitle="Ordenadas por días de atraso (más urgente arriba)"
          icon={AlertTriangle}
          color="var(--red)"
        >
          <FacturasTable facturas={vencidas} showAtraso />
        </SectionCard>
      )}

      {/* Facturas por vencer */}
      {porVencer.length > 0 && (
        <SectionCard
          title={`Por vencer — ${porVencer.length}`}
          subtitle="Ordenadas por fecha de vencimiento"
          icon={Calendar}
          color="var(--green)"
        >
          <FacturasTable facturas={porVencer} />
        </SectionCard>
      )}
    </div>
  );
}

function FacturasTable({ facturas, showAtraso }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["Folio", "Documento", "Fecha emisión", "Vencimiento", showAtraso ? "Días atraso" : "En días", "Monto"].map((h, i) => (
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
          {facturas.map((f, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="mono" style={{ padding: "8px 10px", color: "var(--tx)" }}>{f.folio}</td>
              <td style={{ padding: "8px 10px", color: "var(--tx-muted)", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.documento}
              </td>
              <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: "var(--tx-muted)" }}>
                {fmtDateMed(f.fecha)}
              </td>
              <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 500 }}>
                {fmtDateMed(f.vencimiento)}
              </td>
              <td className="tabular" style={{
                padding: "8px 10px",
                textAlign: "right",
                color: showAtraso ? "var(--red)" : f.diasAtraso > -7 ? "var(--amber)" : "var(--green)",
                fontWeight: 600,
              }}>
                {f.diasAtraso == null ? "—" :
                  showAtraso ? `${f.diasAtraso}d` :
                  f.diasAtraso > 0 ? `+${f.diasAtraso}d` :
                  f.diasAtraso === 0 ? "hoy" :
                  `en ${-f.diasAtraso}d`}
              </td>
              <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: "var(--tx)", fontWeight: 700 }}>
                {fmtFull(f.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
