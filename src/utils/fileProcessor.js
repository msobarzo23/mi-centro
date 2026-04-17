import * as XLSX from "xlsx";
import { parseDate, parseNum, normName, daysBetween, todayMidnight } from "./format.js";
import { CLIENTE_PAGO_DIAS } from "../config/sources.js";

// ══════════════════════════════════════════════════════════════════════
// PROCESADOR DEL ARCHIVO "Informe por Análisis" de Defontana
// 100% local en el navegador, nada sale del equipo
// ══════════════════════════════════════════════════════════════════════

// Lee el archivo como ArrayBuffer y parsea el xlsx
export async function processCobranzasFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Convertir a array de arrays, saltando primeras 6 filas (metadata del informe)
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (allRows.length < 8) throw new Error("Archivo vacío o mal formateado");

  // La fila 7 (índice 6) contiene los headers
  // Encontrar la fila con "Cuenta" / "Descripción" para ser robusto
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

  // Convertir a objetos
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

  // Extraer fecha del informe desde la fila 1 (si existe)
  let fechaInforme = null;
  for (let i = 0; i < Math.min(6, allRows.length); i++) {
    const row = allRows[i];
    for (const cell of row) {
      const s = String(cell || "");
      const m = s.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (m) { fechaInforme = parseDate(m[1]); break; }
    }
    if (fechaInforme) break;
  }
  if (!fechaInforme) fechaInforme = todayMidnight();

  return {
    movimientos,
    fechaInforme,
    totalMovimientos: movimientos.length,
  };
}

// ══════════════════════════════════════════════════════════════════════
// AGING Y MÉTRICAS DE COBRANZA
// ══════════════════════════════════════════════════════════════════════

