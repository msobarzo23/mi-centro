import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, X, AlertCircle, Globe, Building2 } from "lucide-react";
import { fmtDateMed } from "../utils/helpers_v2.js";

export function FileUploader({
  onUpload, onClear, current, compact = false,
  title = "Sube el informe de cobranzas",
  description = "Exporta el Informe por Análisis de Defontana (cuenta 1110401001 Nacionales y/o 1110401002 Internacionales) y arrástralo aquí. Puedes soltar los dos archivos juntos.",
  acceptMultiple = true,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (files) => {
    const arr = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls|xlsm)$/i));
    if (arr.length === 0) {
      setError("Solo archivos Excel (.xlsx, .xls, .xlsm)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onUpload(arr);
    } catch (e) {
      setError(e.message || "Error procesando archivo");
    }
    setLoading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Modo compact: badge con los archivos cargados
  if (compact && current) {
    const archivos = current.archivos || [];
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "6px 12px",
        background: "var(--green-bg)",
        border: "1px solid var(--green-border)",
        borderRadius: 999,
        fontSize: 11,
        color: "var(--green)",
      }}>
        <CheckCircle2 size={12} />
        {archivos.length > 0 ? (
          archivos.map((a, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              {a.cuenta === "1110401002" ? <Globe size={10} /> : <Building2 size={10} />}
              {a.cuentaLabel}
              {i < archivos.length - 1 && <span style={{ color: "var(--tx-muted)" }}>·</span>}
            </span>
          ))
        ) : (
          <span style={{ fontWeight: 600 }}>Al {fmtDateMed(current.fechaInforme)}</span>
        )}
        <span style={{ color: "var(--tx-muted)" }}>·</span>
        <button onClick={() => inputRef.current?.click()} style={{
          background: "none", border: "none", color: "var(--accent)", cursor: "pointer",
          fontSize: 11, fontWeight: 600, padding: 0, fontFamily: "inherit",
        }}>Actualizar</button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          multiple={acceptMultiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={dragOver ? "drag-over" : ""}
        style={{
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-strong)"}`,
          borderRadius: 14,
          padding: "28px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "var(--accent-bg)" : "var(--bg-surface-2)",
          transition: "all 0.15s",
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: current ? "var(--green-bg)" : "var(--accent-bg)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 12,
        }}>
          {loading ? (
            <div className="spinning">
              <Upload size={20} color="var(--accent)" />
            </div>
          ) : current ? (
            <CheckCircle2 size={22} color="var(--green)" />
          ) : (
            <FileSpreadsheet size={22} color="var(--accent)" />
          )}
        </div>
        {current ? (
          <>
            <div className="serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--tx)", marginBottom: 6 }}>
              {(current.archivos || []).length} archivo{(current.archivos || []).length !== 1 ? "s" : ""} cargado{(current.archivos || []).length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
              {(current.archivos || []).map((a, i) => (
                <span key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px",
                  background: a.cuenta === "1110401002" ? "var(--blue-bg)" : "var(--accent-bg)",
                  color: a.cuenta === "1110401002" ? "var(--blue)" : "var(--accent)",
                  border: `1px solid ${a.cuenta === "1110401002" ? "var(--blue-border)" : "var(--accent-border)"}`,
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 600,
                }}>
                  {a.cuenta === "1110401002" ? <Globe size={10} /> : <Building2 size={10} />}
                  {a.cuentaLabel}
                  <span style={{ color: "var(--tx-muted)", fontWeight: 400 }}>· {a.totalMovimientos}</span>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tx-muted)", marginBottom: 4 }}>
              {current.totalMovimientos} movimientos · al {fmtDateMed(current.fechaInforme)}
            </div>
            <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
              Haz click o arrastra para reemplazar
            </div>
          </>
        ) : (
          <>
            <div className="serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--tx)", marginBottom: 6 }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: "var(--tx-muted)", marginBottom: 10, maxWidth: 440, margin: "0 auto 10px", lineHeight: 1.5 }}>
              {description}
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-faint)" }}>
              .xlsx — se procesa 100% en tu navegador, nada sale de este equipo
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          multiple={acceptMultiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </div>
      {error && (
        <div style={{
          marginTop: 10, padding: "10px 14px",
          background: "var(--red-bg)", border: "1px solid var(--red-border)",
          borderRadius: 10, fontSize: 12, color: "var(--red)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {current && onClear && (
        <button onClick={onClear} style={{
          marginTop: 10, padding: "6px 12px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 11, color: "var(--tx-muted)",
          display: "inline-flex", alignItems: "center", gap: 6,
          cursor: "pointer",
        }}>
          <X size={12} /> Quitar archivo{(current.archivos || []).length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
