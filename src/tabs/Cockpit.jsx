import { useState } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Building2, PiggyBank,
  Wallet, Landmark, Calendar, Clock, ArrowDownRight, ArrowUpRight,
  Sparkles, Receipt, Truck, CreditCard, Zap, CircleDot,
} from "lucide-react";
import { KpiCard, SectionCard, DataTable, StatusBadge, EmptyState } from "../components/common.jsx";
import { FileUploader } from "../components/FileUploader.jsx";
import {
  fmtM, fmtFull, fmtPct, fmtNum, fmtDateMed, fmtDateLong, getSaludo,
  MESES_FULL, MESES_SHORT, pctChange,
} from "../utils/format.js";

export function Cockpit({ C, cobranzas, cobranzasRaw, uploadCobranzas, clearCobranzas, setTab }) {
  if (!C) return null;
  const saludo = getSaludo();
  const hoy = new Date();
  const fechaLarga = fechaLargaFmt(hoy);

  // Semáforos ejecutivos
  const semaforo = computeSemaforo(C);

  // Las 3 métricas clave de Miguel
  const totalFalta = C.semanas.reduce((s, w) => s + w.falta, 0);
  const tenemosParaResponder = C.liquidez90; // caja + DAP trabajo 90d + FFMM
  const porRecibir90 = (cobranzas ? C.cobranzaEsperada90 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── HERO: saludo + semáforo ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "var(--violet-bg)", border: "1px solid var(--violet)33", marginBottom: 10 }}>
            <Sparkles size={11} color="var(--violet)"/>
            <span style={{ fontSize: 10, color: "var(--violet)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Cockpit</span>
          </div>
          <h1 className="serif" style={{ fontSize: 32, fontWeight: 700, color: "var(--tx)", marginBottom: 4, letterSpacing: -1.2 }}>
            {saludo}, Miguel
          </h1>
          <p style={{ fontSize: 13, color: "var(--tx-muted)", textTransform: "capitalize" }}>{fechaLarga}</p>
        </div>
        <Semaforo s={semaforo} />
      </div>

      {/* ── Uploader compacto o principal según estado ── */}
      {cobranzasRaw ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <FileUploader compact current={cobranzasRaw} onUpload={uploadCobranzas} />
        </div>
      ) : (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--accent-border)", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="var(--accent)"/>
            <span className="serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--tx)" }}>
              Para ver las cobranzas, sube el informe de Defontana
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--tx-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Las pestañas "Por cobrar" y parte del "Flujo 90d" requieren este archivo. El resto del app funciona sin él.
          </div>
          <FileUploader onUpload={uploadCobranzas} onClear={clearCobranzas} current={cobranzasRaw} />
        </div>
      )}

      {/* ── LAS 3 PREGUNTAS CLAVE DE MIGUEL ── */}
      <div style={{
        background: "var(--bg-surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: 24,
      }}>
        <div style={{ fontSize: 11, color: "var(--tx-muted)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18 }}>
          Las 3 preguntas
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <QuestionCard
            num="1"
            question="¿Cuánto falta por completar?"
            answer={totalFalta > 0 ? fmtM(totalFalta) : "Todo cubierto"}
            sub={totalFalta > 0 ? `En las próximas 4 semanas (según tu calendario)` : "Semanas vigentes al día"}
            color={totalFalta === 0 ? "var(--green)" : totalFalta > 100000000 ? "var(--red)" : "var(--amber)"}
            colorBg={totalFalta === 0 ? "var(--green-bg)" : totalFalta > 100000000 ? "var(--red-bg)" : "var(--amber-bg)"}
            icon={AlertTriangle}
            onClick={() => setTab("flujo")}
          />
          <QuestionCard
            num="2"
            question="¿Cuánto tenemos para responder?"
            answer={fmtM(tenemosParaResponder)}
            sub={`Caja ${fmtM(C.totalCaja)} + DAP Trabajo 90d ${fmtM(C.dapTrab90)} + FFMM ${fmtM(C.totalFondos)}`}
            color="var(--teal)"
            colorBg="var(--teal-bg)"
            icon={Wallet}
            detail={[
              { label: "Caja bancaria", value: fmtM(C.totalCaja) },
              { label: "DAP Trabajo (vence 90d)", value: fmtM(C.dapTrab90) },
              { label: "Fondos mutuos", value: fmtM(C.totalFondos) },
              { label: "Colchón DAP Inv. 30d", value: fmtM(C.dapInv30), muted: true },
            ]}
          />
          <QuestionCard
            num="3"
            question="¿Cuánto deberíamos recibir?"
            answer={cobranzas ? fmtM(porRecibir90) : "—"}
            sub={cobranzas
              ? `Próximos 90 días: ${fmtM(C.cobranzaEsperada30)} en 30d, ${fmtM(C.cobranzaEsperada60)} en 60d`
              : "Requiere el archivo de cobranzas"
            }
            color="var(--accent)"
            colorBg="var(--accent-bg)"
            icon={ArrowDownRight}
            onClick={() => cobranzas && setTab("cobranzas")}
          />
        </div>
      </div>

      {/* ── KPIs de contexto ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard icon={Building2} label="Caja total" value={fmtM(C.totalCaja)} sub={Object.keys(C.saldosBancos).length + " bancos"} color="var(--teal)" colorBg="var(--teal-bg)" />
        <KpiCard icon={PiggyBank} label="DAP vigentes" value={fmtM(C.totalDAPTrabajo + C.totalDAPInversion + C.totalDAPCredito)} sub={`Trab. ${fmtM(C.totalDAPTrabajo)} · Inv. ${fmtM(C.totalDAPInversion)}`} color="var(--violet)" colorBg="var(--violet-bg)" />
        {cobranzas && (
          <KpiCard
            icon={Receipt}
            label="Por cobrar total"
            value={fmtM(cobranzas.totalPendiente)}
            sub={`${cobranzas.clientesArray.length} clientes · DSO ${cobranzas.dsoGlobal ? Math.round(cobranzas.dsoGlobal) + " días" : "—"}`}
            color="var(--accent)"
            colorBg="var(--accent-bg)"
            highlight
          />
        )}
        <KpiCard
          icon={TrendingUp}
          label={`Por facturar ${MESES_SHORT[C.curMonth + 1] || "próx"}`}
          value={fmtM(C.proyFacturacionMesSiguiente)}
          sub={`Basado en viajes ${MESES_SHORT[C.curMonth]} · ${fmtNum(C.desgloseMesSiguiente.length)} clientes`}
          color="var(--accent)"
          colorBg="var(--accent-bg)"
        />
        <KpiCard
          icon={CreditCard}
          label="Crédito Itaú"
          value={fmtM(C.creditoSaldoActual)}
          sub={C.creditoProxima ? `Próx. ${fmtM(C.creditoProxima.valorCuota)} cuota #${C.creditoProxima.cuota}` : "Sin cuotas futuras"}
          color="var(--red)"
          colorBg="var(--red-bg)"
        />
      </div>

      {/* ── 4 semanas vigentes ── */}
      <SectionCard
        title="Cobertura semana a semana"
        subtitle="Basado en tu calendario financiero · Semáforo según columna Falta"
        icon={Calendar}
        color="var(--accent)"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Semana", "Período", "Compromisos", "Guardado", "Falta", "DAP Trab vence", "Estado"].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 12px",
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
              {C.semanas.map((s, i) => {
                const estadoInfo = {
                  cubierto: { level: "green", label: "✓ Cubierto" },
                  ajustar: { level: "amber", label: "⚠ Por ajustar" },
                  descubierto: { level: "red", label: "✗ Descubierto" },
                  vacia: { level: "neutral", label: "—" },
                }[s.estado];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--tx)", fontWeight: 600 }}>
                      S{s.semana}
                      {i === 0 && <StatusBadge level="blue" size="sm" children="ACTUAL" />}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--tx-muted)", fontSize: 11.5 }}>{s.label}</td>
                    <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: "var(--tx)", fontWeight: 600 }}>
                      {s.compromisosCount > 0 ? fmtM(s.compromisos) : "—"}
                      {s.compromisosCount > 0 && <span style={{ color: "var(--tx-faint)", fontSize: 10, marginLeft: 4 }}>({s.compromisosCount})</span>}
                    </td>
                    <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: s.guardado > 0 ? "var(--green)" : "var(--tx-faint)" }}>
                      {s.guardado > 0 ? fmtM(s.guardado) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: s.falta > 0 ? "var(--red)" : "var(--tx-faint)", fontWeight: s.falta > 0 ? 700 : 400 }}>
                      {s.falta > 0 ? fmtM(s.falta) : "—"}
                    </td>
                    <td className="tabular" style={{ padding: "10px 12px", textAlign: "right", color: s.dapVence > 0 ? "var(--green)" : "var(--tx-faint)" }}>
                      {s.dapCount > 0 ? `${fmtM(s.dapVence)} (${s.dapCount})` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <StatusBadge level={estadoInfo.level}>{estadoInfo.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Ratios de salud ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <SectionCard title="Cobertura de liquidez" icon={Landmark} color="var(--teal)">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RatioRow label="Liquidez 30 días" value={C.coberturaRatio30} monto={C.liquidez30} compromisos={C.totalCompromisos30} />
            <RatioRow label="Liquidez 60 días" value={C.coberturaRatio60} monto={C.liquidez60} compromisos={C.totalCompromisos60} />
          </div>
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg-surface-2)", borderRadius: 8, fontSize: 11, color: "var(--tx-muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--tx)" }}>Fórmula:</strong> (caja + DAP trabajo que vence ventana + FFMM) ÷ compromisos del calendario. Excluye DAP crédito y DAP inversión (colchón aparte).
          </div>
        </SectionCard>

        <SectionCard title="Flujo neto esperado" icon={Zap} color="var(--accent)">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FlujoRow label="30 días" ingresos={C.cobranzaEsperada30} egresos={C.totalCompromisos30} />
            <FlujoRow label="60 días" ingresos={C.cobranzaEsperada60} egresos={C.totalCompromisos60} />
            <FlujoRow label="90 días" ingresos={C.cobranzaEsperada90} egresos={C.totalCompromisos90} />
          </div>
          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg-surface-2)", borderRadius: 8, fontSize: 11, color: "var(--tx-muted)", lineHeight: 1.5 }}>
            {cobranzas
              ? <>Ingresos = cobranzas estimadas por vencimiento + nueva facturación proyectada cobrada con lag. Egresos = calendario.</>
              : <>Solo muestra egresos. Sube el archivo de cobranzas para ver ingresos.</>
            }
          </div>
        </SectionCard>
      </div>

      {/* ── Próximos 7 días: qué pasa ── */}
      <SectionCard title="Próximos 7 días" icon={Clock} color="var(--amber)">
        <AgendaProxima C={C} cobranzas={cobranzas} />
      </SectionCard>
    </div>
  );
}

