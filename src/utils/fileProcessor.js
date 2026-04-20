import * as XLSX from "xlsx";
import { parseDate, parseNum, normName, daysBetween, todayMidnight } from "./helpers_v2.js";
import { CLIENTE_PAGO_DIAS } from "../config/sources.js";

// ══════════════════════════════════════════════════════════════════════
// PROCESADOR DEL ARCHIVO "Informe por Análisis" de Defontana
// 100% local en el navegador, nada sale del equipo
// Soporta cuentas:
//   1110401001 — Clientes Nacionales
//   1110401002 — Clientes Internacionales
// Multiples archivos se concatenan automáticamente (auto-detectando cuenta
// por el contenido de la columna "Cuenta").
// ══════════════════════════════════════════════════════════════════════

// Mapa de cuenta → etiqueta humana
export const CUENTAS_CLIENTES = {
  "1110401001": "Nacionales",
  "1110401002": "Internacionales",
};

// Lee un archivo xlsx individual y retorna sus movimientos + metadata.
export async function processSingleFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (allRows.length < 8) throw new Error(`${file.name}: archivo vacío o mal formateado`);

  // Encontrar fila de headers
  let headerIdx = 6;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i].map(c => String(c || "").toLowerCase().trim());
    if (row.some(c => c === "cuenta") && row.some(c => c.includes("descripción") || c === "descripcion")) {
      headerIdx = i;
      break;
    }
  }
  const headers = allRows[headerIdx].map(c => String(c || "").trim());
  const dataRows = allRows.slice(headerIdx + 1).filter(r => r && r.some(c => c !== "" && c != null));

  const movimientos = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return {
      cuenta: String(obj["Cuenta"] || "").trim(),
      fecha: parseDate(obj["Fecha"]),
      tipo: String(obj["Tipo"] || "").trim(),
      numero: obj["Número"] || obj["Numero"] || "",
      rut: String(obj["ID Ficha"] || "").trim(),
      cliente: String(obj["Ficha"] || "").trim(),
      cargo: parseNum(obj["Cargo ($)"]),
      abono: parseNum(obj["Abono ($)"]),
      saldo: parseNum(obj["Saldo ($)"]),
      documento: String(obj["Documento"] || "").trim(),
      vencimiento: parseDate(obj["Vencimiento"]),
      numeroDoc: obj["Número Doc."] || obj["Numero Doc."] || "",
      numeroDocPago: obj["Número Doc. Pago"] || obj["Numero Doc. Pago"] || "",
      docPago: String(obj["Doc. Pago"] || "").trim(),
    };
  }).filter(m => m.fecha && m.cliente);

  // Auto-detectar cuenta: la más frecuente de las filas
  const cuentasCount = {};
  movimientos.forEach(m => { if (m.cuenta) cuentasCount[m.cuenta] = (cuentasCount[m.cuenta] || 0) + 1; });
  const cuenta = Object.entries(cuentasCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Extraer fecha del informe desde metadata superior
  let fechaInforme = null;
  for (let i = 0; i < headerIdx; i++) {
    const row = allRows[i] || [];
    for (const cell of row) {
      const s = String(cell || "");
      const m = s.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) || s.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (m) { fechaInforme = parseDate(m[1]); break; }
    }
    if (fechaInforme) break;
  }
  if (!fechaInforme) fechaInforme = todayMidnight();

  // Rango temporal real de los datos
  const fechas = movimientos.map(m => m.fecha).filter(Boolean);
  const fechaMin = fechas.length ? new Date(Math.min(...fechas.map(f => f.getTime()))) : null;
  const fechaMax = fechas.length ? new Date(Math.max(...fechas.map(f => f.getTime()))) : null;

  return {
    nombre: file.name,
    movimientos,
    fechaInforme,
    cuenta,
    cuentaLabel: CUENTAS_CLIENTES[cuenta] || cuenta || "Desconocida",
    totalMovimientos: movimientos.length,
    fechaMin, fechaMax,
  };
}

