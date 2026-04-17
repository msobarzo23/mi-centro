import { useState, useMemo } from "react";
import {
  Truck, ArrowRight, Receipt, DollarSign, TrendingUp, TrendingDown,
  Search, AlertCircle, Info, Target, ChevronDown, ChevronUp,
} from "lucide-react";
import { SectionCard, KpiCard, StatusBadge, EmptyState } from "../components/common.jsx";
import { fmtM, fmtFull, fmtNum, fmtPct, fmtPctNoSign, normName, MESES_SHORT, MESES_FULL } from "../utils/format.js";

export function CicloViajes({ C, cobranzas, sheets }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("siguiente"); // siguiente | actual | pendiente
  const [onlyWithPending, setOnlyWithPending] = useState(false);

  const datos = useMemo(() => buildCicloPorCliente(C, cobranzas, sheets), [C, cobranzas, sheets]);

  if (!C) return null;

  const filtered = useMemo(() => {
    let arr = datos.clientes;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      arr = arr.filter(c => c.nombre.toLowerCase().includes(q));
    }
    if (onlyWithPending) {
      arr = arr.filter(c => c.saldoPendiente > 0);
    }
    switch (sortBy) {
      case "siguiente":
        arr = [...arr].sort((a, b) => b.proyMesSiguiente - a.proyMesSiguiente);
        break;
      case "actual":
        arr = [...arr].sort((a, b) => b.facturadoMesActual - a.facturadoMesActual);
        break;
      case "pendiente":
        arr = [...arr].sort((a, b) => b.saldoPendiente - a.saldoPendiente);
        break;
      case "viajes":
        arr = [...arr].sort((a, b) => b.viajesMesActual - a.viajesMesActual);
        break;
    }
    return arr;
  }, [datos, query, sortBy, onlyWithPending]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, color: "var(--tx)", letterSpacing: -1, marginBottom: 4 }}>
          Ciclo viajes → facturación → cobranza
        </h1>
        <p style={{ fontSize: 13, color: "var(--tx-muted)" }}>
          Por cliente: viajes de este mes · facturación proyectada próx. mes · cobranza subsiguiente
        </p>
      </div>

      {/* Explicación del modelo */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--violet-bg)",
        borderRadius: 14,
        padding: "16px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Info size={14} color="var(--violet)" />
          <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>Cómo funciona el modelo</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.5 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--violet)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
              Mes N — Viajes
            </div>
            Viajes ya ejecutados de {MESES_FULL[C.curMonth]}. Son la base física del ciclo.
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
              Mes N+1 — Facturación
            </div>
            Se proyecta con tasa histórica $/viaje por cliente (mismo mes año anterior, con lag 1). Cliente con ≥3 meses de histórico → confianza alta.
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>
              Mes N+2 — Cobranza
            </div>
            Se cobra ~30d después (60d para Maxam). El vencimiento real del archivo de Defontana manda.
          </div>
        </div>
      </div>

      {/* KPIs resumen */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard
          icon={Truck}
          label={`Viajes ${MESES_SHORT[C.curMonth]}`}
          value={fmtNum(datos.totalViajesMesActual)}
          sub={`En ${datos.clientesConViajesActual} clientes · base para proyectar`}
          color="var(--teal)"
          colorBg="var(--teal-bg)"
        />
        <KpiCard
          icon={Receipt}
          label={`Facturado ${MESES_SHORT[C.curMonth]}`}
          value={fmtM(C.totalFacturadoMesActual)}
          sub={C.faltaFacturarMesActual > 0 ? `Falta por facturar: ${fmtM(C.faltaFacturarMesActual)}` : "Al día"}
          color="var(--accent)"
          colorBg="var(--accent-bg)"
        />
        <KpiCard
          icon={TrendingUp}
          label={`Proyección ${MESES_SHORT[C.curMonth + 1] || "próx"}`}
          value={fmtM(C.proyFacturacionMesSiguiente)}
          sub={`Tasa global: ${fmtM(C.tasaGlobal)} por viaje`}
          color="var(--green)"
          colorBg="var(--green-bg)"
          highlight
        />
        <KpiCard
          icon={DollarSign}
          label={`A cobrar ${MESES_SHORT[C.curMonth + 2] || "subsig."}`}
          value={cobranzas ? fmtM(C.cobranzaEsperada90 - C.cobranzaEsperada60) : "—"}
          sub={cobranzas ? "Mes subsiguiente (lag 60-90d)" : "Requiere archivo cobranzas"}
          color="var(--violet)"
          colorBg="var(--violet-bg)"
        />
      </div>

      {/* Filtros + tabla */}
      <SectionCard
        title={`Detalle por cliente — ${filtered.length}`}
        subtitle="Cada fila conecta los 3 momentos del ciclo: viajes → facturación → cobranza"
        icon={Target}
        color="var(--accent)"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={12} color="var(--tx-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Buscar cliente"
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
                  width: 160,
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
              <option value="siguiente">Por proyección mes siguiente</option>
              <option value="actual">Por facturado mes actual</option>
              <option value="viajes">Por viajes del mes</option>
              <option value="pendiente">Por saldo pendiente</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--tx-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={onlyWithPending}
                onChange={e => setOnlyWithPending(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              Solo con saldo
            </label>
          </div>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle("left")}>Cliente</th>
                <th style={thStyle("right")}>Viajes {MESES_SHORT[C.curMonth]}</th>
                <th style={thStyle("right")}>Tasa $/viaje</th>
                <th style={thStyle("right")}>Facturado {MESES_SHORT[C.curMonth]}</th>
                <th style={thStyle("right")}>Proy. {MESES_SHORT[C.curMonth + 1] || "próx"}</th>
                <th style={thStyle("right")}>Saldo pendiente</th>
                <th style={thStyle("right")}>DSO</th>
                <th style={thStyle("center")}>Confianza</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 10px", color: "var(--tx)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.nombre}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.viajesMesActual > 0 ? "var(--teal)" : "var(--tx-faint)", fontWeight: 600 }}>
                    {c.viajesMesActual > 0 ? c.viajesMesActual : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: "var(--tx-muted)", fontSize: 11 }}>
                    {c.tasa > 0 ? fmtM(c.tasa) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.facturadoMesActual > 0 ? "var(--accent)" : "var(--tx-faint)", fontWeight: 600 }}>
                    {c.facturadoMesActual > 0 ? fmtM(c.facturadoMesActual) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.proyMesSiguiente > 0 ? "var(--green)" : "var(--tx-faint)", fontWeight: 700 }}>
                    {c.proyMesSiguiente > 0 ? fmtM(c.proyMesSiguiente) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: c.saldoPendiente > 0 ? "var(--tx)" : "var(--tx-faint)", fontWeight: c.saldoPendiente > 0 ? 600 : 400 }}>
                    {c.saldoPendiente > 0 ? fmtM(c.saldoPendiente) : "—"}
                  </td>
                  <td className="tabular" style={{ padding: "10px 10px", textAlign: "right", color: !c.dsoReal ? "var(--tx-faint)" : c.dsoReal <= 35 ? "var(--green)" : c.dsoReal <= 50 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>
                    {c.dsoReal ? Math.round(c.dsoReal) + "d" : "—"}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "center" }}>
                    {c.conf === "alta" && <StatusBadge level="green" size="sm">Alta</StatusBadge>}
                    {c.conf === "baja" && <StatusBadge level="amber" size="sm">Baja</StatusBadge>}
                    {c.conf === "global" && <StatusBadge level="blue" size="sm">Global</StatusBadge>}
                    {c.conf === "ninguna" && <StatusBadge level="neutral" size="sm">—</StatusBadge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Alertas del ciclo */}
      {datos.alertas.length > 0 && (
        <SectionCard
          title={`Señales de atención — ${datos.alertas.length}`}
          subtitle="Clientes cuyo ciclo muestra algo anormal"
          icon={AlertCircle}
          color="var(--amber)"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {datos.alertas.slice(0, 10).map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px",
                background: a.nivel === "red" ? "var(--red-bg)" : "var(--amber-bg)",
                border: `1px solid ${a.nivel === "red" ? "var(--red-border)" : "var(--amber-border)"}`,
                borderRadius: 10,
              }}>
                <div style={{ flexShrink: 0 }}>
                  <AlertCircle size={16} color={a.nivel === "red" ? "var(--red)" : "var(--amber)"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "var(--tx)", fontWeight: 600, marginBottom: 3 }}>
                    {a.cliente}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.4 }}>
                    {a.mensaje}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function thStyle(align) {
  return {
    padding: "10px 10px",
    textAlign: align,
    color: "var(--tx-muted)",
    fontWeight: 600,
    fontSize: 10.5,
    borderBottom: "1px solid var(--border)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    whiteSpace: "nowrap",
  };
}