// ── COMPONENTES INTERNOS ──

function QuestionCard({ num, question, answer, sub, color, colorBg, icon: Icon, detail, onClick }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => {
        if (detail) setExpanded(!expanded);
        else if (onClick) onClick();
      }}
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${color}33`,
        borderRadius: 14,
        padding: "20px 22px",
        cursor: (detail || onClick) ? "pointer" : "default",
        transition: "border 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: colorBg, borderRadius: 6, padding: 5, display: "flex" }}>
            <Icon size={14} color={color} strokeWidth={2.2} />
          </div>
          <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-muted)" }}>Pregunta {num}</span>
        </div>
        {detail && <span style={{ fontSize: 10, color: "var(--tx-muted)" }}>{expanded ? "▲" : "▼"}</span>}
      </div>
      <div className="serif" style={{ fontSize: 14, color: "var(--tx-muted)", fontStyle: "italic", marginBottom: 10, lineHeight: 1.3 }}>
        {question}
      </div>
      <div className="serif tabular" style={{ fontSize: 32, fontWeight: 700, color, letterSpacing: -1.2, lineHeight: 1.1, marginBottom: 8 }}>
        {answer}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--tx-muted)", lineHeight: 1.5 }}>{sub}</div>
      {detail && expanded && (
        <div className="fade-in" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 5 }}>
          {detail.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: d.muted ? "var(--tx-faint)" : "var(--tx-muted)" }}>
              <span>{d.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: d.muted ? "var(--tx-faint)" : "var(--tx)" }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatioRow({ label, value, monto, compromisos }) {
  const color = value === null ? "var(--tx-muted)"
    : value >= 1.2 ? "var(--green)"
    : value >= 1 ? "var(--amber)"
    : "var(--red)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "var(--tx-muted)" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
          {value !== null ? value.toFixed(2) + "x" : "—"}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--tx-faint)", fontVariantNumeric: "tabular-nums" }}>
        {fmtM(monto)} disponible / {fmtM(compromisos)} comprometido
      </div>
      <div style={{ height: 4, background: "var(--bg-surface-3)", borderRadius: 2, marginTop: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: value ? `${Math.min(value * 100, 150)}%` : "0%", background: color, borderRadius: 2, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function FlujoRow({ label, ingresos, egresos }) {
  const neto = ingresos - egresos;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: "0 0 60px", fontSize: 11, color: "var(--tx-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
          <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 3, fontVariantNumeric: "tabular-nums" }}>
            <ArrowDownRight size={11}/> {fmtM(ingresos)}
          </span>
          <span style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 3, fontVariantNumeric: "tabular-nums" }}>
            <ArrowUpRight size={11}/> {fmtM(egresos)}
          </span>
        </div>
      </div>
      <div style={{
        flex: "0 0 auto",
        fontSize: 13,
        fontWeight: 700,
        color: neto >= 0 ? "var(--green)" : "var(--red)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {neto >= 0 ? "+" : ""}{fmtM(neto)}
      </div>
    </div>
  );
}

function AgendaProxima({ C, cobranzas }) {
  const now = new Date(); const n7 = new Date(); n7.setDate(n7.getDate() + 7);
  const items = [];

  // Compromisos del calendario
  C.calendario.filter(r => r.fecha >= now && r.fecha <= n7).forEach(r => {
    items.push({
      fecha: r.fecha,
      tipo: "pago",
      descripcion: r.concepto,
      monto: -r.monto,
      extra: r.falta > 0 ? `Falta ${fmtM(r.falta)}` : r.guardado > 0 ? "Guardado" : null,
      icon: ArrowUpRight,
      color: "var(--red)",
    });
  });

  // DAPs que vencen
  C.daps.filter(d => d.vencimiento >= now && d.vencimiento <= n7).forEach(d => {
    items.push({
      fecha: d.vencimiento,
      tipo: "dap",
      descripcion: `DAP ${d.banco} (${d.tipo})`,
      monto: d.montoFinal || d.monto,
      extra: d.tasa ? `Tasa ${d.tasa}` : null,
      icon: PiggyBank,
      color: "var(--green)",
    });
  });

  // Cobranzas (grandes facturas que vencen)
  if (cobranzas) {
    Object.values(cobranzas.porCliente).forEach(c => {
      c.facturasPendientes.filter(f => f.vencimiento && f.vencimiento >= now && f.vencimiento <= n7 && f.monto > 5000000).forEach(f => {
        items.push({
          fecha: f.vencimiento,
          tipo: "cobro",
          descripcion: `Cobro ${c.nombre.slice(0, 28)} · folio ${f.folio}`,
          monto: f.monto,
          extra: null,
          icon: ArrowDownRight,
          color: "var(--accent)",
        });
      });
    });
  }

  items.sort((a, b) => a.fecha - b.fecha);

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--tx-muted)", padding: 16, textAlign: "center" }}>No hay eventos relevantes en los próximos 7 días</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px",
          background: "var(--bg-surface-2)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: `${item.color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <item.icon size={14} color={item.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--tx)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.descripcion}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 2 }}>
              {fmtDateMed(item.fecha)} · {item.tipo === "pago" ? "Salida" : item.tipo === "cobro" ? "Entrada esperada" : "DAP vence"}
              {item.extra && <> · {item.extra}</>}
            </div>
          </div>
          <div className="tabular" style={{
            fontSize: 14,
            fontWeight: 700,
            color: item.monto >= 0 ? "var(--green)" : "var(--red)",
            whiteSpace: "nowrap",
          }}>
            {item.monto >= 0 ? "+" : ""}{fmtM(item.monto)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Semáforo ejecutivo ──
function computeSemaforo(C) {
  const signals = [];
  // Cobertura 30d
  if (C.coberturaRatio30 !== null) {
    const r = C.coberturaRatio30;
    signals.push({
      level: r >= 1.2 ? "green" : r >= 1 ? "amber" : "red",
      text: `Liquidez 30d ${r.toFixed(2)}x`,
    });
  }
  // Falta 30d vs compromisos
  if (C.totalCompromisos30 > 0) {
    const pct = (C.totalFalta30 / C.totalCompromisos30) * 100;
    signals.push({
      level: pct === 0 ? "green" : pct < 20 ? "amber" : "red",
      text: pct === 0 ? "Semanas cubiertas" : `Falta ${fmtM(C.totalFalta30)} en 30d`,
    });
  }
  // Flujo neto 30d
  if (C.flujoNetoEsperado30 !== null) {
    signals.push({
      level: C.flujoNetoEsperado30 >= 0 ? "green" : "red",
      text: `Flujo neto 30d ${C.flujoNetoEsperado30 >= 0 ? "+" : ""}${fmtM(C.flujoNetoEsperado30)}`,
    });
  }
  const levels = signals.map(s => s.level);
  let global = "green";
  if (levels.includes("red")) global = "red";
  else if (levels.includes("amber")) global = "amber";
  return { global, signals };
}

function Semaforo({ s }) {
  if (!s.signals.length) return null;
  const map = {
    green: { c: "var(--green)", bg: "var(--green-bg)", label: "Todo en orden" },
    amber: { c: "var(--amber)", bg: "var(--amber-bg)", label: "Requiere atención" },
    red: { c: "var(--red)", bg: "var(--red-bg)", label: "Acción urgente" },
  };
  const g = map[s.global];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: g.bg, border: `1px solid ${g.c}33`, minWidth: 0 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: g.c, flexShrink: 0, boxShadow: `0 0 12px ${g.c}` }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: g.c, letterSpacing: 0.2 }}>{g.label}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          {s.signals.map((sig, i) => {
            const sc = map[sig.level];
            return (
              <span key={i} style={{ fontSize: 10, color: "var(--tx-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <CircleDot size={8} color={sc.c} />{sig.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fechaLargaFmt(d) {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${MESES_FULL[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}
