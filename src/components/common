import { useState } from "react";

// ── KpiCard: tarjeta de métrica con tooltip opcional ──
export function KpiCard({ icon: Icon, label, value, sub, color = "var(--accent)", colorBg = "var(--accent-bg)", badge, tooltip, highlight = false }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        border: highlight ? `1px solid ${color}44` : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
        flex: "1 1 180px",
        position: "relative",
        cursor: tooltip ? "help" : "default",
      }}
    >
      {highlight && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: color, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0"
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Icon && (
            <div style={{ background: colorBg, borderRadius: 8, padding: 6, display: "flex" }}>
              <Icon size={14} color={color} strokeWidth={2.2} />
            </div>
          )}
          <span style={{ fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            {label}
            {tooltip && <span style={{ fontSize: 10, color: "var(--tx-faint)" }}>ⓘ</span>}
          </span>
        </div>
        {badge && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: colorBg, color, letterSpacing: 0.4 }}>
            {badge}
          </span>
        )}
      </div>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600, color: "var(--tx)", letterSpacing: -0.8, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: String(sub).startsWith("+") ? "var(--green)" : String(sub).startsWith("−") || String(sub).startsWith("-") ? "var(--red)" : "var(--tx-muted)", lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
      {tooltip && hover && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--tooltip-bg)", color: "var(--tooltip-tx)",
          border: `1px solid ${color}55`, borderRadius: 10,
          padding: "12px 14px", fontSize: 11, lineHeight: 1.5,
          zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", minWidth: 260,
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ── SectionCard: tarjeta de sección con título ──
export function SectionCard({ title, subtitle, icon: Icon, color = "var(--accent)", action, children, padding = 20 }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      borderRadius: "var(--radius-lg)",
      padding,
      border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon && <Icon size={16} color={color} strokeWidth={2.2} />}
          <div>
            <div className="serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--tx)", letterSpacing: -0.3 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11.5, color: "var(--tx-muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── DataTable: tabla densa pero legible ──
export function DataTable({ columns, rows, maxRows = null, emptyMsg = "Sin datos" }) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;
  if (visible.length === 0) {
    return <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--tx-dim)", fontSize: 12 }}>{emptyMsg}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                padding: "9px 10px",
                textAlign: c.align || (i === 0 ? "left" : "right"),
                color: "var(--tx-muted)",
                fontWeight: 600,
                fontSize: 10.5,
                borderBottom: "1px solid var(--border)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                whiteSpace: "nowrap",
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map((c, ci) => {
                const val = c.render ? c.render(row, ri) : row[c.key];
                return (
                  <td key={ci} style={{
                    padding: "8px 10px",
                    textAlign: c.align || (ci === 0 ? "left" : "right"),
                    color: c.color ? c.color(row) : "var(--tx)",
                    fontWeight: c.bold ? 600 : 400,
                    whiteSpace: c.wrap ? "normal" : "nowrap",
                    fontVariantNumeric: (c.align === "right" || ci > 0) ? "tabular-nums" : "normal",
                    fontFamily: c.mono ? "var(--font-mono)" : "inherit",
                    maxWidth: c.maxWidth || "none",
                    overflow: c.maxWidth ? "hidden" : "visible",
                    textOverflow: c.maxWidth ? "ellipsis" : "clip",
                  }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Chart Tooltip que respeta el tema ──
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--tooltip-bg)",
      border: "1px solid var(--border-strong)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    }}>
      <div style={{ color: "var(--tooltip-tx)", fontWeight: 600, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatter ? formatter(p.value) : p.value?.toLocaleString?.("es-CL") || p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Badge de estado (semáforo) ──
export function StatusBadge({ level, children, size = "md" }) {
  const map = {
    green: { color: "var(--green)", bg: "var(--green-bg)", border: "var(--green-border)" },
    amber: { color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-border)" },
    red: { color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-border)" },
    blue: { color: "var(--blue)", bg: "var(--blue-bg)", border: "var(--blue-border)" },
    neutral: { color: "var(--tx-muted)", bg: "var(--bg-surface-3)", border: "var(--border)" },
  };
  const s = map[level] || map.neutral;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: size === "sm" ? "2px 7px" : "3px 10px",
      borderRadius: 999,
      fontSize: size === "sm" ? 10 : 10.5,
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ── Empty state ──
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      {Icon && (
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "var(--bg-surface-3)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
        }}>
          <Icon size={24} color="var(--tx-muted)" strokeWidth={1.8} />
        </div>
      )}
      <div className="serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--tx)", marginBottom: 8 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: "var(--tx-muted)", maxWidth: 400, margin: "0 auto 18px", lineHeight: 1.5 }}>{description}</div>}
      {action}
    </div>
  );
}
