// src/utils/clientesMaestro.js
//
// Motor de cálculos puros para el tab "Clientes 360".
// Agrega por cliente cruzando: filas crudas del xlsx Defontana, el objeto
// `cobranzas` ya computado por fileProcessor.js, y (opcionalmente) datos
// de viajes desde la fuente de operaciones.
//
// El DSO real se calcula vía FIFO implícito: asigno abonos a cargos en
// orden cronológico; para cada cargo que queda 100% saldado registro la
// fecha del abono que lo completó → DSO = avg(fecha_pago − fecha_emisión)
// ponderado por monto. Esto reemplaza el matcheo por folio del v1 porque
// en este archivo Defontana la columna "Número Doc. Pago" viene vacía.

// ──────────────────────────────────────────────────────────────────────
// Umbrales de clasificación (tuneables)
// ──────────────────────────────────────────────────────────────────────

export const UMBRAL_FUGA_DELTA_PCT = -40;    // caída vs periodo anterior
export const UMBRAL_FUGA_DIAS_SIN_VENTA = 60;
export const UMBRAL_DSO_LENTO = 60;          // >60d = lento
export const UMBRAL_DSO_BUENO = 45;          // ≤45d = bueno
export const UMBRAL_NUEVO_DIAS = 90;         // primera factura <90d = nuevo
export const UMBRAL_CARTERA_ESPECIAL_PCT = 0.5; // crítica/total > 50%
export const UMBRAL_GRANDE_PCT_CARTERA = 0.05; // ≥5% de facturación 3m = "grande"

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

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
const daysBetween = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

// ──────────────────────────────────────────────────────────────────────
// DSO real vía FIFO implícito
// ──────────────────────────────────────────────────────────────────────

function computeDsoFifo(filas) {
  // filas: rows de un cliente (ya filtradas), cada una {fecha: Date, tipo, cargo, abono, vencimiento}
  //
  // Cargos = facturas + aperturas (excluye filas INGRESO).
  // Abonos = tipo INGRESO con abono > 0.
  // Reversiones = tipo INGRESO con cargo > 0 (pagos devueltos).
  //
  // Aplico abonos FIFO a cargos en orden cronológico. Cuando un cargo
  // queda 100% saldado, asumo que la "fecha de pago" es la fecha del
  // último abono que contribuyó a saldarlo.
  //
  // Retorno: { dsoProm, dsoMediana, nFacturasPagadas, diasPagoSamples }
  //   dso* = días entre fecha emisión y fecha pago implícita.

  const cargos = filas
    .filter(r => r.tipo !== 'INGRESO' && r.cargo > 0)
    .sort((a, b) => a.fecha - b.fecha)
    .map(r => ({ ...r, pagado: 0, fechaUltimoPago: null }));

  const abonosNetos = [];
  for (const r of filas) {
    if (r.tipo === 'INGRESO') {
      if (r.abono > 0) abonosNetos.push({ fecha: r.fecha, monto: r.abono });
      if (r.cargo > 0) abonosNetos.push({ fecha: r.fecha, monto: -r.cargo });
    }
  }
  abonosNetos.sort((a, b) => a.fecha - b.fecha);

  // Aplicar FIFO. Las reversiones (monto negativo) se tratan como
  // "descontar del pago neto acumulado"; si quedan antes de aplicar
  // pagos nuevos, se netan con el próximo abono positivo.
  let ptr = 0;
  let saldoAbonoAcum = 0;

  for (const ab of abonosNetos) {
    saldoAbonoAcum += ab.monto;
    if (saldoAbonoAcum <= 0) continue;
    // Aplicar saldoAbonoAcum al cargo ptr
    while (saldoAbonoAcum > 0 && ptr < cargos.length) {
      const c = cargos[ptr];
      const falta = c.cargo - c.pagado;
      if (saldoAbonoAcum >= falta) {
        c.pagado = c.cargo;
        c.fechaUltimoPago = ab.fecha;
        saldoAbonoAcum -= falta;
        ptr++;
      } else {
        c.pagado += saldoAbonoAcum;
        c.fechaUltimoPago = ab.fecha;
        saldoAbonoAcum = 0;
      }
    }
  }

  const pagados = cargos.filter(c => c.pagado >= c.cargo - 1 && c.fechaUltimoPago && c.tipo !== 'APERTURA');
  if (pagados.length === 0) return { dsoProm: null, dsoMediana: null, nFacturasPagadas: 0, samples: [] };

  // Ventana: solo facturas emitidas en últimos 18 meses (evita arrastrar DSO histórico)
  // Y filtrar días negativos (pago antes de emisión = mismatch FIFO con facturas pre-reporte)
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);

  const samples = pagados
    .map(c => ({
      folio: c.numeroDoc || c.numero || c.folio,
      fechaEmision: c.fecha,
      fechaPago: c.fechaUltimoPago,
      dias: daysBetween(c.fecha, c.fechaUltimoPago),
      monto: c.cargo,
    }))
    .filter(s => s.dias >= 0 && s.fechaEmision >= cutoff);

  if (samples.length === 0) return { dsoProm: null, dsoMediana: null, nFacturasPagadas: 0, samples: [] };

  // DSO promedio ponderado por monto
  const totalMonto = sum(samples.map(s => s.monto));
  const dsoProm = totalMonto > 0
    ? sum(samples.map(s => s.dias * s.monto)) / totalMonto
    : mean(samples.map(s => s.dias));

  // Mediana
  const sorted = [...samples].map(s => s.dias).sort((a, b) => a - b);
  const dsoMediana = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  return { dsoProm, dsoMediana, nFacturasPagadas: pagados.length, samples };
}