// Procesa múltiples archivos y los combina en un solo resultado.
// Las cuentas duplicadas se rechazan (no tiene sentido subir 2 veces el nacional).
export async function processFiles(files) {
  const fileArr = Array.from(files);
  if (fileArr.length === 0) throw new Error("No hay archivos que procesar");

  const results = await Promise.all(fileArr.map(processSingleFile));

  // Validar duplicados de cuenta
  const cuentasVistas = new Set();
  for (const r of results) {
    if (r.cuenta && cuentasVistas.has(r.cuenta)) {
      throw new Error(`Subiste dos archivos de la cuenta ${r.cuentaLabel} (${r.cuenta}). Combina solo nacional + internacional.`);
    }
    if (r.cuenta) cuentasVistas.add(r.cuenta);
  }

  const allMovs = [];
  let fechaInforme = null;
  let fechaMin = null, fechaMax = null;
  const archivos = [];

  for (const r of results) {
    allMovs.push(...r.movimientos);
    archivos.push({
      nombre: r.nombre,
      cuenta: r.cuenta,
      cuentaLabel: r.cuentaLabel,
      totalMovimientos: r.totalMovimientos,
      fechaMin: r.fechaMin,
      fechaMax: r.fechaMax,
      fechaInforme: r.fechaInforme,
    });
    if (!fechaInforme || (r.fechaInforme && r.fechaInforme > fechaInforme)) fechaInforme = r.fechaInforme;
    if (r.fechaMin && (!fechaMin || r.fechaMin < fechaMin)) fechaMin = r.fechaMin;
    if (r.fechaMax && (!fechaMax || r.fechaMax > fechaMax)) fechaMax = r.fechaMax;
  }

  return {
    movimientos: allMovs,
    fechaInforme,
    fechaMin,
    fechaMax,
    totalMovimientos: allMovs.length,
    archivos,
    cuentasDetectadas: Array.from(cuentasVistas),
  };
}

// Retrocompatibilidad: si alguna parte del app llamaba processCobranzasFile con un solo file
export async function processCobranzasFile(file) {
  return processFiles([file]);
}

// ══════════════════════════════════════════════════════════════════════
// AGING Y MÉTRICAS DE COBRANZA
// ══════════════════════════════════════════════════════════════════════

// Umbral (en días) a partir del cual una factura se considera "crítica" — requiere
// cobranza especial y NO cuenta como ingreso esperado automático.
export const UMBRAL_FACTURA_CRITICA_DIAS = 180;

