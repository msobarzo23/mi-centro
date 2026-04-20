// ══════════════════════════════════════════════════════════════════════
// HELPERS V2 — Auto-contenido para el parche v1.2 de Mi Centro
//
// Este archivo existe para desacoplar el parche de `utils/format.js`.
// Si el format.js original no tiene alguna función (p.ej. fmtDateTime,
// todayMidnight, daysBetween), el build / runtime rompe. Aquí defino
// TODAS las helpers que el parche necesita, independientes del original.
// ══════════════════════════════════════════════════════════════════════

// ── Constantes ──────────────────────────────────────────────────────

export const MESES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MESES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
export const DIAS_FULL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ── Fecha & tiempo ──────────────────────────────────────────────────

export function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a, b) {
  if (!a || !b) return null;
  const aD = a instanceof Date ? a : new Date(a);
  const bD = b instanceof Date ? b : new Date(b);
  if (isNaN(aD) || isNaN(bD)) return null;
  const MS = 86400000;
  const aMid = Date.UTC(aD.getFullYear(), aD.getMonth(), aD.getDate());
  const bMid = Date.UTC(bD.getFullYear(), bD.getMonth(), bD.getDate());
  return Math.round((bMid - aMid) / MS);
}

export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio de semana
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Acepta fecha ISO, dd/mm/yyyy, o Date/number y devuelve Date o null
export function parseDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === "number") {
    // Excel serial
    if (val > 10000 && val < 100000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + val * 86400000);
      return isNaN(d) ? null : d;
    }
    const d = new Date(val);
    return isNaN(d) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let [, dd, mm, yyyy] = m;
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    return isNaN(d) ? null : d;
  }
  // ISO
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Parsea números en formato chileno "1.234.567,89" o "1,234.56" etc
export function parseNum(val) {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  let s = String(val).trim();
  if (!s) return 0;
  // Si tiene coma Y punto: el separador decimal es el último que aparece
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // formato chileno: punto miles, coma decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // formato inglés: coma miles, punto decimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // solo coma — asumimos decimal chileno
    s = s.replace(",", ".");
  }
  // Parentheses = negativo
  s = s.replace(/^\(|\)$/g, m => m === "(" ? "-" : "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normaliza un nombre de cliente para comparaciones
export function normName(s) {
  if (!s) return "";
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

export function pctChange(a, b) {
  if (!a || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

// ── Formato numérico (locale chileno) ───────────────────────────────

function formatNumberCL(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const res = decPart ? `${withDots},${decPart}` : withDots;
  return (n < 0 ? "-" : "") + res;
}

// $1.234M (>= 1B → en Bn, 100M-999M → sin decimal, <100M → 1 decimal)
export function fmtM(n) {
  if (n == null || isNaN(n)) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs / 1e9, 1) + "B";
  if (abs >= 1e9) return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs / 1e6, 0) + "M";
  if (abs >= 1e8) return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs / 1e6, 0) + "M";
  if (abs >= 1e6) return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs / 1e6, 1) + "M";
  if (abs >= 1e3) return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs / 1e3, 0) + "K";
  return (n < 0 ? "-" : "") + "$" + formatNumberCL(abs, 0);
}

export function fmtFull(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + formatNumberCL(n, 0);
}

export function fmtNum(n) {
  if (n == null || isNaN(n)) return "—";
  return formatNumberCL(n, 0);
}

export function fmtPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return "—";
  return formatNumberCL(n, decimals) + "%";
}

// ── Formato de fecha ────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, "0"); }

export function fmtDateShort(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}`;
}

export function fmtDateMed(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  return `${pad2(dt.getDate())} ${MESES_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtDateLong(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  return `${DIAS_FULL[dt.getDay()]}, ${dt.getDate()} de ${MESES_FULL[dt.getMonth()].toLowerCase()} de ${dt.getFullYear()}`;
}

// HH:mm (o "10:42 a.m." con AM/PM chileno)
export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  const hrs = dt.getHours();
  const mins = pad2(dt.getMinutes());
  const ampm = hrs >= 12 ? "p.m." : "a.m.";
  const hrs12 = hrs % 12 || 12;
  return `${hrs12}:${mins} ${ampm}`;
}

// ── Saludo ──────────────────────────────────────────────────────────

export function getSaludo() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}
