import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Bar, Line, ReferenceLine, ReferenceArea,
} from "recharts";
import {
  Calendar, TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight,
  Clock, Info, Receipt, PiggyBank, CreditCard, Truck, Shield,
  AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { SectionCard, KpiCard, DataTable, StatusBadge, EmptyState, ChartTooltip } from "../components/common.jsx";
import {
  fmtM, fmtFull, fmtDateMed, fmtDateShort, fmtPct, todayMidnight,
  startOfWeek, endOfWeek, MESES_SHORT,
} from "../utils/helpers_v2.js";
import { buildSugerenciasRescate, formatPlan } from "../utils/rescate.js";

export function FlujoCaja({ C, cobranzas }) {
  const flujo = useMemo(() => buildFlujo(C, cobranzas), [C, cobranzas]);
  const sugerencias = useMemo(() => {
    if (!C) return {};
    return buildSugerenciasRescate(flujo.semanas, {
      fondos: C.fondos || [],
      dapsInv: C.dapsInversion || [],
      dapsCred: C.dapsCredito || [],
    });
  }, [flujo.semanas, C]);

  if (!C) return null;

  // Referencia horizontal del "colchón" en MM (positivo arriba de cero para referencia visual
  // del pool disponible; también marcamos -colchonTotal como "piso real" si se usa todo)
  const colchonMM = (C.colchonTotal || 0) / 1e6;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
          Flujo de caja proyectado
        </h1>
        <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
          Próximas 13 semanas · ingresos esperados vs compromisos · caja rodante con colchón disponible
        </p>
      </div>

      {/* KPIs resumen */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={ArrowDownRight}
          label="Ingresos esperados 90d"
          value={fmtM(flujo.totalIngresos90)}
          sub={cobranzas ? `${fmtM(flujo.totalCobranzasExistentes)} cobranzas + ${fmtM(flujo.totalCobranzasNuevas)} nueva facturación + ${fmtM(flujo.totalDAPsVence)} DAPs trabajo` : "Sin cobranzas cargadas"}
          color="var(--green)"
          colorBg="var(--green-bg)"
          highlight
        />
        <KpiCard
          icon={ArrowUpRight}
          label="Egresos 90d"
          value={fmtM(C.totalCompromisos90)}
          sub={`Calendario + leasing + cuota crédito`}
          color="var(--red)"
          colorBg="var(--red-bg)"
          highlight
        />
        <KpiCard
          icon={TrendingUp}
          label="Flujo neto 90d"
          value={(flujo.totalIngresos90 - C.totalCompromisos90 >= 0 ? "+" : "") + fmtM(flujo.totalIngresos90 - C.totalCompromisos90)}
          sub={`Caja inicial ${fmtM(C.totalCaja)}`}
          color={flujo.totalIngresos90 - C.totalCompromisos90 >= 0 ? "var(--green)" : "var(--red)"}
          colorBg={flujo.totalIngresos90 - C.totalCompromisos90 >= 0 ? "var(--green-bg)" : "var(--red-bg)"}
        />
        <KpiCard
          icon={Shield}
          label="Colchón disponible"
          value={fmtM(C.colchonTotal || 0)}
          sub={`FFMM ${fmtM(C.colchonFFMM)} + DAP Inv ${fmtM(C.colchonDAPInv)} + DAP Créd ${fmtM(C.colchonDAPCred)}`}
          color="var(--violet)"
          colorBg="var(--violet-bg)"
        />
      </div>

      {/* Alert: si la caja cae bajo cero en algún momento */}
      {flujo.semanasNegativas > 0 && (
        <AlertaRescate
          semanas={flujo.semanas}
          sugerencias={sugerencias}
          colchonTotal={C.colchonTotal || 0}
        />
      )}

      {/* Gráfico con línea de colchón */}
      <SectionCard
        title="Flujo semanal y caja rodante"
        subtitle={
          <>
            Barras verdes = ingresos · Rojas = egresos · Línea ámbar = caja proyectada
            {colchonMM > 0 && <> · Línea violeta punteada = techo del colchón (−{fmtM(C.colchonTotal)})</>}
          </>
        }
        icon={Calendar}
        color="var(--accent)"
      >
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={flujo.chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: "var(--tx-muted)", fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={55} interval={0} />
            <YAxis tick={{ fill: "var(--tx-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} width={60} />
            <Tooltip content={<ChartTooltip formatter={v => v != null ? `$${v.toFixed(1)}M` : "—"} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--tx-muted)" }} />
            <ReferenceLine y={0} stroke="var(--tx-faint)" strokeWidth={1} />
            {colchonMM > 0 && (
              <ReferenceLine
                y={-colchonMM}
                stroke="var(--violet)"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: `Piso con colchón (−${fmtM(C.colchonTotal)})`, position: "insideTopRight", fill: "var(--violet)", fontSize: 10, fontWeight: 600 }}
              />
            )}
            <Bar dataKey="ingresos" fill="var(--green)" fillOpacity={0.85} name="Ingresos" radius={[3, 3, 0, 0]} />
            <Bar dataKey="egresos" fill="var(--red)" fillOpacity={0.85} name="Egresos" radius={[3, 3, 0, 0]} />
            <Line dataKey="cajaAcumulada" type="monotone" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} name="Caja acumulada" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Tabla semana a semana con badges de rescate */}
      <SectionCard
        title="Detalle semana a semana"
        subtitle="Primera semana = esta · Caja inicial = caja actual, luego se arrastra · Badge en semanas negativas = plan de rescate"
        icon={Calendar}
        color="var(--accent)"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Sem", "Período", "Caja inicial", "Ingresos", "Egresos", "Neto", "Caja final", "Estado / Rescate"].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 10px",
                    textAlign: i <= 1 ? "left" : (i === 7 ? "left" : "right"),
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
              {flujo.semanas.map((s, i) => {
                const sug = sugerencias[i];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--tx)", fontWeight: 600 }}>
                      S{i + 1}
                      {i === 0 && <StatusBadge level="blue" size="sm" children="ACTUAL" />}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--tx-muted)", fontSize: 11.5 }}>{s.label2 || s.label}</td>
                    <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: s.cajaInicial >= 0 ? "var(--tx-muted)" : "var(--red)" }}>
                      {fmtM(s.cajaInicial)}
                    </td>
                    <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: s.ingresos > 0 ? "var(--green)" : "var(--tx-faint)" }}>
                      {s.ingresos > 0 ? "+" + fmtM(s.ingresos) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: s.egresos > 0 ? "var(--red)" : "var(--tx-faint)" }}>
                      {s.egresos > 0 ? "−" + fmtM(s.egresos) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: s.neto >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {s.neto >= 0 ? "+" : ""}{fmtM(s.neto)}
                    </td>
                    <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: s.cajaFinal >= 0 ? "var(--tx)" : "var(--red)", fontWeight: 700 }}>
                      {fmtM(s.cajaFinal)}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {s.cajaFinal >= 0 ? (
                        s.cajaFinal < 100000000
                          ? <StatusBadge level="amber" size="sm">Baja</StatusBadge>
                          : <StatusBadge level="green" size="sm">OK</StatusBadge>
                      ) : (
                        <RescateBadge sug={sug} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Desglose */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
        <SectionCard title="Desglose ingresos 90 días" icon={ArrowDownRight} color="var(--green)">
          <DesgloseIngresos flujo={flujo} cobranzas={cobranzas} />
        </SectionCard>
        <SectionCard title="Desglose egresos 90 días" icon={ArrowUpRight} color="var(--red)">
          <DesgloseEgresos flujo={flujo} C={C} />
        </SectionCard>
      </div>

      {/* Metodología */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Info size={14} color="var(--accent)" />
          <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>Cómo se calcula</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Ingresos esperados</strong>
            <span style={{ color: "var(--green)" }}>Cobranzas existentes:</span> facturas del archivo asignadas a la semana de su vencimiento real.<br/>
            <span style={{ color: "var(--green)" }}>Nueva facturación:</span> falta facturar del mes + proyección mes siguiente, cobrada con lag 45-75d.<br/>
            <span style={{ color: "var(--green)" }}>DAPs Trabajo:</span> solo vencimientos de trabajo (Inv y Créd NO entran aquí).
          </div>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Egresos</strong>
            Calendario financiero (columna Monto). Se asume que se pagan como los tienes agendados. La columna "Falta" solo se usa en el semáforo del Cockpit.
          </div>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Colchón</strong>
            Caja inicial S1 = caja bancaria actual. Si la caja rodante cae a negativo, el plan de rescate sugiere qué rescatar del colchón (FFMM primero, luego DAP Inv, al final DAP Créd). El piso real con colchón = −$colchón total.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Alerta de rescate — cuando hay semanas negativas
// ══════════════════════════════════════════════════════════════════════
function AlertaRescate({ semanas, sugerencias, colchonTotal }) {
  const [expanded, setExpanded] = useState(true);
  const negativas = semanas.filter(s => s.cajaFinal < 0);
  const peor = negativas.reduce((m, s) => s.cajaFinal < m.cajaFinal ? s : m, negativas[0]);
  const peorIdx = semanas.indexOf(peor);
  const peorNecesitado = Math.abs(peor.cajaFinal);
  const cubreTodo = colchonTotal >= peorNecesitado;

  return (
    <div style={{
      background: cubreTodo ? "var(--amber-bg)" : "var(--red-bg)",
      border: `1px solid ${cubreTodo ? "var(--amber-border)" : "var(--red-border)"}`,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={18} color={cubreTodo ? "var(--amber)" : "var(--red)"} />
          <div>
            <div className="serif" style={{ fontSize: 14, fontWeight: 700, color: cubreTodo ? "var(--amber)" : "var(--red)" }}>
              {cubreTodo
                ? `Caja cae negativa en ${negativas.length} semana${negativas.length > 1 ? "s" : ""} — el colchón alcanza`
                : `Caja cae negativa en ${negativas.length} semana${negativas.length > 1 ? "s" : ""} — colchón insuficiente`
              }
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tx-muted)", marginTop: 2 }}>
              Peor punto: S{peorIdx + 1} ({peor.label2 || peor.label}) con {fmtM(peor.cajaFinal)}. Colchón total: {fmtM(colchonTotal)}.
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} color="var(--tx-muted)" /> : <ChevronDown size={14} color="var(--tx-muted)" />}
      </button>
      {expanded && (
        <div className="fade-in" style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {negativas.slice(0, 5).map((s, i) => {
            const idx = semanas.indexOf(s);
            const sug = sugerencias[idx];
            if (!sug) return null;
            return (
              <div key={i} style={{
                padding: "10px 12px",
                background: "var(--bg-surface-2)",
                borderRadius: 8,
                fontSize: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ color: "var(--tx)" }}>
                    S{idx + 1} · {s.label2 || s.label} — caja {fmtM(s.cajaFinal)}
                  </strong>
                  {sug.faltante > 0 && (
                    <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, padding: "2px 8px", background: "var(--red-bg)", borderRadius: 999 }}>
                      FALTAN {fmtM(sug.faltante)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {sug.plan.map((p, pi) => (
                    <span key={pi} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px",
                      background: "var(--violet-bg)",
                      border: `1px solid var(--violet)33`,
                      borderRadius: 999,
                      fontSize: 11,
                      color: "var(--violet)",
                      fontWeight: 600,
                    }}>
                      {p.tipo === "ffmm" ? "FFMM" : p.tipo === "dap_inv" ? "DAP Inv" : "DAP Créd"}
                      <span style={{ color: "var(--tx)" }}>{fmtM(p.monto)}</span>
                      <span style={{ color: "var(--tx-muted)", fontSize: 10 }}>{p.label}</span>
                      {p.rompe && <span style={{ fontSize: 9, color: "var(--red)" }}>⚡ rompe</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RescateBadge({ sug }) {
  const [hover, setHover] = useState(false);
  if (!sug) return <StatusBadge level="red" size="sm">⚠ Negativa</StatusBadge>;

  const color = sug.faltante > 0 ? "var(--red)" : "var(--violet)";
  const bg = sug.faltante > 0 ? "var(--red-bg)" : "var(--violet-bg)";

  return (
    <div style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px",
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        color,
        cursor: "help",
      }}>
        <Shield size={10} /> Rescatar {fmtM(sug.cubierto)}
        {sug.faltante > 0 && <span style={{ color: "var(--red)" }}> · falta {fmtM(sug.faltante)}</span>}
      </span>
      {hover && sug.plan.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "var(--tooltip-bg)", color: "var(--tooltip-tx)",
          border: `1px solid ${color}55`, borderRadius: 10,
          padding: "10px 12px", fontSize: 11, lineHeight: 1.5,
          zIndex: 30, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", minWidth: 220, whiteSpace: "nowrap",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color }}>Plan de rescate</div>
          {sug.plan.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
              <span>{p.label}{p.rompe && " ⚡"}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtM(p.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
function buildFlujo(C, cobranzas) {
  const today = todayMidnight();
  const N_SEMANAS = 13;

  const semanas = [];
  for (let w = 0; w < N_SEMANAS; w++) {
    const inicio = startOfWeek(new Date(today.getTime() + w * 7 * 86400000));
    const fin = endOfWeek(inicio);
    semanas.push({
      n: w + 1,
      inicio, fin,
      label: `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}`,
      label2: `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")} — ${String(fin.getDate()).padStart(2, "0")}/${String(fin.getMonth() + 1).padStart(2, "0")}`,
      ingresos: 0,
      egresos: 0,
      detallesIng: [],
      detallesEgr: [],
    });
  }

  // EGRESOS
  C.calendario.filter(r => r.fecha >= today).forEach(r => {
    for (const s of semanas) {
      if (r.fecha >= s.inicio && r.fecha <= s.fin) {
        s.egresos += r.monto;
        s.detallesEgr.push({ fecha: r.fecha, concepto: r.concepto, monto: r.monto, tipo: "cal" });
        break;
      }
    }
  });

  // INGRESOS: (1) Facturas pendientes del archivo
  let totalCobranzasExistentes = 0;
  if (cobranzas) {
    Object.values(cobranzas.porCliente).forEach(c => {
      c.facturasPendientes.forEach(f => {
        if (f.critica) return;
        if (!f.vencimiento) return;
        let targetDate = f.vencimiento;
        if (targetDate < today) targetDate = today;
        for (const s of semanas) {
          if (targetDate >= s.inicio && targetDate <= s.fin) {
            s.ingresos += f.monto;
            s.detallesIng.push({
              fecha: f.vencimiento,
              concepto: `${c.nombre.slice(0, 30)} — folio ${f.folio}`,
              monto: f.monto,
              tipo: "cobranza",
              vencida: f.vencimiento < today,
            });
            totalCobranzasExistentes += f.monto;
            break;
          }
        }
      });
    });
  }

  // INGRESOS: (2) Nueva facturación
  let totalCobranzasNuevas = 0;
  if (C.faltaFacturarMesActual > 0) {
    const monto = C.faltaFacturarMesActual;
    const targetSemanas = [5, 6, 7, 8];
    const parte = monto / targetSemanas.length;
    targetSemanas.forEach(idx => {
      if (semanas[idx]) {
        semanas[idx].ingresos += parte;
        semanas[idx].detallesIng.push({ concepto: "Nueva facturación mes actual (lag cobranza)", monto: parte, tipo: "nueva" });
      }
    });
    totalCobranzasNuevas += monto;
  }
  if (C.proyFacturacionMesSiguiente > 0) {
    const monto = C.proyFacturacionMesSiguiente;
    const targetSemanas = [9, 10, 11, 12];
    const parte = monto / targetSemanas.length;
    targetSemanas.forEach(idx => {
      if (semanas[idx]) {
        semanas[idx].ingresos += parte;
        semanas[idx].detallesIng.push({ concepto: "Facturación proyectada mes siguiente (viajes × tasa)", monto: parte, tipo: "proy" });
      }
    });
    totalCobranzasNuevas += monto;
  }

  // INGRESOS: (3) DAPs Trabajo que vencen
  let totalDAPsVence = 0;
  C.daps.filter(d => d.vencimiento && d.vencimiento >= today && d.tipo === "trabajo").forEach(d => {
    const venc = d.vencimiento;
    for (const s of semanas) {
      if (venc >= s.inicio && venc <= s.fin) {
        const monto = d.montoFinal || d.monto;
        s.ingresos += monto;
        s.detallesIng.push({ fecha: venc, concepto: `DAP ${d.banco} vence`, monto, tipo: "dap" });
        totalDAPsVence += monto;
        break;
      }
    }
  });

  // Caja rodante
  let caja = C.totalCaja;
  semanas.forEach(s => {
    s.cajaInicial = caja;
    s.neto = s.ingresos - s.egresos;
    s.cajaFinal = caja + s.neto;
    caja = s.cajaFinal;
  });

  const totalIngresos90 = semanas.reduce((sum, s) => sum + s.ingresos, 0);
  const cajaFinal90 = semanas[semanas.length - 1]?.cajaFinal || 0;
  const semanasNegativas = semanas.filter(s => s.cajaFinal < 0).length;

  const chartData = semanas.map(s => ({
    label: s.label,
    ingresos: s.ingresos / 1e6,
    egresos: -s.egresos / 1e6,
    cajaAcumulada: s.cajaFinal / 1e6,
  }));

  return {
    semanas,
    totalIngresos90,
    totalCobranzasExistentes,
    totalCobranzasNuevas,
    totalDAPsVence,
    cajaFinal90,
    semanasNegativas,
    chartData,
  };
}

function DesgloseIngresos({ flujo, cobranzas }) {
  if (flujo.totalIngresos90 === 0) {
    return <div style={{ fontSize: 12, color: "var(--tx-muted)", padding: 16, textAlign: "center" }}>Sin ingresos proyectados</div>;
  }
  const items = [
    { label: "Cobranzas existentes", monto: flujo.totalCobranzasExistentes, desc: "Facturas ya emitidas que vencen próx. 90d", icon: Receipt, color: "var(--accent)" },
    { label: "Nueva facturación (lag)", monto: flujo.totalCobranzasNuevas, desc: "Viajes a facturar × tasa histórica, cobrados 45-75d", icon: Truck, color: "var(--teal)" },
    { label: "DAPs Trabajo vencen", monto: flujo.totalDAPsVence, desc: "DAPs Trabajo disponibles en ventana (no incluye Inv ni Créd)", icon: PiggyBank, color: "var(--violet)" },
  ];
  const total = flujo.totalIngresos90;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => {
        const pct = total > 0 ? (it.monto / total * 100) : 0;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--tx)" }}>
                <it.icon size={12} color={it.color} /> {it.label}
              </span>
              <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{fmtM(it.monto)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginBottom: 4 }}>{it.desc} · {pct.toFixed(0)}%</div>
            <div style={{ height: 4, background: "var(--bg-surface-3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: it.color, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesgloseEgresos({ flujo, C }) {
  const categorias = {};
  const today = todayMidnight();
  const limit = new Date(today); limit.setDate(limit.getDate() + 90);
  C.calendario.filter(r => r.fecha >= today && r.fecha <= limit).forEach(r => {
    const concepto = r.concepto.toUpperCase();
    let cat = "Otros";
    if (concepto.includes("LEASING")) cat = "Leasing";
    else if (concepto.includes("CREDIT") || concepto.includes("CRÉDIT") || concepto.includes("ITAU")) cat = "Crédito";
    else if (concepto.includes("COPEC") || concepto.includes("COMBUSTIBLE")) cat = "Combustible";
    else if (concepto.includes("NOMIN") || concepto.includes("SUELDO") || concepto.includes("REMUNER")) cat = "Nómina";
    else if (concepto.includes("PROVEED")) cat = "Proveedores";
    else if (concepto.includes("IMPUESTO") || concepto.includes("F29") || concepto.includes("IVA") || concepto.includes("SII")) cat = "Impuestos";
    else if (concepto.includes("SEGURO")) cat = "Seguros";
    categorias[cat] = (categorias[cat] || 0) + r.monto;
  });
  const items = Object.entries(categorias).sort((a, b) => b[1] - a[1]);
  const total = items.reduce((s, [, v]) => s + v, 0);
  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--tx-muted)", padding: 16, textAlign: "center" }}>Sin compromisos en 90 días</div>;
  }
  const colors = ["var(--red)", "var(--amber)", "var(--violet)", "var(--blue)", "var(--teal)", "var(--accent)", "var(--green)"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(([cat, monto], i) => {
        const pct = total > 0 ? (monto / total * 100) : 0;
        const color = colors[i % colors.length];
        return (
          <div key={cat}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: "var(--tx)" }}>{cat}</span>
              <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{fmtM(monto)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginBottom: 4 }}>{pct.toFixed(0)}% del total</div>
            <div style={{ height: 4, background: "var(--bg-surface-3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
