import { useMemo } from "react";
import { normName, pctChange, todayMidnight, daysBetween, startOfWeek, endOfWeek } from "../utils/format.js";
import { getDapType } from "../utils/parsers.js";

// ══════════════════════════════════════════════════════════════════════
// MOTOR DE CRUCE DE DATOS
// Responde las 3 preguntas clave de Miguel:
//   1. Cuánto falta por completar en las semanas venideras
//   2. Cuánto tenemos para responder (LIQUIDEZ OPERATIVA ESTRICTA)
//   3. Cuánto deberíamos recibir por viajes + facturas pendientes
//
// Cambio v1.2: "Tenemos para responder" = caja bancaria + DAP Trabajo que
// vence en ventana. Se EXCLUYEN FFMM, DAP Inversión y DAP Crédito porque
// NO son para gastos de caja normales (FFMM es colchón, DAP Inv es colchón
// largo plazo, DAP Cred está reservado para compra terrenos).
// ══════════════════════════════════════════════════════════════════════

export function useCompute(sheets, cobranzas) {
  return useMemo(() => {
    if (!sheets) return null;
    const today = todayMidnight();
    const curMonth = today.getMonth();
    const curYear = today.getFullYear();
    const prevYear = curYear - 1;

    // ─────────────────────────────────────────────
    // 1. LIQUIDEZ "para responder"
    // ─────────────────────────────────────────────
    const totalCaja = Object.values(sheets.saldosBancos || {}).reduce((s, v) => s + v, 0);

    const dapTrabajo = (sheets.daps || []).filter(d => d.tipo === "trabajo");
    const dapInversion = (sheets.daps || []).filter(d => d.tipo === "inversion");
    const dapCredito = (sheets.daps || []).filter(d => d.tipo === "credito");
    const totalDAPTrabajo = dapTrabajo.reduce((s, d) => s + d.monto, 0);
    const totalDAPInversion = dapInversion.reduce((s, d) => s + d.monto, 0);
    const totalDAPCredito = dapCredito.reduce((s, d) => s + d.monto, 0);
    const totalFondos = (sheets.fondos || []).reduce((s, f) => s + f.actual, 0);

    // DAPs que vencen en los próximos 30 / 60 / 90 días, por tipo
    const next30 = new Date(today); next30.setDate(next30.getDate() + 30);
    const next60 = new Date(today); next60.setDate(next60.getDate() + 60);
    const next90 = new Date(today); next90.setDate(next90.getDate() + 90);

    const dapVence = (limitDate, tipo = null) =>
      (sheets.daps || [])
        .filter(d => d.vencimiento && d.vencimiento >= today && d.vencimiento <= limitDate)
        .filter(d => !tipo || d.tipo === tipo)
        .reduce((s, d) => s + (d.montoFinal || d.monto), 0);

    const dapTrab30 = dapVence(next30, "trabajo");
    const dapTrab60 = dapVence(next60, "trabajo");
    const dapTrab90 = dapVence(next90, "trabajo");
    const dapInv30 = dapVence(next30, "inversion");
    const dapInv60 = dapVence(next60, "inversion");
    const dapInv90 = dapVence(next90, "inversion");
    const dapCred30 = dapVence(next30, "credito");

    // ─── LIQUIDEZ OPERATIVA ESTRICTA ─── (v1.2)
    // Solo caja bancaria + DAP Trabajo que vence en ventana.
    // NO incluye FFMM, DAP Inv ni DAP Cred.
    const liquidezOperativa30 = totalCaja + dapTrab30;
    const liquidezOperativa60 = totalCaja + dapTrab60;
    const liquidezOperativa90 = totalCaja + dapTrab90;

    // ─── COLCHÓN DISPONIBLE ─── (v1.2)
    // Emergencia: lo que podríamos rescatar si la operación normal no alcanza.
    // Se muestra aparte (nunca se mezcla con "para responder").
    const colchonFFMM = totalFondos;
    const colchonDAPInv = totalDAPInversion;
    const colchonDAPCred = totalDAPCredito;
    const colchonTotal = colchonFFMM + colchonDAPInv + colchonDAPCred;

    // Desglose del colchón para UI colapsable
    const colchonDesglose = [
      { key: "ffmm", label: "Fondos mutuos", monto: colchonFFMM, costo: "Cero — liquidez inmediata", prioridad: 1 },
      { key: "dap_inv", label: "DAP Inversión", monto: colchonDAPInv, costo: "Pierde tasa si se rompe antes", prioridad: 2 },
      { key: "dap_cred", label: "DAP Crédito", monto: colchonDAPCred, costo: "Reservado para compra terrenos", prioridad: 3 },
    ];

    // Compatibilidad hacia atrás (por si algún componente aún los lee):
    const liquidez30 = liquidezOperativa30;
    const liquidez60 = liquidezOperativa60;
    const liquidez90 = liquidezOperativa90;
    const colchon30 = liquidezOperativa30 + colchonFFMM + dapInv30;

    // ─────────────────────────────────────────────
    // 2. COMPROMISOS — "cuánto falta por completar"
    // ─────────────────────────────────────────────
    const cal = sheets.calendario || [];
    const calFuturos = cal.filter(r => r.fecha && r.fecha >= today);

    const semanas = [];
    const weekStart0 = startOfWeek(today);
    for (let w = 0; w < 4; w++) {
      const inicio = new Date(weekStart0);
      inicio.setDate(inicio.getDate() + w * 7);
      const fin = endOfWeek(inicio);
      const compSem = cal.filter(r => r.fecha >= inicio && r.fecha <= fin);
      const compMonto = compSem.reduce((s, r) => s + r.monto, 0);
      const guardado = compSem.reduce((s, r) => s + r.guardado, 0);
      const falta = compSem.reduce((s, r) => s + r.falta, 0);
      const dapSem = (sheets.daps || []).filter(d => d.tipo === "trabajo" && d.vencimiento >= inicio && d.vencimiento <= fin);
      const dapSemMonto = dapSem.reduce((s, d) => s + (d.montoFinal || d.monto), 0);
      semanas.push({
        semana: w + 1,
        inicio, fin,
        label: `${String(inicio.getDate()).padStart(2,"0")}/${String(inicio.getMonth()+1).padStart(2,"0")} — ${String(fin.getDate()).padStart(2,"0")}/${String(fin.getMonth()+1).padStart(2,"0")}`,
        compromisos: compMonto,
        compromisosCount: compSem.length,
        compromisosList: compSem,
        guardado,
        falta,
        dapVence: dapSemMonto,
        dapCount: dapSem.length,
        estado: compSem.length === 0 ? "vacia"
              : falta === 0 ? "cubierto"
              : falta < compMonto * 0.2 ? "ajustar"
              : "descubierto",
      });
    }

    const totalCompromisos30 = cal.filter(r => r.fecha >= today && r.fecha <= next30).reduce((s, r) => s + r.monto, 0);
    const totalCompromisos60 = cal.filter(r => r.fecha >= today && r.fecha <= next60).reduce((s, r) => s + r.monto, 0);
    const totalCompromisos90 = cal.filter(r => r.fecha >= today && r.fecha <= next90).reduce((s, r) => s + r.monto, 0);
    const totalFalta30 = cal.filter(r => r.fecha >= today && r.fecha <= next30).reduce((s, r) => s + r.falta, 0);

    const proximasLeasing = (sheets.leasing?.proxCuotas || []).slice(0, 3);

    // ─────────────────────────────────────────────
    // 3. POR RECIBIR
    // ─────────────────────────────────────────────
    const viajes = sheets.viajes || [];
    const ventas = sheets.ventas || [];

    const viajesByClienteMesPrev = {};
    const ventasByClienteMesPrev = {};
    viajes.forEach(r => {
      if (r.fecha.getFullYear() !== prevYear) return;
      const k = normName(r.cliente); if (!k) return;
      const m = r.fecha.getMonth();
      if (!viajesByClienteMesPrev[k]) viajesByClienteMesPrev[k] = Array(12).fill(0);
      viajesByClienteMesPrev[k][m]++;
    });
    ventas.forEach(r => {
      if (r.fecha.getFullYear() !== prevYear) return;
      const k = normName(r.cliente); if (!k) return;
      const m = r.fecha.getMonth();
      if (!ventasByClienteMesPrev[k]) ventasByClienteMesPrev[k] = Array(12).fill(0);
      ventasByClienteMesPrev[k][m] += r.neto;
    });

    const tasaPorCliente = {};
    let globalV = 0, globalF = 0;
    Object.keys(viajesByClienteMesPrev).forEach(k => {
      const vj = viajesByClienteMesPrev[k];
      const vt = ventasByClienteMesPrev[k] || Array(12).fill(0);
      let sumV = 0, sumF = 0, meses = 0;
      for (let m = 0; m < 11; m++) {
        if (vj[m] > 0 && vt[m + 1] > 0) { sumV += vj[m]; sumF += vt[m + 1]; meses++; }
      }
      if (meses >= 3 && sumV > 0) tasaPorCliente[k] = { tasa: sumF / sumV, meses, conf: "alta" };
      else if (meses >= 1 && sumV > 0) tasaPorCliente[k] = { tasa: sumF / sumV, meses, conf: "baja" };
      if (sumV > 0) { globalV += sumV; globalF += sumF; }
    });
    const tasaGlobal = globalV > 0 ? globalF / globalV : 0;

    const facturacionProyectadaPorViajes = Array(12).fill(0);
    const desglosePorMesFactura = {};
    for (let mV = 0; mV < 12; mV++) {
      const mF = mV + 1;
      if (mF > 11) continue;
      const viajesMesCliente = {};
      viajes.forEach(r => {
        if (r.fecha.getFullYear() !== curYear || r.fecha.getMonth() !== mV) return;
        const k = normName(r.cliente); if (!k) return;
        viajesMesCliente[k] = (viajesMesCliente[k] || 0) + 1;
      });
      let totalProy = 0;
      const desglose = [];
      Object.entries(viajesMesCliente).forEach(([k, count]) => {
        const t = tasaPorCliente[k];
        const tasa = (t && t.tasa) || tasaGlobal;
        const aporte = count * tasa;
        totalProy += aporte;
        desglose.push({ cliente: k, viajes: count, tasa, aporte, conf: t ? t.conf : "global" });
      });
      facturacionProyectadaPorViajes[mF] = totalProy;
      desglosePorMesFactura[mF] = desglose.sort((a, b) => b.aporte - a.aporte);
    }

    const proyFacturacionMesActual = facturacionProyectadaPorViajes[curMonth] || 0;
    const proyFacturacionMesSiguiente = curMonth < 11 ? (facturacionProyectadaPorViajes[curMonth + 1] || 0) : 0;
    const desgloseMesSiguiente = desglosePorMesFactura[curMonth + 1] || [];

    const totalFacturadoMesActual = ventas
      .filter(r => r.fecha.getMonth() === curMonth && r.fecha.getFullYear() === curYear)
      .reduce((s, r) => s + r.neto, 0);
    const faltaFacturarMesActual = Math.max(0, proyFacturacionMesActual - totalFacturadoMesActual);

    const cobranzaPorVentana = {
      vencidas: { monto: 0, count: 0 },
      prox30: { monto: 0, count: 0 },
      prox60: { monto: 0, count: 0 },
      prox90: { monto: 0, count: 0 },
      masAlla: { monto: 0, count: 0 },
      criticas: { monto: 0, count: 0 },
    };
    if (cobranzas) {
      Object.values(cobranzas.porCliente).forEach(c => {
        c.facturasPendientes.forEach(f => {
          if (f.critica) { cobranzaPorVentana.criticas.monto += f.monto; cobranzaPorVentana.criticas.count++; return; }
          const v = f.vencimiento;
          if (!v) { cobranzaPorVentana.prox30.monto += f.monto; cobranzaPorVentana.prox30.count++; return; }
          if (v < today) { cobranzaPorVentana.vencidas.monto += f.monto; cobranzaPorVentana.vencidas.count++; }
          else if (v <= next30) { cobranzaPorVentana.prox30.monto += f.monto; cobranzaPorVentana.prox30.count++; }
          else if (v <= next60) { cobranzaPorVentana.prox60.monto += f.monto; cobranzaPorVentana.prox60.count++; }
          else if (v <= next90) { cobranzaPorVentana.prox90.monto += f.monto; cobranzaPorVentana.prox90.count++; }
          else { cobranzaPorVentana.masAlla.monto += f.monto; cobranzaPorVentana.masAlla.count++; }
        });
      });
    }

    const dsoAsumido = cobranzas?.dsoGlobal || 35;
    const cobranzaEsperada30 = cobranzaPorVentana.prox30.monto + cobranzaPorVentana.vencidas.monto;
    const cobranzaEsperada60 = cobranzaEsperada30 + cobranzaPorVentana.prox60.monto + (faltaFacturarMesActual * 0.5);
    const cobranzaEsperada90 = cobranzaEsperada60 + cobranzaPorVentana.prox90.monto + (faltaFacturarMesActual * 0.5) + (proyFacturacionMesSiguiente * 0.5);

    // ─────────────────────────────────────────────
    // 4. LEASING Y CRÉDITO
    // ─────────────────────────────────────────────
    const leasingCuotaMensual = sheets.leasing?.totalRow?.cuotaIVA || 0;
    const creditoCuotasFuturas = (sheets.credito || []).filter(r => r.fecha && r.fecha >= today);
    const creditoProxima = creditoCuotasFuturas[0] || null;
    const creditoSaldoActual = creditoCuotasFuturas.length > 0 ? creditoCuotasFuturas[0].saldo : 0;
    const creditoDeudaTotal = creditoCuotasFuturas.reduce((s, r) => s + r.valorCuota, 0);

    // ─────────────────────────────────────────────
    // 5. RATIOS Y SALUD FINANCIERA
    // Usamos liquidez operativa ESTRICTA (sin FFMM)
    // ─────────────────────────────────────────────
    const coberturaRatio30 = totalCompromisos30 > 0 ? liquidezOperativa30 / totalCompromisos30 : null;
    const coberturaRatio60 = totalCompromisos60 > 0 ? liquidezOperativa60 / totalCompromisos60 : null;

    // Cobertura incluyendo colchón (informativa): si todo se rescata
    const coberturaRatioConColchon30 = totalCompromisos30 > 0
      ? (liquidezOperativa30 + colchonTotal) / totalCompromisos30
      : null;

    const flujoNetoEsperado30 = (cobranzaEsperada30) - totalCompromisos30;
    const flujoNetoEsperado60 = (cobranzaEsperada60) - totalCompromisos60;
    const flujoNetoEsperado90 = (cobranzaEsperada90) - totalCompromisos90;

    return {
      today, curMonth, curYear, prevYear,

      // Liquidez operativa estricta (caja + DAP Trabajo)
      totalCaja, saldosBancos: sheets.saldosBancos || {},
      totalDAPTrabajo, totalDAPInversion, totalDAPCredito,
      totalFondos, fondos: sheets.fondos || [],
      dapTrab30, dapTrab60, dapTrab90,
      dapInv30, dapInv60, dapInv90, dapCred30,
      dapsInversion: dapInversion, dapsCredito: dapCredito, dapsTrabajo: dapTrabajo,
      liquidezOperativa30, liquidezOperativa60, liquidezOperativa90,

      // Colchón (informativo, no entra en operativa)
      colchonFFMM, colchonDAPInv, colchonDAPCred, colchonTotal,
      colchonDesglose,

      // Compatibilidad (alias de operativa estricta)
      liquidez30, liquidez60, liquidez90, colchon30,
      daps: sheets.daps || [],

      // Compromisos
      semanas, calendario: cal,
      totalCompromisos30, totalCompromisos60, totalCompromisos90,
      totalFalta30,
      proximasLeasing,
      leasingCuotaMensual,
      creditoProxima, creditoSaldoActual, creditoDeudaTotal, creditoRows: sheets.credito || [],

      // Por recibir
      cobranzaPorVentana,
      cobranzaEsperada30, cobranzaEsperada60, cobranzaEsperada90,
      proyFacturacionMesActual, proyFacturacionMesSiguiente,
      totalFacturadoMesActual, faltaFacturarMesActual,
      desgloseMesSiguiente,
      tasaGlobal, tasaPorCliente,
      facturacionProyectadaPorViajes,

      // Ratios
      coberturaRatio30, coberturaRatio60, coberturaRatioConColchon30,
      flujoNetoEsperado30, flujoNetoEsperado60, flujoNetoEsperado90,
    };
  }, [sheets, cobranzas]);
}