// ──────────────────────────────────────────────────────────────────────
// Clasificador de estado
// ──────────────────────────────────────────────────────────────────────

function clasificarCliente(c, totalFacturacion3m) {
  const alertas = [];
  let estado = 'activo';

  const participacion = safeDiv(c.facturacionUlt3m, totalFacturacion3m);
  const esGrande = participacion >= UMBRAL_GRANDE_PCT_CARTERA;

  // Señal principal de salud de cobranza: prefiero DSO real si hay pagos
  // observados; si no, uso vencimiento promedio ponderado de cobrables
  // (siempre disponible — se calcula de aging).
  const senalDso = c.dsoProm != null ? c.dsoProm : c.diasVencidoPromedio;
  const tieneSenalDso = c.dsoProm != null || c.saldoCobrable > 0;

  // Nuevo primero (excluyente)
  if (c.diasDesdeUltimaVenta != null && c.primeraFacturaDiasAtras != null && c.primeraFacturaDiasAtras < UMBRAL_NUEVO_DIAS) {
    estado = 'cliente_nuevo';
  }
  // Cartera especial: saldo mayoritariamente crítico
  else if (c.saldoTotal > 0 && safeDiv(c.saldoCritico, c.saldoTotal) >= UMBRAL_CARTERA_ESPECIAL_PCT) {
    estado = 'cartera_especial';
    alertas.push({ tipo: 'cartera_especial', msg: `${Math.round(safeDiv(c.saldoCritico, c.saldoTotal) * 100)}% del saldo es crítico (+180 días)` });
  }
  // En fuga: caída fuerte + tiempo sin facturar
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
  // Grande y lento: facturación importante + señal de DSO pobre
  else if (esGrande && tieneSenalDso && senalDso > UMBRAL_DSO_LENTO) {
    estado = 'grande_lento';
    const src = c.dsoProm != null ? 'DSO real' : 'Vencimiento promedio';
    alertas.push({ tipo: 'dso_lento', msg: `${src} ${Math.round(senalDso)} días (lento para su tamaño)` });
  }
  // Rentable: activo + cobrables al día + sin facturas críticas
  else if (c.facturacionUlt3m > 0 && c.saldoCritico === 0 && tieneSenalDso && senalDso <= UMBRAL_DSO_BUENO) {
    estado = 'rentable';
  }

  // Alertas adicionales independientes del estado
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

export function buildClientesMaestro({ rawRows, cobranzas, viajes, hoy }) {
  const HOY = hoy instanceof Date ? hoy : new Date();
  const meses12m = build12MonthsEnding(HOY);
  const meses3m = meses12m.slice(-3);
  const meses3mAnterior = meses12m.slice(-6, -3);
  const meses6m = meses12m.slice(-6);

  // Agrupar filas crudas por cliente.
  // En el shape de fileProcessor.js el campo se llama `cliente` (no `ficha`).
  // Aceptamos ambos por compatibilidad futura.
  const porCliente = new Map();
  for (const r of rawRows || []) {
    const nombre = r?.cliente || r?.ficha;
    if (!nombre || !(r.fecha instanceof Date) || isNaN(r.fecha)) continue;
    if (!porCliente.has(nombre)) porCliente.set(nombre, []);
    porCliente.get(nombre).push(r);
  }

  // Mapa auxiliar: nombre → entry de cobranzas.porCliente.
  // Necesario porque en fileProcessor.js el índice del objeto es `normName(nombre)`,
  // no el nombre literal. Reconstruimos el mapa iterando por valores.
  const cobPorNombre = {};
  if (cobranzas && cobranzas.porCliente) {
    for (const c of Object.values(cobranzas.porCliente)) {
      if (c && c.nombre) cobPorNombre[c.nombre] = c;
    }
  }

  const clientes = [];
  let totalFacturacion3m = 0;
  let totalFacturacion12m = 0;

  for (const [ficha, filas] of porCliente.entries()) {
    const facturas = filas
      .filter(r => r.tipo === 'Vta_FVAELECT' && r.cargo > 0)
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

    // Días desde última venta + días desde primera venta
    const ultimaFactura = facturas.length ? facturas[facturas.length - 1].fecha : null;
    const primeraFactura = facturas.length ? facturas[0].fecha : null;
    const diasDesdeUltimaVenta = ultimaFactura ? daysBetween(ultimaFactura, HOY) : null;
    const primeraFacturaDiasAtras = primeraFactura ? daysBetween(primeraFactura, HOY) : null;

    // Meses con actividad últimos 12
    const mesesConFacturacion12m = montos12m.filter(m => m > 0).length;

    // Saldos desde cobranzas.porCliente (ya calculados por fileProcessor con FIFO arreglado)
    const cob = cobPorNombre[ficha] || {};
    const saldoTotal = cob.saldoPendiente || 0;
    const saldoCobrable = cob.montoCobrables || 0;
    const saldoCritico = cob.montoCriticas || 0;
    const facturasPendientes = cob.facturasPendientes || [];
    const facturasCriticas = cob.facturasCriticas || [];
    const facturasCobrables = cob.facturasCobrables || facturasPendientes.filter(f => !f.critica);

    // Días vencido promedio ponderado (solo cobrables)
    const totalCobrableMonto = sum(facturasCobrables.map(f => f.monto));
    const diasVencidoPromedio = totalCobrableMonto > 0
      ? sum(facturasCobrables.map(f => (f.diasAtraso || 0) * f.monto)) / totalCobrableMonto
      : 0;

    // DSO real vía FIFO.
    // Primero probamos el `dsoReal` que ya calcula fileProcessor.js (matcheo por folio).
    // Si viene null (caso habitual con archivos Defontana actuales donde
    // `Número Doc. Pago` viene vacío), caemos a FIFO implícito.
    const dsoFifo = computeDsoFifo(filas);
    const dsoPromFinal = cob.dsoReal != null ? cob.dsoReal : dsoFifo.dsoProm;
    const nPagosFinal = cob.dsoMuestras || dsoFifo.nFacturasPagadas;

    // DSO efectivo (fallback si no hay pagos observados)
    const dsoEfectivo = promedioMensual3m > 0
      ? (saldoCobrable / promedioMensual3m) * 30
      : null;

    // Enriquecer con viajes (si hay fuente operacional)
    const viajesCli = (viajes && viajes.porCliente) ? (viajes.porCliente[ficha] || viajes.porCliente[ficha.trim()] || {}) : {};
    const viajesMes = viajesCli.viajesMes ?? null;
    const viajesMesAnterior = viajesCli.viajesMesAnterior ?? null;
    const viajesPromedio6m = viajesCli.viajesPromedio6m ?? null;
    const viajes12m = viajesCli.viajes12m || null; // array de {mes, n}

    const clienteBase = {
      nombre: ficha,
      idFicha: cob.rut || (filas.find(r => r.rut) || {}).rut || null,

      // facturación
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

      // actividad
      ultimaFactura,
      primeraFactura,
      diasDesdeUltimaVenta,
      primeraFacturaDiasAtras,

      // cobranza
      saldoTotal,
      saldoCobrable,
      saldoCritico,
      facturasPendientes,
      facturasCriticas,
      facturasCobrables,
      diasVencidoPromedio,

      // DSO
      dsoProm: dsoPromFinal,
      dsoMediana: dsoFifo.dsoMediana,
      nPagosObservados: nPagosFinal,
      dsoEfectivo,
      dsoSamples: dsoFifo.samples,

      // viajes (puede ser null)
      viajesMes,
      viajesMesAnterior,
      viajesPromedio6m,
      viajes12m,
    };

    totalFacturacion3m += facturacionUlt3m;
    totalFacturacion12m += facturacionUlt12m;
    clientes.push(clienteBase);
  }

  // Clasificar (necesita el total 3m para calcular participación)
  for (const c of clientes) {
    const clasif = clasificarCliente(c, totalFacturacion3m);
    c.estado = clasif.estado;
    c.alertas = clasif.alertas;
    c.participacion = clasif.participacion;
    c.esGrande = clasif.esGrande;
  }

  // Ordenar por facturación 3m desc (presente comercial)
  clientes.sort((a, b) => b.facturacionUlt3m - a.facturacionUlt3m);

  // Resumen
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
  };

  return {
    clientes,
    totales,
    meses12m,
    meses3m,
    meses3mAnterior,
    distribucionEstado,
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
// Metadatos de estado para UI (colores, labels)
// ──────────────────────────────────────────────────────────────────────

export const ESTADO_META = {
  rentable: { label: 'Rentable', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', desc: 'Activo con DSO saludable (≤45 días). Es el perfil ideal.' },
  cliente_nuevo: { label: 'Nuevo', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', desc: 'Primera factura hace menos de 90 días. Aún sin historia suficiente.' },
  grande_lento: { label: 'Grande y lento', color: '#d97706', bg: 'rgba(217, 119, 6, 0.14)', desc: 'Cliente importante (≥5% cartera) con DSO >60 días. Oportunidad de negociar plazo.' },
  en_fuga: { label: 'En fuga', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', desc: 'Caída ≥40% vs trimestre anterior o >60 días sin facturar con saldo pendiente. Requiere gestión comercial.' },
  cartera_especial: { label: 'Cartera especial', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', desc: 'Más del 50% del saldo es crítico (+180 días). Cobranza judicial o especial.' },
  activo: { label: 'Activo', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.14)', desc: 'Operación normal sin señales destacables.' },
};
