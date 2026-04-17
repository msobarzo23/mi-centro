import Papa from "papaparse";
import { parseNum, parseDate } from "./format.js";

// Papa async para Google Sheets CSV
export const fetchCSV = (url) => new Promise((resolve) => {
  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (r) => resolve(r.data || []),
    error: () => resolve([]),
  });
});

// Parseo del CSV financiero (auto-detecta header row)
export const fetchFinCSV = (url, knownHeaders) => new Promise((resolve) => {
  Papa.parse(url, {
    download: true,
    header: false,
    skipEmptyLines: true,
    complete: (r) => {
      const rows = r.data || [];
      let headerIdx = -1, bestScore = 0;
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i].map(c => String(c || "").trim().toLowerCase());
        const score = knownHeaders.reduce((s, h) => s + (row.some(c => c.includes(h.toLowerCase())) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; headerIdx = i; }
      }
      if (headerIdx === -1 || bestScore < 2) { resolve([]); return; }
      const headers = rows[headerIdx].map(c => String(c || "").trim());
      const data = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(c => !c || String(c).trim() === "")) continue;
        const obj = {};
        headers.forEach((h, ci) => { if (h) obj[h] = row[ci] || ""; });
        data.push(obj);
      }
      resolve(data);
    },
    error: () => resolve([]),
  });
});

// Normalizador de tipos DAP
export const getDapType = (r) => {
  const t = (r.Tipo || r.tipo || "").toString().toLowerCase().trim();
  if (t.includes("credito") || t.includes("crédito")) return "credito";
  if (t.includes("inversion") || t.includes("inversión")) return "inversion";
  return "trabajo";
};

// Es un DAP vigente?
export const isDapVigente = (r) => {
  const v = (r.Vigente || r.vigente || "").toString().toLowerCase();
  return v === "si" || v === "sí" || v === "yes";
};

// Parser del calendario financiero
export const parseCalendario = (rows) => rows.map(r => ({
  fecha: parseDate(r.Fecha || r.fecha),
  monto: parseNum(r.Monto || r.monto),
  guardado: parseNum(r.Guardado || r.guardado),
  falta: parseNum(r.Falta || r.falta),
  concepto: r.Concepto || r.concepto || "",
  estado: r.Estado || r.estado || "",
  mes: r.Mes || r.mes,
  semana: r.Semana || r.semana,
})).filter(r => r.fecha);

// Parser de bancos → agrega saldos por banco
export const parseBancos = (rows) => {
  const map = {};
  rows.filter(r => r.Banco || r.banco).forEach(r => {
    const banco = r.Banco || r.banco;
    const sf = parseNum(r["Saldo Final"] || r.saldo_final || r.SaldoFinal);
    if (sf > 0) map[banco] = sf;
  });
  return map;
};

// Parser DAP
export const parseDAP = (rows) => rows.filter(isDapVigente).map(r => ({
  banco: r.Banco || r.banco,
  monto: parseNum(r["Monto Inicial"] || r.MontoInicial || r.monto_inicial),
  montoFinal: parseNum(r["Monto Final"] || r.MontoFinal || r.monto_final) || parseNum(r["Monto Inicial"] || r.MontoInicial || r.monto_inicial),
  ganancia: parseNum(r.Ganancia || r.ganancia),
  vencimiento: parseDate(r.Vencimiento || r.vencimiento),
  fechaInicio: parseDate(r["Fecha Inicio"] || r.FechaInicio),
  tasa: r.Tasa || r.tasa || "",
  tipo: getDapType(r),
}));

// Parser fondos mutuos
export const parseFondos = (rows) => rows.filter(r => r.Fondo || r.fondo).map(r => ({
  fondo: r.Fondo || r.fondo,
  admin: r.Administradora || r.administradora,
  invertido: parseNum(r["Monto Invertido"] || r.MontoInvertido || r.monto_invertido),
  actual: parseNum(r["Valor Actual"] || r.ValorActual || r.valor_actual),
  rentPct: r["Rentabilidad %"] || r.rentabilidad_pct || "",
})).filter(r => r.actual > 0);

