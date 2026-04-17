import { useState, useEffect, useCallback, useMemo } from "react";
import { CSV_SOURCES, AUTO_REFRESH_MIN } from "../config/sources.js";
import {
  fetchCSV, fetchFinCSV, fetchRawCSV,
  parseCalendario, parseBancos, parseDAP, parseFondos,
  parseVentas, parseViajes, parseCredito, parseLeasingResumenRaw,
} from "../utils/parsers.js";
import { processCobranzasFile, computeCobranzas } from "../utils/fileProcessor.js";
import { todayMidnight } from "../utils/format.js";

const STORAGE_KEY_COBRANZAS = "mi_centro_cobranzas_v1";

export function useData() {
  const [sheets, setSheets] = useState(null);
  const [cobranzasRaw, setCobranzasRaw] = useState(null);
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

  // Cargar cobranzas desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COBRANZAS);
      if (raw) {
        const obj = JSON.parse(raw);
        // Re-hidratar fechas (localStorage serializa Date como string)
        if (obj && obj.movimientos) {
          obj.movimientos.forEach(m => {
            if (m.fecha) m.fecha = new Date(m.fecha);
            if (m.vencimiento) m.vencimiento = new Date(m.vencimiento);
          });
          if (obj.fechaInforme) obj.fechaInforme = new Date(obj.fechaInforme);
          setCobranzasRaw(obj);
        }
      }
    } catch (_) {}
  }, []);

  // Primera carga y auto-refresh
  useEffect(() => {
    loadSheets().finally(() => setLoading(false));
  }, [loadSheets]);

  useEffect(() => {
    if (AUTO_REFRESH_MIN <= 0) return;
    const id = setInterval(loadSheets, AUTO_REFRESH_MIN * 60000);
    return () => clearInterval(id);
  }, [loadSheets]);

  // Procesar archivo de cobranzas subido
  const uploadCobranzas = useCallback(async (file) => {
    const procesado = await processCobranzasFile(file);
    setCobranzasRaw(procesado);
    try {
      localStorage.setItem(STORAGE_KEY_COBRANZAS, JSON.stringify(procesado));
    } catch (_) {}
    return procesado;
  }, []);

  const clearCobranzas = useCallback(() => {
    setCobranzasRaw(null);
    try { localStorage.removeItem(STORAGE_KEY_COBRANZAS); } catch (_) {}
  }, []);

  // Derivado: cobranzas computadas
  const cobranzas = useMemo(() => {
    if (!cobranzasRaw) return null;
    return computeCobranzas(cobranzasRaw);
  }, [cobranzasRaw]);

  return {
    sheets,
    cobranzas,
    cobranzasRaw,
    loading,
    error,
    lastUpdate,
    refresh: loadSheets,
    uploadCobranzas,
    clearCobranzas,
  };
}
