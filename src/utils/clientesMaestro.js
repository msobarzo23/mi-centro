// src/utils/clientesMaestro.js
//
// Motor de cálculos puros para el tab "Clientes 360".
//
// v1.3.3: DSO por folio (columna N "Número Doc."). Reemplaza el FIFO
// anterior que agrupaba por cliente en vez de por factura individual.

import {
  fmtM, fmtFull, daysBetween, todayMidnight,
} from './helpers_v2.js';

export const CLIENTES_MAESTRO_VERSION = "1.3.3";
if (typeof window !== "undefined") {
  console.log("[mi-centro] clientesMaestro v" + CLIENTES_MAESTRO_VERSION + " cargado");
}

// ──────────────────────────────────────────────────────────────────────
// Umbrales de clasificación
// ──────────────────────────────────────────────────────────────────────

export const UMBRAL_FUGA_DELTA_PCT = -40;
export const UMBRAL_FUGA_DIAS_SIN_VENTA = 60;
export const UMBRAL_DSO_LENTO = 60;
export const UMBRAL_DSO_BUENO = 45;
export const UMBRAL_NUEVO_DIAS = 90;
export const UMBRAL_CARTERA_ESPECIAL_PCT = 0.5;
export const UMBRAL_GRANDE_PCT_CARTERA = 0.05;

const pad2 = n => String(n).padStart(2, '0');
const monthKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function build12MonthsEnding(hoy) {
  const out = [];
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(y, m - i, 1);
    out.push(monthKey(dt));
  }
  return out;
}

const sum = arr => arr.reduce((a, b) => a + (b || 0), 0);
const mean = arr => (arr.length ? sum(arr) / arr.length : 0);
const safeDiv = (a, b) => (b > 0 ? a / b : 0);

// ──────────────────────────────────────────────────────────────────────
// DSO real vía matching exacto por folio (columna N "Número Doc.")
// v1.3.3: fix crítico. El FIFO anterior daba números artificialmente bajos
// porque agrupaba por cliente en vez de por folio individual.
// ──────────────────────────────────────────────────────────────────────

function normFolio(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d+\.0+$/.test(s)) return s.split('.')[0];
  return s;
}

function computeDsoFifo(filas) {
  // Agrupar filas por folio (numeroDoc)
  const porFolio = new Map();
  for (const r of filas) {
    if (!r || !(r.fecha instanceof Date) || isNaN(r.fecha)) continue;
    const folio = normFolio(r.numeroDoc);
    if (!folio) continue;
    if (!porFolio.has(folio)) porFolio.set(folio, []);
    porFolio.get(folio).push(r);
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);

  const samples = [];

  porFolio.forEach((rows, folio) => {
    // Facturas reales (Vta_*) vs reversiones (INGRESO con cargo)
    const facturas = rows
      .filter(r => r.cargo > 0 && r.tipo !== 'INGRESO')
      .sort((a, b) => a.fecha - b.fecha);
    if (facturas.length === 0) return;

    const primerCargo = facturas[0];
    if (primerCargo.tipo === 'APERTURA') return;
    if (primerCargo.fecha < cutoff) return; // muestra fuera de ventana

    const abonos = rows
      .filter(r => r.abono > 0)
      .sort((a, b) => a.fecha - b.fecha);
    if (abonos.length === 0) return;

    const reversiones = rows
      .filter(r => r.cargo > 0 && r.tipo === 'INGRESO')
      .reduce((s, r) => s + r.cargo, 0);

    const totalFacturas = facturas.reduce((s, r) => s + r.cargo, 0);
    const totalAbonos = abonos.reduce((s, r) => s + r.abono, 0) - reversiones;

    // Folio saldado completo → DSO basado en último abono
    if (totalFacturas - totalAbonos > 0.01) return;

    const ultimoAbono = abonos[abonos.length - 1];
    const dias = daysBetween(primerCargo.fecha, ultimoAbono.fecha);
    if (dias === null || dias < 0 || dias >= 730) return;

    samples.push({
      folio,
      fechaEmision: primerCargo.fecha,
      fechaPago: ultimoAbono.fecha,
      dias,
      monto: totalFacturas,
    });
  });

  if (samples.length === 0) {
    return { dsoProm: null, dsoMediana: null, nFacturasPagadas: 0, samples: [] };
  }

  const totalMonto = sum(samples.map(s => s.monto));
  const dsoProm = totalMonto > 0
    ? sum(samples.map(s => s.dias * s.monto)) / totalMonto
    : mean(samples.map(s => s.dias));

  const sorted = [...samples].map(s => s.dias).sort((a, b) => a - b);
  const dsoMediana = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  return { dsoProm, dsoMediana, nFacturasPagadas: samples.length, samples };
}

// ──────────────────────────────────────────────────────────────────────
// Clasificador de estado
// ──────────────────────────────────────────────────────────────────────