function buildCicloPorCliente(C, cobranzas, sheets) {
  if (!C || !sheets) return { clientes: [], totalViajesMesActual: 0, clientesConViajesActual: 0, alertas: [] };

  const viajes = sheets.viajes || [];
  const ventas = sheets.ventas || [];

  // Viajes del mes actual por cliente
  const viajesMesActual = {};
  viajes.filter(r => r.fecha.getMonth() === C.curMonth && r.fecha.getFullYear() === C.curYear).forEach(r => {
    const k = normName(r.cliente);
    if (!k) return;
    if (!viajesMesActual[k]) viajesMesActual[k] = { count: 0, nombre: r.cliente };
    viajesMesActual[k].count++;
  });

  // Facturado del mes actual por cliente
  const facturadoMesActual = {};
  ventas.filter(r => r.fecha.getMonth() === C.curMonth && r.fecha.getFullYear() === C.curYear).forEach(r => {
    const k = normName(r.cliente);
    if (!k) return;
    if (!facturadoMesActual[k]) facturadoMesActual[k] = { monto: 0, nombre: r.cliente };
    facturadoMesActual[k].monto += r.neto;
  });

  // Unir todas las claves
  const allKeys = new Set([
    ...Object.keys(viajesMesActual),
    ...Object.keys(facturadoMesActual),
    ...Object.keys(C.tasaPorCliente || {}),
    ...Object.keys(cobranzas?.porCliente || {}),
  ]);

  const clientes = [];
  let totalViajesMesActual = 0;
  const alertas = [];

  allKeys.forEach(k => {
    const vjMes = viajesMesActual[k]?.count || 0;
    const faMes = facturadoMesActual[k]?.monto || 0;
    const tasa = C.tasaPorCliente?.[k]?.tasa || 0;
    const conf = C.tasaPorCliente?.[k]?.conf || (vjMes > 0 && !tasa ? "global" : "ninguna");
    const tasaUsada = tasa || (vjMes > 0 ? C.tasaGlobal : 0);
    const proyMesSiguiente = vjMes * tasaUsada;

    const cobCliente = cobranzas?.porCliente?.[k];
    const saldoPendiente = cobCliente?.saldoPendiente || 0;
    const dsoReal = cobCliente?.dsoReal || null;

    // Nombre de mejor fuente
    const nombre = cobCliente?.nombre || viajesMesActual[k]?.nombre || facturadoMesActual[k]?.nombre || k;

    // Excluir clientes sin ninguna actividad ni saldo
    if (vjMes === 0 && faMes === 0 && saldoPendiente === 0 && proyMesSiguiente === 0) return;

    clientes.push({
      nombre,
      viajesMesActual: vjMes,
      facturadoMesActual: faMes,
      tasa: tasaUsada,
      proyMesSiguiente,
      saldoPendiente,
      dsoReal,
      conf,
    });

    totalViajesMesActual += vjMes;

    // Alertas
    // 1. Hizo viajes pero no ha facturado este mes (normal si es inicio de mes, pero vale la pena destacar)
    // 2. DSO creciendo vs normal
    // 3. Facturación atípica vs histórico
    if (vjMes >= 5 && faMes === 0) {
      alertas.push({
        cliente: nombre,
        nivel: "amber",
        mensaje: `${vjMes} viajes este mes pero $0 facturado. ¿Factura pendiente de emitir? Facturación proyectada: ${fmtM(proyMesSiguiente)}`,
      });
    }
    if (dsoReal && dsoReal > 70 && saldoPendiente > 50000000) {
      alertas.push({
        cliente: nombre,
        nivel: "red",
        mensaje: `DSO de ${Math.round(dsoReal)} días con saldo pendiente de ${fmtM(saldoPendiente)}. Cliente con pago lento y exposición alta.`,
      });
    }
    if (saldoPendiente > 200000000 && vjMes === 0) {
      alertas.push({
        cliente: nombre,
        nivel: "amber",
        mensaje: `Saldo alto (${fmtM(saldoPendiente)}) sin viajes este mes. Cliente puede estar reduciendo actividad o cerrando cuenta.`,
      });
    }
  });

  return {
    clientes,
    totalViajesMesActual,
    clientesConViajesActual: Object.keys(viajesMesActual).length,
    alertas: alertas.sort((a, b) => (a.nivel === "red" ? -1 : 1) - (b.nivel === "red" ? -1 : 1)),
  };
}
