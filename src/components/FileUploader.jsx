import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, X, AlertCircle } from "lucide-react";
import { fmtDateMed } from "../utils/format.js";

export function FileUploader({ onUpload, onClear, current, compact = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      setError("Solo archivos Excel (.xlsx, .xls, .xlsm)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (e) {
      setError(e.message || "Error procesando archivo");
    }
    setLoading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  if (compact && current) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 12px",
        background: "var(--green-bg)",
        border: "1px solid var(--green-border)",
        borderRadius: 999,
        fontSize: 11,
        color: "var(--green)",
      }}>
        <CheckCircle2 size={12} />
        <span style={{ fontWeight: 600 }}>Cobranzas al {fmtDateMed(current.fechaInforme)}</span>
        <span style={{ color: "var(--tx-muted)" }}>·</span>
        <button onClick={() => inputRef.current?.click()} style={{
          background: "none", border: "none", color: "var(--accent)", cursor: "pointer",
          fontSize: 11, fontWeight: 600, padding: 0, fontFamily: "inherit",
        }}>Actualizar</button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          onChange={(e) => handleFiles(Array.from(e.target.files))}
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
          padding: "32px 24px",
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
            <div className="serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--tx)", marginBottom: 4 }}>
              Cobranzas cargadas
            </div>
            <div style={{ fontSize: 12, color: "var(--tx-muted)", marginBottom: 4 }}>
              Informe al {fmtDateMed(current.fechaInforme)} · {current.totalMovimientos} movimientos
            </div>
            <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
              Haz click o arrastra para reemplazar
            </div>
          </>
        ) : (
          <>
            <div className="serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--tx)", marginBottom: 6 }}>
              Sube el informe de cobranzas
            </div>
            <div style={{ fontSize: 12, color: "var(--tx-muted)", marginBottom: 10, maxWidth: 380, margin: "0 auto 10px", lineHeight: 1.5 }}>
              Exporta el <strong style={{ color: "var(--tx)" }}>Informe por Análisis</strong> de la cuenta 1110401001 desde Defontana y arrástralo aquí (o haz click).
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
          onChange={(e) => handleFiles(Array.from(e.target.files))}
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
          <X size={12} /> Quitar archivo
        </button>
      )}
    </div>
  );
}