// Parser de ventas
export const parseVentas = (rows) => rows.map(r => {
  const d = parseDate(r.FECHA || r.Fecha || r.fecha);
  return {
    fecha: d,
    cliente: r["RAZON SOCIAL"] || r["Razon Social"] || r.razon_social || "",
    folio: r.FOLIO || r.Folio || r.folio || "",
    tipo: r.TIPO || r.Tipo || r.tipo || r["TIPO DOCUMENTO"] || "",
    rut: r.RUT || r.Rut || r.rut || "",
    neto: parseNum(r.NETO || r.Neto || r.neto),
  };
}).filter(r => r.fecha);

// Parser de viajes (TMS)
export const parseViajes = (rows) => rows.map(r => ({
  fecha: parseDate(r.fechainicio || r.FechaInicio || r.fecha),
  cliente: r.Cliente || r.cliente || "",
  equipo: r.tipoequipo || r.TipoEquipo || "",
  solicitud: r.solicitud || r.Solicitud || "",
  origen: r.origen || r.Origen || "",
  destino: r.destino || r.Destino || "",
})).filter(r => r.fecha);

// Parser del crédito Itaú
export const parseCredito = (rows) => rows.map(r => ({
  cuota: parseNum(r["N° Cuota"] || r.Cuota || r.cuota),
  fecha: parseDate(r["Fecha Vencimiento"] || r.Fecha || r.fecha),
  capital: parseNum(r["Amortización Capital"] || r["Amortizacion Capital"] || r.capital),
  interes: parseNum(r["Monto Interés"] || r["Monto Interes"] || r.interes),
  valorCuota: parseNum(r["Valor Cuota"] || r.ValorCuota || r.valor_cuota),
  saldo: parseNum(r["Saldo Insoluto"] || r.SaldoInsoluto || r.saldo),
})).filter(r => r.cuota > 0);

// Parser del leasing — formato raw con secciones multi-tabla
export const parseLeasingResumenRaw = (raw) => {
  const result = { emisores: [], totalRow: null, proxCuotas: [], proyeccion: [] };
  if (!raw || raw.length === 0) return result;
  let secEmisor = -1, secProxCuotas = -1, secProyeccion = -1;
  for (let i = 0; i < raw.length; i++) {
    const first = String(raw[i]?.[0] || "").toUpperCase();
    if (first.includes("RESUMEN POR EMISOR")) secEmisor = i;
    if (first.includes("PROXIMAS CUOTAS")) secProxCuotas = i;
    if (first.includes("PROYECCION MENSUAL")) secProyeccion = i;
  }
  if (secEmisor >= 0) {
    for (let i = secEmisor + 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r || !r[0] || String(r[0]).trim() === "") break;
      const emisor = String(r[0]).trim();
      const obj = { emisor, contratos: parseNum(r[1]), tractos: parseNum(r[2]), cuotaUF: parseNum(r[3]), cuotaCLP: parseNum(r[4]), cuotaIVA: parseNum(r[5]), deudaUF: parseNum(r[6]), deudaCLP: parseNum(r[7]) };
      if (emisor.includes("TOTAL")) result.totalRow = obj;
      else result.emisores.push(obj);
    }
  }
  if (secProxCuotas >= 0) {
    for (let i = secProxCuotas + 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r || !r[0] || String(r[0]).trim() === "") break;
      result.proxCuotas.push({
        fecha: String(r[0]).trim(), dias: parseNum(r[1]),
        cuotaUF: parseNum(r[2]), cuotaCLP: parseNum(r[3]), cuotaIVA: parseNum(r[4]),
        bancos: String(r[5] || "").trim(), estado: String(r[6] || "").trim(),
      });
    }
  }
  if (secProyeccion >= 0) {
    for (let i = secProyeccion + 3; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const mes = String(r[0] || "").trim();
      const anio = parseNum(r[1]);
      if (!mes || anio < 2020) { if (mes === "" && anio === 0) continue; break; }
      result.proyeccion.push({
        mes, anio, cuotaUF: parseNum(r[2]), cuotaCLP: parseNum(r[3]), cuotaIVA: parseNum(r[4]),
      });
    }
  }
  return result;
};

export const fetchRawCSV = (url) => new Promise((resolve) => {
  Papa.parse(url, {
    download: true,
    header: false,
    skipEmptyLines: false,
    complete: (r) => resolve(r.data || []),
    error: () => resolve([]),
  });
});
