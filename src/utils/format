// ── FORMATO CHILENO (dots como miles, coma decimal) ──

export const parseNum = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\$/g, "").replace(/%/g, "");
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (commas === 1 && dots >= 1) s = s.replace(/\./g, "").replace(",", ".");
  else if (commas === 0 && dots > 1) s = s.replace(/\./g, "");
  else if (commas === 0 && dots === 1) {
    const ad = s.split(".")[1];
    if (ad && ad.length === 3) s = s.replace(".", "");
  } else if (commas === 1 && dots === 0) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const parseDate = (s) => {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s) ? null : s;
  const str = String(s).trim();
  let p = str.split("/");
  if (p.length === 3) {
    const [a, b, c] = p.map(Number);
    if (c > 1000) return new Date(c, b - 1, a);
    if (a > 1000) return new Date(a, b - 1, c);
  }
  p = str.split("-");
  if (p.length === 3) {
    const [a, b, c] = p.map(Number);
    if (a > 1000) return new Date(a, b - 1, c);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// $M compacto: $123M, $1.2M, $234K
export const fmtM = (n) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return sign + "$" + (abs / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 0 }) + "M";
  if (abs >= 1e6) return sign + "$" + Math.round(abs / 1e6).toLocaleString("es-CL") + "M";
  if (abs >= 1e3) return sign + "$" + Math.round(abs / 1e3).toLocaleString("es-CL") + "K";
  return sign + "$" + Math.round(abs).toLocaleString("es-CL");
};

// $ completo con miles: $1.234.567
export const fmtFull = (n) => {
  if (n == null || isNaN(n)) return "—";
  return (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
};

// Porcentaje con signo
export const fmtPct = (n, decimals = 1) => {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
};

// Porcentaje sin signo
export const fmtPctNoSign = (n, decimals = 1) => {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals) + "%";
};

// Número con separador de miles
export const fmtNum = (n) => {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("es-CL");
};

// Fecha corta: 15/03
export const fmtDateShort = (d) => {
  if (!d) return "—";
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
};

// Fecha media: 15 mar
export const fmtDateMed = (d) => {
  if (!d) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
};

// Fecha larga: 15 de marzo de 2026
export const fmtDateLong = (d) => {
  if (!d) return "—";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

// Días transcurridos entre dos fechas (positivo si d2 > d1)
export const daysBetween = (d1, d2) => {
  if (!d1 || !d2) return null;
  return Math.floor((d2 - d1) / 86400000);
};

// Today sin horas
export const todayMidnight = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Variación porcentual
export const pctChange = (cur, prev) => {
  if (prev === 0 || prev == null) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

// Normalización de nombre cliente — quita puntuación y normaliza espacios
export const normName = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const MESES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const getSaludo = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buenos días";
  if (h >= 12 && h < 19) return "Buenas tardes";
  return "Buenas noches";
};

export const getMonthKey = (d) => {
  if (!d) return null;
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

export const startOfWeek = (d) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes como inicio
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

export const endOfWeek = (d) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};
