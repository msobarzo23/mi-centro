import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Bar, Line, ReferenceLine, Area,
} from "recharts";
import {
  Calendar, TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight,
  Clock, Info, Receipt, PiggyBank, CreditCard, Truck,
} from "lucide-react";
import { SectionCard, KpiCard, DataTable, StatusBadge, EmptyState } from "../components/common.jsx";
import { ChartTooltip } from "../components/common.jsx";
import {
  fmtM, fmtFull, fmtDateMed, fmtDateShort, fmtPct, todayMidnight,
  startOfWeek, endOfWeek, MESES_SHORT,
} from "../utils/format.js";

export function FlujoCaja({ C, cobranzas }) {
  const flujo = useMemo(() => buildFlujo(C, cobranzas), [C, cobranzas]);

  if (!C) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
          Flujo de caja proyectado
        </h1>
        <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
          Próximas 13 semanas · ingresos esperados vs compromisos · caja rodante
        </p>
      </div>

      {/* KPIs resumen */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={ArrowDownRight}
          label="Ingresos esperados 90d"
          value={fmtM(flujo.totalIngresos90)}
          sub={cobranzas ? `${fmtM(flujo.totalCobranzasExistentes)} cobranzas + ${fmtM(flujo.totalCobranzasNuevas)} nueva facturación + ${fmtM(flujo.totalDAPsVence)} DAPs` : "Sin cobranzas cargadas"}
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
          icon={Clock}
          label="Caja proyectada final 90d"
          value={fmtM(flujo.cajaFinal90)}
          sub={flujo.semanasNegativas > 0 ? `⚠ ${flujo.semanasNegativas} semanas con saldo negativo` : "Siempre positivo"}
          color={flujo.cajaFinal90 >= 0 ? "var(--teal)" : "var(--red)"}
          colorBg={flujo.cajaFinal90 >= 0 ? "var(--teal-bg)" : "var(--red-bg)"}
        />
      </div>

      {/* Gráfico: barras de flujo + línea de caja acumulada */}
      <SectionCard
        title="Flujo semanal y caja rodante"
        subtitle={
          cobranzas
            ? "Barras verdes = ingresos esperados · Rojas = egresos · Línea ámbar = caja proyectada acumulada"
            : "Solo egresos (sube archivo de cobranzas para ver ingresos)"
        }
        icon={Calendar}
        color="var(--accent)"
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={flujo.chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: "var(--tx-muted)", fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={55} interval={0} />
            <YAxis tick={{ fill: "var(--tx-muted)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} width={55} />
            <Tooltip content={<ChartTooltip formatter={v => v != null ? `$${v.toFixed(1)}M` : "—"} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--tx-muted)" }} />
            <ReferenceLine y={0} stroke="var(--tx-faint)" />
            <Bar dataKey="ingresos" fill="var(--green)" fillOpacity={0.85} name="Ingresos" radius={[3, 3, 0, 0]} />
            <Bar dataKey="egresos" fill="var(--red)" fillOpacity={0.85} name="Egresos" radius={[3, 3, 0, 0]} />
            <Line dataKey="cajaAcumulada" type="monotone" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} name="Caja acumulada" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Tabla semana a semana */}
      <SectionCard
        title="Detalle semana a semana"
        subtitle="Primera semana = esta · Caja inicial = caja actual, luego se arrastra"
        icon={Calendar}
        color="var(--accent)"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Sem", "Período", "Caja inicial", "Ingresos", "Egresos", "Neto", "Caja final", "Estado"].map((h, i) => (
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
              {flujo.semanas.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--tx)", fontWeight: 600 }}>
                    S{i + 1}
                    {i === 0 && <StatusBadge level="blue" size="sm" children="ACTUAL" />}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--tx-muted)", fontSize: 11.5 }}>{s.label}</td>
                  <td className="tabular" style={{ padding: "8px 10px", textAlign: "right", color: "var(--tx-muted)" }}>
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
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {s.cajaFinal < 0 ? (
                      <StatusBadge level="red" size="sm">⚠ Negativa</StatusBadge>
                    ) : s.cajaFinal < 100000000 ? (
                      <StatusBadge level="amber" size="sm">Baja</StatusBadge>
                    ) : (
                      <StatusBadge level="green" size="sm">OK</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Desglose de ingresos y egresos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
        <SectionCard title="Desglose ingresos 90 días" icon={ArrowDownRight} color="var(--green)">
          <DesgloseIngresos flujo={flujo} cobranzas={cobranzas} />
        </SectionCard>
        <SectionCard title="Desglose egresos 90 días" icon={ArrowUpRight} color="var(--red)">
          <DesgloseEgresos flujo={flujo} C={C} />
        </SectionCard>
      </div>

      {/* Aclaración metodológica */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Info size={14} color="var(--accent)" />
          <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>Cómo se calcula</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Ingresos esperados</strong>
            <span style={{ color: "var(--green)" }}>Cobranzas existentes:</span> facturas pendientes del archivo de Defontana, asignadas a la semana de su vencimiento real.
            <br/>
            <span style={{ color: "var(--green)" }}>Nueva facturación:</span> lo que me falta facturar este mes + facturación proyectada del mes siguiente (usando viajes × tasa histórica por cliente), cobrada 30-60 días después.
            <br/>
            <span style={{ color: "var(--green)" }}>DAPs:</span> vencimientos de DAPs Trabajo en cada semana.
          </div>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Egresos</strong>
            Todo lo que tienes en tu calendario financiero (columna Monto). La columna "Falta" no se usa aquí — solo en el semáforo del Cockpit. Para el flujo asumo que los compromisos se pagan como los tienes agendados, con o sin dinero.
          </div>
          <div>
            <strong style={{ color: "var(--tx)", display: "block", marginBottom: 4 }}>Caja rodante</strong>
            Caja inicial S1 = caja bancaria actual. Luego: caja_final = caja_inicial + ingresos − egresos. Se arrastra semana a semana. No asumo rescates de DAP Inversión ni de FFMM — esos son colchones que no proyecto.
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function buildFlujo(C, cobranzas) {
  const today = todayMidnight();
  const N_SEMANAS = 13; // 90 días aprox

  // Armar buckets
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

  // EGRESOS = calendario
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
        if (!f.vencimiento) return;
        // Si ya venció, ponerla en la semana 1 (asumimos se cobra pronto, pero en realidad deberíamos destacar que está vencida)
        let targetDate = f.vencimiento;
        if (targetDate < today) targetDate = today; // ya vencida → se espera esta semana
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

  // INGRESOS: (2) Nueva facturación — cobrada con lag
  // Lo que me falta facturar este mes → cobro a ~45 días (semana 6-7)
  // Lo que voy a facturar el mes que viene → cobro a ~75 días (semana 11-12)
  let totalCobranzasNuevas = 0;
  if (C.faltaFacturarMesActual > 0) {
    // Distribuir en semanas 6 a 9 (aprox 1.5 meses desde hoy)
    const monto = C.faltaFacturarMesActual;
    const targetSemanas = [5, 6, 7, 8]; // índices 0-based (semanas 6,7,8,9)
    const parte = monto / targetSemanas.length;
    targetSemanas.forEach(idx => {
      if (semanas[idx]) {
        semanas[idx].ingresos += parte;
        semanas[idx].detallesIng.push({
          concepto: "Nueva facturación mes actual (lag cobranza)",
          monto: parte,
          tipo: "nueva",
        });
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
        semanas[idx].detallesIng.push({
          concepto: "Facturación proyectada mes siguiente (viajes × tasa)",
          monto: parte,
          tipo: "proy",
        });
      }
    });
    totalCobranzasNuevas += monto;
  }

  // INGRESOS: (3) DAPs que vencen
  let totalDAPsVence = 0;
  C.daps.filter(d => d.vencimiento && d.vencimiento >= today && d.tipo === "trabajo").forEach(d => {
    const venc = d.vencimiento;
    for (const s of semanas) {
      if (venc >= s.inicio && venc <= s.fin) {
        const monto = d.montoFinal || d.monto;
        s.ingresos += monto;
        s.detallesIng.push({
          fecha: venc,
          concepto: `DAP ${d.banco} vence`,
          monto,
          tipo: "dap",
        });
        totalDAPsVence += monto;
        break;
      }
    }
  });

  // Construir caja rodante
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

  // Chart data
  const chartData = semanas.map(s => ({
    label: s.label,
    ingresos: s.ingresos / 1e6,
    egresos: -s.egresos / 1e6, // negativo para verse debajo
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
    { label: "DAPs trabajo vencen", monto: flujo.totalDAPsVence, desc: "DAPs Trabajo disponibles en ventana", icon: PiggyBank, color: "var(--violet)" },
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
  // Clasificar compromisos del calendario por categoría
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
