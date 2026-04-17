// Fuentes de datos — reutiliza los CSV publicados que ya tienes en otros apps.
// Si alguno cambia, se edita aquí centralizado.

export const CSV_SOURCES = {
  // ── Ventas / Facturación ──
  ventas: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS07T19mYyF8IMvUMlgaOXG1uJboEoeFvlYtOqMGCwMx_uzAVxy_vKHFL-AjMxCA_lbG8uvBxjFzZpV/pub?gid=0&single=true&output=csv",

  // ── Viajes (TMS base) ──
  viajes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfKblo0PEPiyzfOniTQzk0HEf7fBeH1yC0SFBfKO0sMnGhPPEWI0T7fRtPA9rcXx8VPsptR3T835xa/pub?gid=0&single=true&output=csv",

  // ── Centro Financiero — hojas publicadas ──
  finBancos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=1699395114&single=true&output=csv",
  finDAP: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=1020614134&single=true&output=csv",
  finCalendario: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=1876759165&single=true&output=csv",
  finFondos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=1691837276&single=true&output=csv",
  leasingResumen: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=771027573&single=true&output=csv",
  credito: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlD_sQVnKW53q0m243_Gr0EletIkDxjaN1-mRzdlma7q6WktHBhXYBBunmz5ZyBg/pub?gid=1158539978&single=true&output=csv",
};

// Auto-refresh: cada cuántos minutos sincronizamos Google Sheets
export const AUTO_REFRESH_MIN = 15;

// Clientes con condición comercial distinta (sobreescribe vencimiento del archivo si falta)
export const CLIENTE_PAGO_DIAS = {
  "MAXAM CHILE S.A.": 60,
  "MAXAM CHILE SA": 60,
  // default: 30 días
};

// Clientes afectados por MEPCO (para análisis posterior)
export const MEPCO_CLIENTES = [
  "CALIDRA", "CBB", "BIO BIO CEMENTOS", "NOVANDINO LITIO", "ENAEX", "MAXAM", "ORICA",
];
export const MEPCO_ADJUSTMENT_MONTH = 5; // mayo 2026