// Genera objeto por cliente con facturas pendientes vía FIFO, aging y DSO real.
// Se alimenta SOLO del archivo de "saldos actuales" (el corto con aperturas del
// año). El histórico largo no se usa aquí porque le faltan las aperturas pre-período
// y daría saldos erróneos.
export function computeCobranzas(procesado, todayRef = null) {
  if (!procesado || !procesado.movimientos) return null;
  const today = todayRef || procesado.fechaInforme || todayMidnight();
  const movs = procesado.movimientos;

  // Agrupar por cliente
  const porCliente = {};
  movs.forEach(m => {
    const key = normName(m.cliente);
    if (!porCliente[key]) {
      porCliente[key] = {
        nombre: m.cliente,
        rut: m.rut,
        cuentas: new Set(),
        movimientos: [],
        totalCargo: 0,
        totalAbono: 0,
      };
    }
    porCliente[key].movimientos.push(m);
    porCliente[key].totalCargo += m.cargo;
    porCliente[key].totalAbono += m.abono;
    if (m.cuenta) porCliente[key].cuentas.add(m.cuenta);
  });

  // Para cada cliente, derivar estado de facturas
  // NUEVO algoritmo v1.3: matching exacto por folio (columna N "Número Doc.")
  // Una factura Vta_* y todos los INGRESO que la pagan comparten el mismo
  // numeroDoc. Esto permite:
  //   - Detectar pagos parciales (múltiples INGRESO al mismo folio)
  //   - Calcular DSO real sin FIFO aproximado
  //   - Identificar facturas pendientes con saldo exacto
  // Las filas sin numeroDoc caen a FIFO como fallback.
  Object.values(porCliente).forEach(c => {
    c.saldoPendiente = c.totalCargo - c.totalAbono;
    c.esInternacional = c.cuentas.has("1110401002");
    c.cuentas = Array.from(c.cuentas);

    // Helper para normalizar folios (pueden venir como número o string con .0)
    const normFolio = (v) => {
      if (v == null || v === "") return "";
      const s = String(v).trim();
      if (/^\d+\.0+$/.test(s)) return s.split(".")[0];
      return s;
    };

    // Agrupar por folio
    const porFolio = new Map();
    const sinFolio = [];
    c.movimientos.forEach(m => {
      const folio = normFolio(m.numeroDoc);
      if (!folio) {
        sinFolio.push(m);
        return;
      }
      if (!porFolio.has(folio)) porFolio.set(folio, []);
      porFolio.get(folio).push(m);
    });

    c.facturasPendientes = [];
    c.facturasCriticas = [];
    c.facturasCobrables = [];
    const dsoSamples = [];
    let facturasCount = 0;
    let pagosCount = 0;

    porFolio.forEach((rows, folio) => {
      // Separar cargos (facturas + reversiones + APERTURA) y abonos (pagos + notas crédito)
      const cargos = rows.filter(r => r.cargo > 0).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
      const abonos = rows.filter(r => r.abono > 0).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));

      if (cargos.length === 0) return; // folio solo con abonos sueltos → ignorar aquí

      const totalCargos = cargos.reduce((s, r) => s + r.cargo, 0);
      const totalAbonos = abonos.reduce((s, r) => s + r.abono, 0);
      const saldoFolio = totalCargos - totalAbonos;

      const primerCargo = cargos[0];
      if (primerCargo.tipo !== "APERTURA") facturasCount++;
      pagosCount += abonos.length;

      if (saldoFolio <= 0.01) {
        // Folio completamente pagado → DSO basado en fecha del último abono que saldó
        if (abonos.length > 0 && primerCargo.fecha && primerCargo.tipo !== "APERTURA") {
          const ultimoAbono = abonos[abonos.length - 1];
          const dias = daysBetween(primerCargo.fecha, ultimoAbono.fecha);
          if (dias !== null && dias >= 0 && dias < 730) {
            dsoSamples.push({
              dias,
              monto: totalCargos,
              folio,
              fechaEmision: primerCargo.fecha,
              fechaPago: ultimoAbono.fecha,
              pagosParciales: abonos.length,
            });
          }
        }
        return;
      }

      // Folio pendiente — factura con saldo por cobrar
      const venc = primerCargo.vencimiento || estimarVencimiento(primerCargo.fecha, c.nombre);
      const diasAtraso = venc ? daysBetween(venc, today) : null;
      const critica = diasAtraso != null && diasAtraso > UMBRAL_FACTURA_CRITICA_DIAS;

      const fact = {
        folio,
        fecha: primerCargo.fecha,
        vencimiento: venc,
        monto: saldoFolio,
        montoOriginal: totalCargos,
        montoPagado: totalAbonos,
        documento: primerCargo.documento,
        diasAtraso,
        tipo: primerCargo.tipo,
        cuenta: primerCargo.cuenta,
        esApertura: primerCargo.tipo === "APERTURA",
        critica,
        pagosParciales: abonos.length,
        parcial: abonos.length > 0,
      };
      c.facturasPendientes.push(fact);
      if (critica) c.facturasCriticas.push(fact);
      else c.facturasCobrables.push(fact);
    });

    // Fallback FIFO para movimientos sin folio (si los hubiera — caso raro)
    if (sinFolio.length > 0) {
      const cargosSF = sinFolio.filter(m => m.cargo > 0).sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
      const abonosSF = sinFolio.filter(m => m.abono > 0);
      let rem = abonosSF.reduce((s, m) => s + m.abono, 0) - sinFolio.filter(m => m.cargo > 0 && m.tipo === "INGRESO").reduce((s, m) => s + m.cargo, 0);
      for (const f of cargosSF) {
        if (f.tipo === "INGRESO") continue; // las reversiones ya se descontaron arriba
        if (rem >= f.cargo) { rem -= f.cargo; continue; }
        const saldoF = f.cargo - rem;
        rem = 0;
        const venc = f.vencimiento || estimarVencimiento(f.fecha, c.nombre);
        const diasAtraso = venc ? daysBetween(venc, today) : null;
        const critica = diasAtraso != null && diasAtraso > UMBRAL_FACTURA_CRITICA_DIAS;
        const fact = {
          folio: f.numero || "—",
          fecha: f.fecha, vencimiento: venc,
          monto: saldoF, montoOriginal: f.cargo, montoPagado: f.cargo - saldoF,
          documento: f.documento, diasAtraso, tipo: f.tipo, cuenta: f.cuenta,
          esApertura: f.tipo === "APERTURA", critica, pagosParciales: 0, parcial: false,
          sinFolio: true,
        };
        c.facturasPendientes.push(fact);
        if (critica) c.facturasCriticas.push(fact);
        else c.facturasCobrables.push(fact);
        facturasCount++;
      }
    }

    c.facturasCount = facturasCount;
    c.pagosCount = pagosCount;

    // DSO ponderado por monto original de cada factura
    if (dsoSamples.length > 0) {
      const totMonto = dsoSamples.reduce((s, x) => s + x.monto, 0);
      c.dsoReal = totMonto > 0
        ? dsoSamples.reduce((s, x) => s + x.dias * x.monto, 0) / totMonto
        : null;
      c.dsoMuestras = dsoSamples.length;
      c.dsoSamples = dsoSamples; // expuesto para debugging/drawer
    } else {
      c.dsoReal = null;
      c.dsoMuestras = 0;
      c.dsoSamples = [];
    }

    // Recalcular saldo pendiente usando solo folios con saldo > 0
    // (si todo está saldado por folio pero el total general da negativo,
    //  significa que hay sobrepagos — se muestran como 0, no negativo)
    const saldoPorFolios = c.facturasPendientes.reduce((s, f) => s + f.monto, 0);
    c.saldoPendienteFolios = saldoPorFolios;

    c.montoCriticas = c.facturasCriticas.reduce((s, f) => s + f.monto, 0);
    c.montoCobrables = c.facturasCobrables.reduce((s, f) => s + f.monto, 0);
  });

  // Global: aging buckets y totales
  const todasFacturasPendientes = [];
  Object.values(porCliente).forEach(c => {
    c.facturasPendientes.forEach(f => todasFacturasPendientes.push({ ...f, cliente: c.nombre, clienteKey: normName(c.nombre), rut: c.rut }));
  });

  const aging = {
    porVencer: { count: 0, monto: 0, facturas: [] },
    vencidas_0_30: { count: 0, monto: 0, facturas: [] },
    vencidas_31_60: { count: 0, monto: 0, facturas: [] },
    vencidas_61_90: { count: 0, monto: 0, facturas: [] },
    vencidas_91_180: { count: 0, monto: 0, facturas: [] },
    vencidas_critica: { count: 0, monto: 0, facturas: [] },
  };

  todasFacturasPendientes.forEach(f => {
    const d = f.diasAtraso;
    let bucket;
    if (d == null) bucket = "porVencer";
    else if (d <= 0) bucket = "porVencer";
    else if (d <= 30) bucket = "vencidas_0_30";
    else if (d <= 60) bucket = "vencidas_31_60";
    else if (d <= 90) bucket = "vencidas_61_90";
    else if (d <= UMBRAL_FACTURA_CRITICA_DIAS) bucket = "vencidas_91_180";
    else bucket = "vencidas_critica";
    aging[bucket].count++;
    aging[bucket].monto += f.monto;
    aging[bucket].facturas.push(f);
  });

  const totalPendiente = Object.values(porCliente).reduce((s, c) => s + Math.max(c.saldoPendiente, 0), 0);
  const totalCobrable = aging.porVencer.monto + aging.vencidas_0_30.monto +
                        aging.vencidas_31_60.monto + aging.vencidas_61_90.monto +
                        aging.vencidas_91_180.monto;
  const totalCritico = aging.vencidas_critica.monto;
  const totalVencido = aging.vencidas_0_30.monto + aging.vencidas_31_60.monto +
                       aging.vencidas_61_90.monto + aging.vencidas_91_180.monto +
                       aging.vencidas_critica.monto;

  const clientesArray = Object.values(porCliente)
    .filter(c => Math.abs(c.saldoPendiente) > 0.01)
    .sort((a, b) => b.saldoPendiente - a.saldoPendiente);

  // DSO global ponderado por monto pendiente
  let dsoGlobalSum = 0, dsoGlobalWeight = 0;
  clientesArray.forEach(c => {
    if (c.dsoReal != null && c.saldoPendiente > 0) {
      dsoGlobalSum += c.dsoReal * c.saldoPendiente;
      dsoGlobalWeight += c.saldoPendiente;
    }
  });
  const dsoGlobal = dsoGlobalWeight > 0 ? dsoGlobalSum / dsoGlobalWeight : null;

  // Separar totales por cuenta para dashboards
  const totalPorCuenta = { nacional: 0, internacional: 0 };
  clientesArray.forEach(c => {
    if (c.esInternacional) totalPorCuenta.internacional += c.saldoPendiente;
    else totalPorCuenta.nacional += c.saldoPendiente;
  });

  return {
    porCliente,
    clientesArray,
    aging,
    totalPendiente,
    totalCobrable,
    totalCritico,
    totalVencido,
    totalPorCuenta,
    dsoGlobal,
    totalFacturasPendientes: todasFacturasPendientes.length,
    fechaInforme: today,
    totalMovimientos: procesado.totalMovimientos,
    archivos: procesado.archivos || [],
  };
}

