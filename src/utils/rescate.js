// ══════════════════════════════════════════════════════════════════════
// MOTOR DE SUGERENCIAS DE RESCATE
// Cuando el flujo proyectado cae negativo en alguna semana, sugerimos
// qué parte del "colchón" (FFMM + DAP Inversión + DAP Crédito) conviene
// rescatar primero.
//
// Orden de preferencia (más barato → más caro):
//   1. FFMM           — liquidez inmediata, costo cero
//   2. DAP Inversión  — perdemos algo de tasa si rompemos antes
//   3. DAP Crédito    — último recurso (está amarrado a compra terrenos)
// ══════════════════════════════════════════════════════════════════════

import { fmtM } from "./helpers_v2.js";

// Dado un flujo semanal (array de semanas con {inicio, fin, cajaFinal}) y
// el colchón disponible (FFMM + DAP Inv + DAP Cred), genera sugerencias
// de rescate por cada semana con cajaFinal < 0.
//
// fondos: array de FFMM (cada uno {fondo, admin, actual})
// dapsInv: array de DAPs inversión (cada uno {banco, monto, montoFinal, vencimiento})
// dapsCred: array de DAPs crédito (igual estructura)
// Los DAPs se ordenan por vencimiento ascendente: los más próximos a vencer
// son los menos costosos de romper (más cerca del final de su tasa devengada).
export function buildSugerenciasRescate(semanas, { fondos = [], dapsInv = [], dapsCred = [] }) {
  const fuentes = construirFuentesColchon({ fondos, dapsInv, dapsCred });

  const sugerencias = {};
  let saldoRestantePorFuente = fuentes.map(f => ({ ...f, saldoRestante: f.monto }));

  semanas.forEach((s, idx) => {
    if (s.cajaFinal >= 0) return;
    const necesitado = Math.abs(s.cajaFinal);
    const plan = [];
    let cubierto = 0;

    for (const fuente of saldoRestantePorFuente) {
      if (cubierto >= necesitado) break;
      if (fuente.saldoRestante <= 0) continue;

      // Si la fuente es un DAP con vencimiento posterior a la semana s,
      // asumimos que se puede romper (con penalidad) y sumar antes.
      // Si es FFMM, siempre disponible.
      // Preferimos fuentes que ya venzan antes de la semana s (las que
      // naturalmente están liberándose) sobre las que requieren romper.
      const disponibleSinRomper = !fuente.vencimiento || fuente.vencimiento <= s.fin;

      const aTomar = Math.min(fuente.saldoRestante, necesitado - cubierto);
      plan.push({
        tipo: fuente.tipo,
        label: fuente.label,
        monto: aTomar,
        rompe: !disponibleSinRomper,
        vencimiento: fuente.vencimiento,
      });
      fuente.saldoRestante -= aTomar;
      cubierto += aTomar;
    }

    sugerencias[idx] = {
      necesitado,
      cubierto,
      faltante: Math.max(0, necesitado - cubierto),
      plan,
    };
  });

  return sugerencias;
}

function construirFuentesColchon({ fondos, dapsInv, dapsCred }) {
  const fuentes = [];

  // 1. FFMM — todas como una sola fuente (son líquidas inmediatas)
  const totalFFMM = fondos.reduce((s, f) => s + (f.actual || 0), 0);
  if (totalFFMM > 0) {
    fuentes.push({
      tipo: "ffmm",
      label: fondos.length === 1 ? fondos[0].fondo : `FFMM (${fondos.length} fondos)`,
      monto: totalFFMM,
      vencimiento: null,
      prioridad: 1,
    });
  }

  // 2. DAPs Inversión ordenados por vencimiento ascendente (los próximos primero)
  [...dapsInv]
    .filter(d => (d.montoFinal || d.monto) > 0)
    .sort((a, b) => (a.vencimiento || Infinity) - (b.vencimiento || Infinity))
    .forEach(d => {
      fuentes.push({
        tipo: "dap_inv",
        label: `DAP Inv. ${d.banco}`,
        monto: d.montoFinal || d.monto,
        vencimiento: d.vencimiento,
        prioridad: 2,
      });
    });

  // 3. DAPs Crédito (último recurso)
  [...dapsCred]
    .filter(d => (d.montoFinal || d.monto) > 0)
    .sort((a, b) => (a.vencimiento || Infinity) - (b.vencimiento || Infinity))
    .forEach(d => {
      fuentes.push({
        tipo: "dap_cred",
        label: `DAP Créd. ${d.banco}`,
        monto: d.montoFinal || d.monto,
        vencimiento: d.vencimiento,
        prioridad: 3,
      });
    });

  return fuentes;
}

// Formatea el plan de rescate como texto amigable para badge
export function formatPlan(plan) {
  if (!plan || plan.length === 0) return "Sin fuentes disponibles";
  if (plan.length === 1) {
    const p = plan[0];
    return `Rescatar ${fmtM(p.monto)} de ${p.label}${p.rompe ? " (rompe)" : ""}`;
  }
  return plan.map(p => `${fmtM(p.monto)} ${p.label}`).join(" + ");
}