// Genera objeto por cliente con:
//   - facturas pendientes (no cobradas completamente)
//   - pagos ya recibidos
//   - DSO real (si hay histórico de pagos)
//   - aging buckets
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
        movimientos: [],
        totalCargo: 0,
        totalAbono: 0,
      };
    }
    porCliente[key].movimientos.push(m);
    porCliente[key].totalCargo += m.cargo;
    porCliente[key].totalAbono += m.abono;
  });

  // Para cada cliente, derivar estado de facturas
  Object.values(porCliente).forEach(c => {
    c.saldoPendiente = c.totalCargo - c.totalAbono;

    // Facturas individuales (tipos de Venta + APERTURA con cargo)
    const facturas = c.movimientos
      .filter(m => m.cargo > 0 && m.tipo !== "INGRESO")
      .map(m => ({ ...m, tipoFila: "factura" }));

    // Pagos / abonos (INGRESO con abono > 0 o abonos en movimientos)
    const pagos = c.movimientos.filter(m => m.abono > 0);

    // Matchear pago con factura por numeroDocPago o numeroDoc
    // Esto es importante para calcular DSO real
    const dsoSamples = [];
    pagos.forEach(pago => {
      // Intentar matchear por Número Doc Pago contra Número Doc de factura
      let facturaMatch = null;
      if (pago.numeroDocPago) {
        facturaMatch = facturas.find(f =>
          String(f.numeroDoc).trim() === String(pago.numeroDocPago).trim() ||
          String(f.numero).trim() === String(pago.numeroDocPago).trim()
        );
      }
      if (facturaMatch && facturaMatch.fecha && pago.fecha) {
        const dias = daysBetween(facturaMatch.fecha, pago.fecha);
        if (dias !== null && dias >= 0 && dias < 365) {
          dsoSamples.push({ dias, monto: pago.abono });
        }
      }
    });

    // DSO promedio ponderado por monto cobrado
    if (dsoSamples.length > 0) {
      const totMonto = dsoSamples.reduce((s, x) => s + x.monto, 0);
      c.dsoReal = totMonto > 0
        ? dsoSamples.reduce((s, x) => s + x.dias * x.monto, 0) / totMonto
        : null;
      c.dsoMuestras = dsoSamples.length;
    } else {
      c.dsoReal = null;
      c.dsoMuestras = 0;
    }

    c.facturasCount = facturas.length;
    c.pagosCount = pagos.length;

    // Facturas pendientes = todas las facturas menos los montos pagados
    // Para un aging simple: usar el saldo de cada factura pendiente por fecha de vencimiento
    // Asumimos FIFO: las facturas más antiguas se pagan primero
    let saldoRestante = c.saldoPendiente;
    const facturasOrdenadas = [...facturas].sort((a, b) =>
      (a.vencimiento || a.fecha) - (b.vencimiento || b.fecha)
    );
    // Buscamos asignar el saldoPendiente "hacia atrás" a las facturas más recientes
    // (las más antiguas ya se pagaron). Pero también conservamos las facturas que
    // figuran directamente con saldo > 0 en la fila (las aperturas).
    c.facturasPendientes = [];
    // Método A: Si el archivo trae columna Saldo por fila, respetar ese valor
    //   (Defontana lo pone así cuando filtras por estado "Pendiente")
    const facturasConSaldoPositivo = facturas.filter(f => f.saldo > 0);
    if (facturasConSaldoPositivo.length > 0) {
      facturasConSaldoPositivo.forEach(f => {
        c.facturasPendientes.push({
          folio: f.numero,
          fecha: f.fecha,
          vencimiento: f.vencimiento || estimarVencimiento(f.fecha, c.nombre),
          monto: f.saldo,
          documento: f.documento,
          diasAtraso: f.vencimiento ? daysBetween(f.vencimiento, today) : null,
          tipo: f.tipo,
        });
      });
    } else {
      // Método B: asignar el saldo a las facturas más recientes hacia atrás
      const desc = [...facturas].sort((a, b) => b.fecha - a.fecha);
      let rem = c.saldoPendiente;
      for (const f of desc) {
        if (rem <= 0) break;
        const montoAsignado = Math.min(f.cargo, rem);
        if (montoAsignado > 0) {
          c.facturasPendientes.push({
            folio: f.numero,
            fecha: f.fecha,
            vencimiento: f.vencimiento || estimarVencimiento(f.fecha, c.nombre),
            monto: montoAsignado,
            documento: f.documento,
            diasAtraso: f.vencimiento ? daysBetween(f.vencimiento, today) : null,
            tipo: f.tipo,
          });
          rem -= montoAsignado;
        }
      }
    }
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
    vencidas_90plus: { count: 0, monto: 0, facturas: [] },
  };

  todasFacturasPendientes.forEach(f => {
    const d = f.diasAtraso;
    let bucket;
    if (d == null) bucket = "porVencer";
    else if (d < 0) bucket = "porVencer";
    else if (d <= 30) bucket = "vencidas_0_30";
    else if (d <= 60) bucket = "vencidas_31_60";
    else if (d <= 90) bucket = "vencidas_61_90";
    else bucket = "vencidas_90plus";
    aging[bucket].count++;
    aging[bucket].monto += f.monto;
    aging[bucket].facturas.push(f);
  });

  const totalPendiente = Object.values(porCliente).reduce((s, c) => s + c.saldoPendiente, 0);
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

  return {
    porCliente,
    clientesArray,
    aging,
    totalPendiente,
    dsoGlobal,
    totalFacturasPendientes: todasFacturasPendientes.length,
    fechaInforme: today,
    totalMovimientos: procesado.totalMovimientos,
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
// PROYECCIÓN DE COBRANZA — cuánto voy a cobrar cada semana los próx 90 días
// ══════════════════════════════════════════════════════════════════════
export function buildCobranzaProyectada(cobranzas, today) {
  if (!cobranzas) return [];
  const ref = today || todayMidnight();
  const buckets = []; // {semana, inicio, fin, facturas[], monto}
  for (let w = 0; w < 13; w++) { // 13 semanas ≈ 90 días
    const inicio = new Date(ref);
    inicio.setDate(inicio.getDate() + w * 7);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    buckets.push({ semana: w, inicio, fin, facturas: [], monto: 0, label: `${inicio.getDate()}/${inicio.getMonth()+1} — ${fin.getDate()}/${fin.getMonth()+1}` });
  }
  // Distribuir cada factura pendiente en la semana correspondiente a su vencimiento
  Object.values(cobranzas.porCliente || {}).forEach(c => {
    c.facturasPendientes.forEach(f => {
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
  // Vencidas antes de hoy → bucket "ya vencidas"
  const vencidas = { monto: 0, facturas: [] };
  Object.values(cobranzas.porCliente || {}).forEach(c => {
    c.facturasPendientes.forEach(f => {
      if (f.vencimiento && f.vencimiento < ref) {
        vencidas.monto += f.monto;
        vencidas.facturas.push({ ...f, cliente: c.nombre });
      }
    });
  });
  return { buckets, vencidas };
}