// Estima vencimiento si la factura no lo trae (usa días del cliente o 30 default)
export function estimarVencimiento(fechaFactura, nombreCliente) {
  if (!fechaFactura) return null;
  const dias = CLIENTE_PAGO_DIAS[normName(nombreCliente)] ||
               CLIENTE_PAGO_DIAS[nombreCliente] ||
               (normName(nombreCliente).includes("MAXAM") ? 60 : 30);
  const v = new Date(fechaFactura);
  v.setDate(v.getDate() + dias);
  return v;
}

// ══════════════════════════════════════════════════════════════════════
// PROYECCIÓN DE COBRANZA
// ══════════════════════════════════════════════════════════════════════
export function buildCobranzaProyectada(cobranzas, today) {
  if (!cobranzas) return { buckets: [], vencidas: { monto: 0, facturas: [] }, criticas: { monto: 0, facturas: [] } };
  const ref = today || todayMidnight();
  const buckets = [];
  for (let w = 0; w < 13; w++) {
    const inicio = new Date(ref);
    inicio.setDate(inicio.getDate() + w * 7);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    buckets.push({ semana: w, inicio, fin, facturas: [], monto: 0, label: `${inicio.getDate()}/${inicio.getMonth()+1} — ${fin.getDate()}/${fin.getMonth()+1}` });
  }
  Object.values(cobranzas.porCliente || {}).forEach(c => {
    c.facturasPendientes.forEach(f => {
      if (f.critica) return;
      const venc = f.vencimiento;
      if (!venc) return;
      for (const b of buckets) {
        if (venc >= b.inicio && venc <= b.fin) {
          b.facturas.push({ ...f, cliente: c.nombre });
          b.monto += f.monto;
          break;
        }
      }
    });
  });
  const vencidas = { monto: 0, facturas: [] };
  const criticas = { monto: 0, facturas: [] };
  Object.values(cobranzas.porCliente || {}).forEach(c => {
    c.facturasPendientes.forEach(f => {
      if (f.critica) {
        criticas.monto += f.monto;
        criticas.facturas.push({ ...f, cliente: c.nombre });
      } else if (f.vencimiento && f.vencimiento < ref) {
        vencidas.monto += f.monto;
        vencidas.facturas.push({ ...f, cliente: c.nombre });
      }
    });
  });
  return { buckets, vencidas, criticas };
}
