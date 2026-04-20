import { useState, useEffect, useCallback, useMemo } from "react";
import { CSV_SOURCES, AUTO_REFRESH_MIN } from "../config/sources.js";
import {
  fetchCSV, fetchFinCSV, fetchRawCSV,
  parseCalendario, parseBancos, parseDAP, parseFondos,
  parseVentas, parseViajes, parseCredito, parseLeasingResumenRaw,
} from "../utils/parsers.js";
import { processFiles, computeCobranzas } from "../utils/fileProcessor.js";
import { todayMidnight } from "../utils/helpers_v2.js";

// Keys de localStorage
const STORAGE_KEY_SALDOS = "mi_centro_saldos_v2";
const STORAGE_KEY_HISTORICO = "mi_centro_historico_v2";
// v1 para retrocompatibilidad (migración)
const STORAGE_KEY_COBRANZAS_V1 = "mi_centro_cobranzas_v1";

function rehydrateDates(obj) {
  if (!obj) return null;
  if (obj.movimientos) {
    obj.movimientos.forEach(m => {
      if (m.fecha) m.fecha = new Date(m.fecha);
      if (m.vencimiento) m.vencimiento = new Date(m.vencimiento);
    });
  }
  if (obj.fechaInforme) obj.fechaInforme = new Date(obj.fechaInforme);
  if (obj.fechaMin) obj.fechaMin = new Date(obj.fechaMin);
  if (obj.fechaMax) obj.fechaMax = new Date(obj.fechaMax);
  if (obj.archivos) {
    obj.archivos.forEach(a => {
      if (a.fechaInforme) a.fechaInforme = new Date(a.fechaInforme);
      if (a.fechaMin) a.fechaMin = new Date(a.fechaMin);
      if (a.fechaMax) a.fechaMax = new Date(a.fechaMax);
    });
  }
  return obj;
}

function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return rehydrateDates(obj);
  } catch (_) {
    return null;
  }
}

function saveToStorage(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (e) {
    console.warn("Storage write failed", e);
  }
}

export function useData() {
  const [sheets, setSheets] = useState(null);
  const [saldosRaw, setSaldosRaw] = useState(null);
  const [historicoRaw, setHistoricoRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const loadSheets = useCallback(async () => {
    setError(null);
    try {
      const [
        ventasRaw, viajesRaw,
        bancosRaw, dapRaw, calendarioRaw, fondosRaw,
        leasingResumenRow, creditoRaw,
      ] = await Promise.all([
        fetchCSV(CSV_SOURCES.ventas),
        fetchCSV(CSV_SOURCES.viajes),
        fetchFinCSV(CSV_SOURCES.finBancos, ["Fecha", "Banco", "Saldo Inicial", "Saldo Final", "Monto"]),
        fetchFinCSV(CSV_SOURCES.finDAP, ["Fecha Inicio", "Vencimiento", "Tasa", "Monto Inicial", "Monto Final", "Vigente"]),
        fetchFinCSV(CSV_SOURCES.finCalendario, ["Fecha", "Monto", "Guardado", "Falta", "Concepto"]),
        fetchFinCSV(CSV_SOURCES.finFondos, ["Empresa", "Fondo", "Administradora", "Monto Invertido", "Valor Actual"]),
        fetchRawCSV(CSV_SOURCES.leasingResumen),
        fetchCSV(CSV_SOURCES.credito),
      ]);

      const ventas = parseVentas(ventasRaw);
      const viajes = parseViajes(viajesRaw);
      const saldosBancos = parseBancos(bancosRaw);
      const daps = parseDAP(dapRaw);
      const calendario = parseCalendario(calendarioRaw);
      const fondos = parseFondos(fondosRaw);
      const credito = parseCredito(creditoRaw);
      const leasing = parseLeasingResumenRaw(leasingResumenRow);

      setSheets({
        ventas, viajes, saldosBancos, daps, calendario, fondos, credito, leasing,
      });
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando datos");
    }
  }, []);

  // Carga inicial de archivos persistidos + migración desde v1
  useEffect(() => {
    // Intentar cargar v2
    const saldos = loadFromStorage(STORAGE_KEY_SALDOS);
    const historico = loadFromStorage(STORAGE_KEY_HISTORICO);
    if (saldos) setSaldosRaw(saldos);
    if (historico) setHistoricoRaw(historico);

    // Migrar desde v1 si existe y no hay v2
    if (!saldos) {
      const v1 = loadFromStorage(STORAGE_KEY_COBRANZAS_V1);
      if (v1) {
        // Wrapea el v1 (formato antiguo) en el nuevo formato
        const migrated = {
          movimientos: v1.movimientos || [],
          fechaInforme: v1.fechaInforme,
          totalMovimientos: v1.totalMovimientos || (v1.movimientos || []).length,
          archivos: [{
            nombre: "archivo v1 migrado",
            cuenta: "1110401001",
            cuentaLabel: "Nacionales",
            totalMovimientos: (v1.movimientos || []).length,
            fechaInforme: v1.fechaInforme,
          }],
          cuentasDetectadas: ["1110401001"],
        };
        setSaldosRaw(migrated);
        saveToStorage(STORAGE_KEY_SALDOS, migrated);
        try { localStorage.removeItem(STORAGE_KEY_COBRANZAS_V1); } catch (_) {}
      }
    }
  }, []);

  useEffect(() => {
    loadSheets().finally(() => setLoading(false));
  }, [loadSheets]);

  useEffect(() => {
    if (AUTO_REFRESH_MIN <= 0) return;
    const id = setInterval(loadSheets, AUTO_REFRESH_MIN * 60000);
    return () => clearInterval(id);
  }, [loadSheets]);

  // ─── Upload de archivos ───
  const uploadSaldos = useCallback(async (files) => {
    const fileArr = Array.from(files);
    const procesado = await processFiles(fileArr);
    setSaldosRaw(procesado);
    saveToStorage(STORAGE_KEY_SALDOS, procesado);
    return procesado;
  }, []);

  const uploadHistorico = useCallback(async (files) => {
    const fileArr = Array.from(files);
    const procesado = await processFiles(fileArr);
    setHistoricoRaw(procesado);
    saveToStorage(STORAGE_KEY_HISTORICO, procesado);
    return procesado;
  }, []);

  const clearSaldos = useCallback(() => {
    setSaldosRaw(null);
    try { localStorage.removeItem(STORAGE_KEY_SALDOS); } catch (_) {}
  }, []);

  const clearHistorico = useCallback(() => {
    setHistoricoRaw(null);
    try { localStorage.removeItem(STORAGE_KEY_HISTORICO); } catch (_) {}
  }, []);

  // Derivado: cobranzas computadas a partir de SALDOS (no del histórico)
  const cobranzas = useMemo(() => {
    if (!saldosRaw) return null;
    return computeCobranzas(saldosRaw);
  }, [saldosRaw]);

  return {
    sheets,
    cobranzas,
    saldosRaw,
    historicoRaw,
    loading,
    error,
    lastUpdate,
    refresh: loadSheets,
    uploadSaldos,
    uploadHistorico,
    clearSaldos,
    clearHistorico,
    // Aliases de compatibilidad (por si algún componente aún usa los nombres viejos)
    cobranzasRaw: saldosRaw,
    uploadCobranzas: uploadSaldos,
    clearCobranzas: clearSaldos,
  };
}