function clasificarCliente(c, totalFacturacion3m) {
  const alertas = [];
  let estado = 'activo';

  const participacion = safeDiv(c.facturacionUlt3m, totalFacturacion3m);
  const esGrande = participacion >= UMBRAL_GRANDE_PCT_CARTERA;

  const senalDso = c.dsoProm != null ? c.dsoProm : c.diasVencidoPromedio;
  const tieneSenalDso = c.dsoProm != null || c.saldoCobrable > 0;

  // Nuevo: primera factura hace <90 días. Solo válido si el histórico
  // realmente cubre más que eso. Si el histórico es más corto que 90 días,
  // no podemos concluir "nuevo" con certeza → dejamos activo.
  const tieneHistoricoSuficiente = c.historicoCubreDias >= UMBRAL_NUEVO_DIAS;

  if (tieneHistoricoSuficiente &&
      c.diasDesdeUltimaVenta != null &&
      c.primeraFacturaDiasAtras != null &&
      c.primeraFacturaDiasAtras < UMBRAL_NUEVO_DIAS) {
    estado = 'cliente_nuevo';
  }
  else if (c.saldoTotal > 0 && safeDiv(c.saldoCritico, c.saldoTotal) >= UMBRAL_CARTERA_ESPECIAL_PCT) {
    estado = 'cartera_especial';
    alertas.push({ tipo: 'cartera_especial', msg: `${Math.round(safeDiv(c.saldoCritico, c.saldoTotal) * 100)}% del saldo es crítico (+180 días)` });
  }
  else if (
    (c.deltaPctVs3mAnterior != null && c.deltaPctVs3mAnterior <= UMBRAL_FUGA_DELTA_PCT && c.facturacion3mAnterior > 0) ||
    (c.diasDesdeUltimaVenta != null && c.diasDesdeUltimaVenta > UMBRAL_FUGA_DIAS_SIN_VENTA && c.saldoTotal > 0)
  ) {
    estado = 'en_fuga';
    if (c.deltaPctVs3mAnterior != null && c.deltaPctVs3mAnterior <= UMBRAL_FUGA_DELTA_PCT) {
      alertas.push({ tipo: 'caida', msg: `Facturación cayó ${Math.round(c.deltaPctVs3mAnterior)}% vs trimestre anterior` });
    }
    if (c.diasDesdeUltimaVenta != null && c.diasDesdeUltimaVenta > UMBRAL_FUGA_DIAS_SIN_VENTA) {
      alertas.push({ tipo: 'inactivo', msg: `${c.diasDesdeUltimaVenta} días sin facturar` });
    }
  }
  else if (esGrande && tieneSenalDso && senalDso > UMBRAL_DSO_LENTO) {
    estado = 'grande_lento';
    const src = c.dsoProm != null ? 'DSO real' : 'Vencimiento promedio';
    alertas.push({ tipo: 'dso_lento', msg: `${src} ${Math.round(senalDso)} días (lento para su tamaño)` });
  }
  else if (c.facturacionUlt3m > 0 && c.saldoCritico === 0 && tieneSenalDso && senalDso <= UMBRAL_DSO_BUENO) {
    estado = 'rentable';
  }

  if (c.saldoCritico > 0 && estado !== 'cartera_especial') {
    alertas.push({ tipo: 'saldo_critico', msg: `${(c.saldoCritico / 1e6).toFixed(0)}M en facturas +180 días` });
  }
  if (c.saldoCobrable > 0 && c.diasVencidoPromedio > 30 && estado !== 'grande_lento') {
    alertas.push({ tipo: 'aging', msg: `Vencimiento promedio de cobrables: ${Math.round(c.diasVencidoPromedio)} días` });
  }

  return { estado, alertas, participacion, esGrande };
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

export function buildClientesMaestro({ rawRows, historicoRows, cobranzas, viajes, hoy }) {
  const HOY = hoy instanceof Date ? hoy : new Date();
  const meses12m = build12MonthsEnding(HOY);
  const meses3m = meses12m.slice(-3);
  const meses3mAnterior = meses12m.slice(-6, -3);

  // Usamos historicoRows si existe, sino rawRows (saldos actuales como fallback)
  const fuenteClasificacion = (historicoRows && historicoRows.length > 0) ? historicoRows : (rawRows || []);
  const usandoHistoricoLargo = historicoRows && historicoRows.length > 0;

  // Calcular la cobertura temporal real del archivo de clasificación
  let historicoFechaMin = null, historicoFechaMax = null;
  for (const r of fuenteClasificacion) {
    if (r.fecha instanceof Date && !isNaN(r.fecha)) {
      if (!historicoFechaMin || r.fecha < historicoFechaMin) historicoFechaMin = r.fecha;
      if (!historicoFechaMax || r.fecha > historicoFechaMax) historicoFechaMax = r.fecha;
    }
  }
  const historicoCubreDias = historicoFechaMin ? daysBetween(historicoFechaMin, HOY) : 0;

  // Agrupar filas HISTÓRICAS (clasificación) por cliente
  const porClienteHist = new Map();
  for (const r of fuenteClasificacion) {
    const nombre = r?.cliente || r?.ficha;
    if (!nombre || !(r.fecha instanceof Date) || isNaN(r.fecha)) continue;
    if (!porClienteHist.has(nombre)) porClienteHist.set(nombre, []);
    porClienteHist.get(nombre).push(r);
  }

  // Cobranzas.porCliente está indexado por normName(nombre); construimos
  // un mapa nombre → entry para poder cruzar.
  const cobPorNombre = {};
  if (cobranzas && cobranzas.porCliente) {
    for (const c of Object.values(cobranzas.porCliente)) {
      if (c && c.nombre) cobPorNombre[c.nombre] = c;
    }
  }

  // Todos los clientes: unión entre clientes del histórico + clientes con saldo
  const todosClientes = new Set();
  for (const nombre of porClienteHist.keys()) todosClientes.add(nombre);
  for (const nombre of Object.keys(cobPorNombre)) todosClientes.add(nombre);

  const clientes = [];
  let totalFacturacion3m = 0;
  let totalFacturacion12m = 0;

  for (const nombre of todosClientes) {
    const filas = porClienteHist.get(nombre) || [];
    const facturas = filas
      .filter(r => (r.tipo === 'Vta_FVAELECT' || r.tipo === 'Vta_FVEELECTINT') && r.cargo > 0)
      .sort((a, b) => a.fecha - b.fecha);

    // Facturación mensual 12m
    const mapMensual = new Map();
    for (const m of meses12m) mapMensual.set(m, 0);
    for (const f of facturas) {
      const k = monthKey(f.fecha);
      if (mapMensual.has(k)) mapMensual.set(k, mapMensual.get(k) + f.cargo);
    }
    const facturacionMensual = meses12m.map(m => ({ mes: m, monto: mapMensual.get(m) || 0 }));
    const montos12m = facturacionMensual.map(x => x.monto);
    const montos3m = facturacionMensual.slice(-3).map(x => x.monto);
    const montos3mAnt = facturacionMensual.slice(-6, -3).map(x => x.monto);
    const montos6m = facturacionMensual.slice(-6).map(x => x.monto);

    const facturacionUlt3m = sum(montos3m);
    const facturacionUlt6m = sum(montos6m);
    const facturacionUlt12m = sum(montos12m);
    const facturacion3mAnterior = sum(montos3mAnt);
    const promedioMensual3m = mean(montos3m);
    const promedioMensual6m = mean(montos6m);
    const promedioMensual12m = mean(montos12m);

    const deltaPctVs3mAnterior = facturacion3mAnterior > 0
      ? ((facturacionUlt3m - facturacion3mAnterior) / facturacion3mAnterior) * 100
      : null;

    const ultimaFactura = facturas.length ? facturas[facturas.length - 1].fecha : null;
    const primeraFactura = facturas.length ? facturas[0].fecha : null;
    const diasDesdeUltimaVenta = ultimaFactura ? daysBetween(ultimaFactura, HOY) : null;
    const primeraFacturaDiasAtras = primeraFactura ? daysBetween(primeraFactura, HOY) : null;

    const mesesConFacturacion12m = montos12m.filter(m => m > 0).length;

    // Saldos vienen del archivo ACTUAL (cobranzas), no del histórico
    const cob = cobPorNombre[nombre] || {};
    const saldoTotal = cob.saldoPendiente || 0;
    const saldoCobrable = cob.montoCobrables || 0;
    const saldoCritico = cob.montoCriticas || 0;
    const facturasPendientes = cob.facturasPendientes || [];
    const facturasCriticas = cob.facturasCriticas || [];
    const facturasCobrables = cob.facturasCobrables || facturasPendientes.filter(f => !f.critica);
    const esInternacional = cob.esInternacional || false;

    const totalCobrableMonto = sum(facturasCobrables.map(f => f.monto));
    const diasVencidoPromedio = totalCobrableMonto > 0
      ? sum(facturasCobrables.map(f => (f.diasAtraso || 0) * f.monto)) / totalCobrableMonto
      : 0;

    // DSO: primero prueba matcheo por folio (desde cobranzas); fallback a FIFO sobre histórico
    const dsoFifo = computeDsoFifo(filas);
    const dsoPromFinal = cob.dsoReal != null ? cob.dsoReal : dsoFifo.dsoProm;
    const nPagosFinal = cob.dsoMuestras || dsoFifo.nFacturasPagadas;

    const dsoEfectivo = promedioMensual3m > 0
      ? (saldoCobrable / promedioMensual3m) * 30
      : null;

    const viajesCli = (viajes && viajes.porCliente) ? (viajes.porCliente[nombre] || viajes.porCliente[nombre.trim()] || {}) : {};
    const viajesMes = viajesCli.viajesMes ?? null;
    const viajesMesAnterior = viajesCli.viajesMesAnterior ?? null;
    const viajesPromedio6m = viajesCli.viajesPromedio6m ?? null;
    const viajes12m = viajesCli.viajes12m || null;

    const clienteBase = {
      nombre,
      idFicha: cob.rut || (filas.find(r => r.rut) || {}).rut || null,
      esInternacional,

      facturacionMensual,
      facturacionUlt3m,
      facturacionUlt6m,
      facturacionUlt12m,
      facturacion3mAnterior,
      promedioMensual3m,
      promedioMensual6m,
      promedioMensual12m,
      deltaPctVs3mAnterior,
      nFacturas12m: facturas.filter(f => f.fecha >= new Date(HOY.getFullYear() - 1, HOY.getMonth(), 1)).length,
      mesesConFacturacion12m,

      ultimaFactura,
      primeraFactura,
      diasDesdeUltimaVenta,
      primeraFacturaDiasAtras,
      historicoCubreDias, // para que clasificador sepa si confiar en "nuevo"

      saldoTotal,
      saldoCobrable,
      saldoCritico,
      facturasPendientes,
      facturasCriticas,
      facturasCobrables,
      diasVencidoPromedio,

      dsoProm: dsoPromFinal,
      dsoMediana: dsoFifo.dsoMediana,
      nPagosObservados: nPagosFinal,
      dsoEfectivo,
      dsoSamples: dsoFifo.samples,

      viajesMes,
      viajesMesAnterior,
      viajesPromedio6m,
      viajes12m,
    };

    totalFacturacion3m += facturacionUlt3m;
    totalFacturacion12m += facturacionUlt12m;
    clientes.push(clienteBase);
  }

  for (const c of clientes) {
    const clasif = clasificarCliente(c, totalFacturacion3m);
    c.estado = clasif.estado;
    c.alertas = clasif.alertas;
    c.participacion = clasif.participacion;
    c.esGrande = clasif.esGrande;
  }

  clientes.sort((a, b) => b.facturacionUlt3m - a.facturacionUlt3m);

  const distribucionEstado = clientes.reduce((acc, c) => {
    acc[c.estado] = (acc[c.estado] || 0) + 1;
    return acc;
  }, {});

  const totales = {
    facturacion3m: totalFacturacion3m,
    facturacion12m: totalFacturacion12m,
    saldoTotal: sum(clientes.map(c => c.saldoTotal)),
    saldoCobrable: sum(clientes.map(c => c.saldoCobrable)),
    saldoCritico: sum(clientes.map(c => c.saldoCritico)),
    nClientesActivos3m: clientes.filter(c => c.facturacionUlt3m > 0).length,
    nClientesConSaldo: clientes.filter(c => c.saldoTotal > 0).length,
    nInternacionales: clientes.filter(c => c.esInternacional).length,
  };

  return {
    clientes,
    totales,
    meses12m,
    meses3m,
    meses3mAnterior,
    distribucionEstado,
    usandoHistoricoLargo,
    historicoFechaMin,
    historicoFechaMax,
    historicoCubreDias,
    umbrales: {
      UMBRAL_FUGA_DELTA_PCT,
      UMBRAL_FUGA_DIAS_SIN_VENTA,
      UMBRAL_DSO_LENTO,
      UMBRAL_DSO_BUENO,
      UMBRAL_NUEVO_DIAS,
      UMBRAL_CARTERA_ESPECIAL_PCT,
      UMBRAL_GRANDE_PCT_CARTERA,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Metadatos de estado para UI
// ──────────────────────────────────────────────────────────────────────

export const ESTADO_META = {
  rentable: { label: 'Rentable', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', desc: 'Activo con DSO saludable (≤45 días). Es el perfil ideal.' },
  cliente_nuevo: { label: 'Nuevo', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', desc: 'Primera factura hace menos de 90 días. Aún sin historia suficiente.' },
  grande_lento: { label: 'Grande y lento', color: '#d97706', bg: 'rgba(217, 119, 6, 0.14)', desc: 'Cliente importante (≥5% cartera) con DSO >60 días. Oportunidad de negociar plazo.' },
  en_fuga: { label: 'En fuga', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', desc: 'Caída ≥40% vs trimestre anterior o >60 días sin facturar con saldo pendiente. Requiere gestión comercial.' },
  cartera_especial: { label: 'Cartera especial', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', desc: 'Más del 50% del saldo es crítico (+180 días). Cobranza judicial o especial.' },
  activo: { label: 'Activo', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.14)', desc: 'Operación normal sin señales destacables.' },
};
