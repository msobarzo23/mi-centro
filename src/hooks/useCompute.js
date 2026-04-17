import { useMemo } from "react";
import { normName, pctChange, todayMidnight, daysBetween, startOfWeek, endOfWeek } from "../utils/format.js";
import { getDapType } from "../utils/parsers.js";

// ══════════════════════════════════════════════════════════════════════
// MOTOR DE CRUCE DE DATOS
// Responde las 3 preguntas clave de Miguel (pregunta #11 del chat):
//
//   1. Cuánto falta por completar en las semanas venideras
//   2. Cuánto tenemos para responder
//   3. Cuánto deberíamos recibir (por viajes del mes + facturas pendientes)
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
    const dapCred30 = dapVence(next30, "credito");

    // Liquidez operativa = caja + DAP trabajo que vence en ventana + FFMM
    // (DAP inversión: colchón solo si hace falta; DAP crédito: amarrado a compra terrenos)
    const liquidez30 = totalCaja + dapTrab30 + totalFondos;
    const liquidez60 = totalCaja + dapTrab60 + totalFondos;
    const liquidez90 = totalCaja + dapTrab90 + totalFondos;

    // Colchón (emergencia) = liquidez + DAP inversión
    const colchon30 = liquidez30 + dapInv30;

    // ─────────────────────────────────────────────
    // 2. COMPROMISOS — "cuánto falta por completar"
    //    Lee el calendario financiero, usa tu columna "Falta"
    // ─────────────────────────────────────────────
    const cal = sheets.calendario || [];
    const calFuturos = cal.filter(r => r.fecha && r.fecha >= today);

    // 4 semanas rodantes a partir de esta
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
      const ingresosSem = (w === 0 ? totalCaja : 0) + dapSemMonto;
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
        // Estado basado en tu columna "Falta" — tu control manual domina
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

    // Agregamos cuota leasing y cuota crédito proyectadas en ventana 30d
    // (aunque ya deberían estar en calendario, por si hay gaps)
    const proximasLeasing = (sheets.leasing?.proxCuotas || []).slice(0, 3);

    // ─────────────────────────────────────────────
    // 3. POR RECIBIR — "cuánto deberíamos cobrar"
    //    Combina: facturas pendientes del archivo + proyección nueva facturación
    // ─────────────────────────────────────────────

    // 3.a ─ Proyección facturación mes N+1 usando viajes del mes actual
    //       Lógica: tasa histórica $/viaje por cliente (año anterior, lag 1 mes)
    //       aplicada a los viajes del mes en curso.
    const viajes = sheets.viajes || [];
    const ventas = sheets.ventas || [];

    // Histórico año anterior: viajes mes N y facturación mes N+1, por cliente
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

    // Tasa $/viaje por cliente: suma ventas mes m+1 / suma viajes mes m
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

    // Aplicar tasas: viajes mes mV (año actual) → facturación esperada mes mV+1
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

    // Proyección facturación mes ACTUAL (lo que me falta por facturar en el mes en curso según viajes del mes anterior)
    const proyFacturacionMesActual = facturacionProyectadaPorViajes[curMonth] || 0;
    // Proyección facturación mes SIGUIENTE (basada en viajes YA ejecutados este mes)
    const proyFacturacionMesSiguiente = curMonth < 11 ? (facturacionProyectadaPorViajes[curMonth + 1] || 0) : 0;
    const desgloseMesSiguiente = desglosePorMesFactura[curMonth + 1] || [];

    // Cuánto ya facturé este mes (de lo real)
    const totalFacturadoMesActual = ventas
      .filter(r => r.fecha.getMonth() === curMonth && r.fecha.getFullYear() === curYear)
      .reduce((s, r) => s + r.neto, 0);
    // Diferencia: cuánto todavía me falta por facturar este mes
    const faltaFacturarMesActual = Math.max(0, proyFacturacionMesActual - totalFacturadoMesActual);

    // 3.b ─ Cobranza de facturas pendientes (del archivo subido)
    //       Se agrupa por ventana temporal
    const cobranzaPorVentana = {
      vencidas: { monto: 0, count: 0 },
      prox30: { monto: 0, count: 0 },
      prox60: { monto: 0, count: 0 },
      prox90: { monto: 0, count: 0 },
      masAlla: { monto: 0, count: 0 },
    };
    if (cobranzas) {
      Object.values(cobranzas.porCliente).forEach(c => {
        c.facturasPendientes.forEach(f => {
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

    // 3.c ─ Cobranza total esperada 30/60/90 (existente + nuevas facturaciones)
    //       Nuevas facturaciones del mes se cobran ~30-60 días después (usamos DSO global)
    const dsoAsumido = cobranzas?.dsoGlobal || 35; // días promedio pago
    // Lo que voy a facturar este mes (faltaFacturar) lo cobraré en ~30-45 días
    // Lo que voy a facturar mes siguiente (proyFacturacionMesSiguiente) lo cobraré en ~60-75 días
    // Simplificación: faltaFacturarMesActual se cobra en prox 30-60, proyFacturacionMesSiguiente en 60-90
    const cobranzaEsperada30 = cobranzaPorVentana.prox30.monto + cobranzaPorVentana.vencidas.monto;
    const cobranzaEsperada60 = cobranzaEsperada30 + cobranzaPorVentana.prox60.monto + (faltaFacturarMesActual * 0.5);
    const cobranzaEsperada90 = cobranzaEsperada60 + cobranzaPorVentana.prox90.monto + (faltaFacturarMesActual * 0.5) + (proyFacturacionMesSiguiente * 0.5);

    // ─────────────────────────────────────────────
    // 4. LEASING Y CRÉDITO — proyección gasto próx 30/60/90
    // ─────────────────────────────────────────────
    const leasingCuotaMensual = sheets.leasing?.totalRow?.cuotaIVA || 0;
    const creditoCuotasFuturas = (sheets.credito || []).filter(r => r.fecha && r.fecha >= today);
    const creditoProxima = creditoCuotasFuturas[0] || null;
    const creditoSaldoActual = creditoCuotasFuturas.length > 0 ? creditoCuotasFuturas[0].saldo : 0;
    const creditoDeudaTotal = creditoCuotasFuturas.reduce((s, r) => s + r.valorCuota, 0);

    // ─────────────────────────────────────────────
    // 5. RATIOS Y SALUD FINANCIERA
    // ─────────────────────────────────────────────
    const coberturaRatio30 = totalCompromisos30 > 0 ? liquidez30 / totalCompromisos30 : null;
    const coberturaRatio60 = totalCompromisos60 > 0 ? liquidez60 / totalCompromisos60 : null;

    // Ingreso esperado 30d = cobranza esperada 30d
    // Salida 30d = compromisos 30d
    const flujoNetoEsperado30 = (cobranzaEsperada30) - totalCompromisos30;
    const flujoNetoEsperado60 = (cobranzaEsperada60) - totalCompromisos60;
    const flujoNetoEsperado90 = (cobranzaEsperada90) - totalCompromisos90;

    return {
      // Fechas
      today, curMonth, curYear, prevYear,

      // Liquidez
      totalCaja, saldosBancos: sheets.saldosBancos || {},
      totalDAPTrabajo, totalDAPInversion, totalDAPCredito,
      totalFondos, fondos: sheets.fondos || [],
      dapTrab30, dapTrab60, dapTrab90, dapInv30, dapCred30,
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
      coberturaRatio30, coberturaRatio60,
      flujoNetoEsperado30, flujoNetoEsperado60, flujoNetoEsperado90,
    };
  }, [sheets, cobranzas]);
}
