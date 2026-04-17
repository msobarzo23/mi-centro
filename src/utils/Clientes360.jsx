// src/tabs/Clientes360.jsx
//
// Tab #5: Clientes 360 — vista maestra por cliente.
// Tabla sortable con sparkline + drawer lateral con detalle completo.
//
// Props esperadas:
//   cobranzas  : objeto resultado de fileProcessor.computeCobranzas
//   rawRows    : array de filas crudas del xlsx Defontana (ver patch fileProcessor.js)
//   viajes     : opcional { porCliente: { [ficha]: { viajesMes, viajesMesAnterior, viajesPromedio6m, viajes12m } } }
//   hoy        : opcional, Date (default new Date())

import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  X, Search, TrendingDown, TrendingUp, AlertTriangle, ArrowUpDown,
  Briefcase, Calendar, DollarSign, Clock, Users, FileText,
} from 'lucide-react';
import { SectionCard, KpiCard, ChartTooltip } from '../components/common.jsx';
import { fmtM, fmtFull } from '../utils/format.js';
import { buildClientesMaestro, ESTADO_META } from '../utils/clientesMaestro.js';

// ──────────────────────────────────────────────────────────────────────
// Formatters locales
// ──────────────────────────────────────────────────────────────────────

const fmtPct = (n, digits = 1) => (n == null || isNaN(n) ? '—' : `${n.toFixed(digits)}%`);
const fmtInt = n => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-CL'));
const fmtDate = d => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const mesCorto = (ym) => {
  const [y, m] = ym.split('-');
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${nombres[parseInt(m, 10) - 1]}-${y.slice(2)}`;
};

// ──────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────

function Sparkline({ data, color = 'var(--accent)', w = 120, h = 28 }) {
  // data = array de números (12 meses)
  if (!data || data.length === 0) return <span style={{ color: 'var(--tx-muted)' }}>—</span>;
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min || 1;
  const stepX = w / (data.length - 1 || 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const last = points[points.length - 1];
  const hasData = data.some(v => v > 0);

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {hasData && (
        <>
          <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
        </>
      )}
      {!hasData && (
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--border)" strokeDasharray="2,2" strokeWidth="1" />
      )}
    </svg>
  );
}

function EstadoBadge({ estado, compact = false }) {
  const meta = ESTADO_META[estado] || ESTADO_META.activo;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '2px 8px' : '4px 10px',
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: 0.2,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
      {meta.label}
    </span>
  );
}

function Heatmap({ facturacion12m, viajes12m, metrica, meses12m }) {
  const raw = metrica === 'viajes' ? (viajes12m || []) : (facturacion12m || []);
  // Normalizar a array de números de longitud 12
  let valores;
  if (metrica === 'viajes') {
    if (!viajes12m) {
      return <div style={{ fontSize: 12, color: 'var(--tx-muted)', padding: '12px 0' }}>Sin datos de viajes operacionales conectados.</div>;
    }
    const map = new Map(viajes12m.map(v => [v.mes, v.n || 0]));
    valores = meses12m.map(m => map.get(m) || 0);
  } else {
    valores = facturacion12m.map(x => x.monto);
  }
  const max = Math.max(...valores, 1);
  const colorBase = metrica === 'viajes' ? [8, 145, 178] : [217, 119, 6];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
        {valores.map((v, i) => {
          const intensity = v > 0 ? 0.15 + 0.85 * Math.sqrt(v / max) : 0;
          const bg = v > 0
            ? `rgba(${colorBase[0]}, ${colorBase[1]}, ${colorBase[2]}, ${intensity})`
            : 'var(--border)';
          return (
            <div
              key={meses12m[i]}
              title={`${mesCorto(meses12m[i])}: ${metrica === 'viajes' ? fmtInt(v) : fmtM(v)}`}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                background: bg,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: 4,
                fontSize: 9,
                color: intensity > 0.5 ? 'white' : 'var(--tx-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                minHeight: 44,
              }}
            >
              {v > 0 ? (metrica === 'viajes' ? v : fmtM(v, 0).replace('$', '')) : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, fontSize: 10, color: 'var(--tx-muted)', textAlign: 'center' }}>
        {meses12m.map(m => <div key={m}>{mesCorto(m)}</div>)}
      </div>
    </div>
  );
}

function ClienteDrawer({ cliente, onClose, meses12m }) {
  const [metricaHeatmap, setMetricaHeatmap] = useState('facturacion');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // bloquear scroll body
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!cliente) return null;

  const meta = ESTADO_META[cliente.estado] || ESTADO_META.activo;

  // Datos del bar chart
  const barData = cliente.facturacionMensual.map(x => ({
    mes: mesCorto(x.mes),
    monto: x.monto,
    fullMes: x.mes,
  }));

  // Top 10 facturas pendientes por monto
  const topFacturas = [...(cliente.facturasPendientes || [])]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10);

  const colorAging = (dias, critica) => {
    if (critica || dias > 180) return '#7c3aed';
    if (dias > 90) return '#dc2626';
    if (dias > 30) return '#ea580c';
    if (dias > 0) return '#d97706';
    return 'var(--tx-muted)';
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.55)',
          zIndex: 90,
          animation: 'c360-fadeIn 180ms ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-20px 0 60px rgba(0,0,0,.35)',
          zIndex: 91,
          overflowY: 'auto',
          animation: 'c360-slideIn 220ms cubic-bezier(.25,.8,.25,1)',
        }}
      >
        {/* Header sticky */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '18px 24px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginBottom: 4, color: 'var(--tx)' }}>
                {cliente.nombre}
              </div>
              <div style={{ fontSize: 12, color: 'var(--tx-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {cliente.idFicha || 'RUT no disponible'}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <EstadoBadge estado={cliente.estado} />
                {cliente.esGrande && (
                  <span style={{ fontSize: 11, color: 'var(--tx-muted)', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                    {fmtPct(cliente.participacion * 100)} de cartera
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                padding: 8, cursor: 'pointer', color: 'var(--tx)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: meta.bg,
            borderRadius: 8,
            fontSize: 12, color: meta.color, lineHeight: 1.45,
          }}>
            {meta.desc}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <MiniKpi icon={<DollarSign size={14} />} label="Facturación 12m" value={fmtM(cliente.facturacionUlt12m)} />
            <MiniKpi icon={<Briefcase size={14} />} label="Prom. mensual (6m)" value={fmtM(cliente.promedioMensual6m)} />
            <MiniKpi
              icon={<Clock size={14} />}
              label={cliente.dsoProm != null ? 'DSO real (FIFO)' : 'DSO efectivo'}
              value={cliente.dsoProm != null
                ? `${Math.round(cliente.dsoProm)} días`
                : (cliente.dsoEfectivo != null ? `~${Math.round(cliente.dsoEfectivo)} días` : '—')}
              sub={cliente.dsoProm != null ? `${cliente.nPagosObservados} pagos observados` : null}
            />
            <MiniKpi
              icon={<FileText size={14} />}
              label="Saldo pendiente"
              value={fmtM(cliente.saldoTotal)}
              sub={cliente.saldoCritico > 0 ? `${fmtM(cliente.saldoCritico)} crítico` : null}
              subColor={cliente.saldoCritico > 0 ? '#7c3aed' : null}
            />
          </div>

          {/* Alertas */}
          {cliente.alertas && cliente.alertas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cliente.alertas.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', background: 'rgba(217, 119, 6, 0.08)',
                  borderLeft: '3px solid #d97706', borderRadius: 6,
                  fontSize: 13, color: 'var(--tx)',
                }}>
                  <AlertTriangle size={14} style={{ marginTop: 2, color: '#d97706', flexShrink: 0 }} />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Heatmap con toggle */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)' }}>
                Histórico 12 meses
              </div>
              <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {['facturacion', 'viajes'].map(k => (
                  <button
                    key={k}
                    onClick={() => setMetricaHeatmap(k)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600,
                      background: metricaHeatmap === k ? 'var(--accent)' : 'transparent',
                      color: metricaHeatmap === k ? 'white' : 'var(--tx-muted)',
                      border: 'none', cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <Heatmap
              facturacion12m={cliente.facturacionMensual}
              viajes12m={cliente.viajes12m}
              metrica={metricaHeatmap}
              meses12m={meses12m}
            />
          </div>

          {/* Gráfico barras mensual */}
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>
              Facturación mensual
            </div>
            <div style={{ height: 180, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={barData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="2 2" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => fmtM(v, 0).replace('$', '')} width={40} />
                  <Tooltip content={<ChartTooltip valueFormatter={fmtFull} />} cursor={{ fill: 'rgba(217,119,6,0.08)' }} />
                  <Bar dataKey="monto" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top facturas pendientes */}
          {topFacturas.length > 0 && (
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>
                Facturas pendientes — top {topFacturas.length}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', color: 'var(--tx-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500 }}>Folio</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500 }}>Emisión</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500 }}>Vence</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>Monto</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>Atraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFacturas.map((f, i) => (
                      <tr key={`${f.folio}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{f.folio}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--tx-muted)' }}>{fmtDate(f.fecha)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--tx-muted)' }}>{fmtDate(f.vencimiento)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtFull(f.monto)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: colorAging(f.diasAtraso, f.critica), fontWeight: 600 }}>
                          {f.diasAtraso > 0 ? `+${f.diasAtraso}d` : (f.diasAtraso === 0 ? 'hoy' : `${Math.abs(f.diasAtraso)}d`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(cliente.facturasPendientes || []).length > 10 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--tx-muted)', textAlign: 'right' }}>
                  Mostrando 10 de {cliente.facturasPendientes.length} facturas pendientes
                </div>
              )}
            </div>
          )}

          {/* Ficha técnica */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>
              Ficha técnica
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 12 }}>
              <FichaRow label="Primera factura" value={fmtDate(cliente.primeraFactura)} />
              <FichaRow label="Última factura" value={fmtDate(cliente.ultimaFactura)} />
              <FichaRow label="Días sin facturar" value={cliente.diasDesdeUltimaVenta != null ? `${cliente.diasDesdeUltimaVenta} días` : '—'} />
              <FichaRow label="Meses activos 12m" value={`${cliente.mesesConFacturacion12m} / 12`} />
              <FichaRow label="Facturación 3m" value={fmtM(cliente.facturacionUlt3m)} />
              <FichaRow label="Facturación 3m anterior" value={fmtM(cliente.facturacion3mAnterior)} />
              <FichaRow
                label="Δ vs trimestre anterior"
                value={cliente.deltaPctVs3mAnterior == null ? '—' : fmtPct(cliente.deltaPctVs3mAnterior, 0)}
                color={cliente.deltaPctVs3mAnterior == null ? null : (cliente.deltaPctVs3mAnterior >= 0 ? '#059669' : '#dc2626')}
              />
              <FichaRow label="Vencimiento prom. (cobrables)" value={cliente.diasVencidoPromedio > 0 ? `+${Math.round(cliente.diasVencidoPromedio)}d` : 'al día'} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes c360-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes c360-slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}

function MiniKpi({ icon, label, value, sub, subColor }) {
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 600, color: 'var(--tx)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor || 'var(--tx-muted)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function FichaRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--tx-muted)' }}>{label}</span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums',
        color: color || 'var(--tx)', fontWeight: 500,
      }}>{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tab principal
// ──────────────────────────────────────────────────────────────────────

const ESTADOS_ORDEN = ['rentable', 'grande_lento', 'en_fuga', 'cartera_especial', 'cliente_nuevo', 'activo'];

export default function Clientes360({ cobranzas, rawRows, viajes, hoy }) {
  const [seleccion, setSeleccion] = useState(null);
  const [sortKey, setSortKey] = useState('facturacionUlt3m');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [estadosActivos, setEstadosActivos] = useState(new Set(ESTADOS_ORDEN));

  const maestro = useMemo(
    () => buildClientesMaestro({ rawRows, cobranzas, viajes, hoy }),
    [rawRows, cobranzas, viajes, hoy]
  );

  const clientesFiltrados = useMemo(() => {
    let arr = maestro.clientes;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(c => c.nombre.toLowerCase().includes(q) || (c.idFicha || '').toLowerCase().includes(q));
    }
    arr = arr.filter(c => estadosActivos.has(c.estado));
    // Ordenar
    const dir = sortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      const va = a[sortKey] ?? -Infinity;
      const vb = b[sortKey] ?? -Infinity;
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [maestro.clientes, search, estadosActivos, sortKey, sortDir]);

  const toggleEstado = (e) => {
    const next = new Set(estadosActivos);
    if (next.has(e)) next.delete(e); else next.add(e);
    setEstadosActivos(next);
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const headers = [
    { key: 'nombre', label: 'Cliente', align: 'left', sortable: true, w: 'minmax(220px, 1fr)' },
    { key: 'estado', label: 'Estado', align: 'left', sortable: true, w: '150px' },
    { key: 'facturacionUlt3m', label: 'Facturación 3m', align: 'right', sortable: true, w: '120px' },
    { key: 'participacion', label: '% cartera', align: 'right', sortable: true, w: '80px' },
    { key: '_trend', label: 'Tendencia 12m', align: 'center', sortable: false, w: '140px' },
    { key: 'viajesMes', label: 'Viajes mes', align: 'right', sortable: true, w: '90px' },
    { key: 'saldoTotal', label: 'Saldo', align: 'right', sortable: true, w: '110px' },
    { key: 'dsoProm', label: 'DSO', align: 'right', sortable: true, w: '80px' },
  ];

  const gridTemplate = headers.map(h => h.w).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <KpiCard label="Clientes activos (3m)" value={String(maestro.totales.nClientesActivos3m)} />
        <KpiCard label="Facturación 3m" value={fmtM(maestro.totales.facturacion3m)} />
        <KpiCard label="Saldo cobrable" value={fmtM(maestro.totales.saldoCobrable)} />
        <KpiCard
          label="Saldo crítico (+180d)"
          value={fmtM(maestro.totales.saldoCritico)}
        />
      </div>

      {/* Chips distribución */}
      <SectionCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {ESTADOS_ORDEN.map(e => {
              const count = maestro.distribucionEstado[e] || 0;
              const meta = ESTADO_META[e];
              const activo = estadosActivos.has(e);
              return (
                <button
                  key={e}
                  onClick={() => toggleEstado(e)}
                  title={meta.desc}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: `1px solid ${activo ? meta.color : 'var(--border)'}`,
                    background: activo ? meta.bg : 'transparent',
                    color: activo ? meta.color : 'var(--tx-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: activo ? 1 : 0.55,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 150ms',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: activo ? meta.color : 'var(--tx-muted)' }} />
                  {meta.label}
                  <span style={{
                    padding: '0 6px', borderRadius: 10, fontSize: 10,
                    background: activo ? meta.color : 'var(--border)',
                    color: activo ? 'white' : 'var(--tx-muted)',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px',
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg-surface)',
          }}>
            <Search size={14} style={{ color: 'var(--tx-muted)' }} />
            <input
              type="text"
              placeholder="Buscar cliente o RUT…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', color: 'var(--tx)', fontSize: 13,
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--tx-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {clientesFiltrados.length} / {maestro.clientes.length}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Tabla maestra */}
      <SectionCard title="Cartera de clientes" subtitle="Click en una fila para ver detalle completo. Ordenado por facturación últimos 3 meses.">
        <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
          <div style={{ minWidth: 900 }}>
            {/* header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 12,
              padding: '10px 14px',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'var(--tx-muted)',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600,
            }}>
              {headers.map(h => (
                <div
                  key={h.key}
                  onClick={h.sortable ? () => toggleSort(h.key) : undefined}
                  style={{
                    textAlign: h.align,
                    cursor: h.sortable ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: h.align === 'right' ? 'flex-end' : (h.align === 'center' ? 'center' : 'flex-start'),
                    gap: 4,
                    userSelect: 'none',
                  }}
                >
                  {h.label}
                  {h.sortable && (
                    <ArrowUpDown
                      size={11}
                      style={{
                        opacity: sortKey === h.key ? 1 : 0.25,
                        transform: sortKey === h.key && sortDir === 'asc' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 150ms',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* rows */}
            {clientesFiltrados.map((c, i) => {
              const montos12 = c.facturacionMensual.map(x => x.monto);
              const deltaUp = c.deltaPctVs3mAnterior != null && c.deltaPctVs3mAnterior >= 0;
              return (
                <div
                  key={c.nombre}
                  onClick={() => setSeleccion(c)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridTemplate,
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'background 120ms',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Cliente */}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {c.idFicha || '—'}
                    </div>
                  </div>

                  {/* Estado */}
                  <div><EstadoBadge estado={c.estado} compact /></div>

                  {/* Facturación 3m */}
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtM(c.facturacionUlt3m)}
                    {c.deltaPctVs3mAnterior != null && (
                      <div style={{
                        fontSize: 10, color: deltaUp ? '#059669' : '#dc2626',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2,
                      }}>
                        {deltaUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {fmtPct(Math.abs(c.deltaPctVs3mAnterior), 0)}
                      </div>
                    )}
                  </div>

                  {/* Participación */}
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: c.esGrande ? 'var(--accent)' : 'var(--tx-muted)', fontWeight: c.esGrande ? 600 : 400 }}>
                    {fmtPct(c.participacion * 100, 1)}
                  </div>

                  {/* Sparkline */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Sparkline data={montos12} />
                  </div>

                  {/* Viajes mes */}
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--tx-muted)' }}>
                    {c.viajesMes != null ? fmtInt(c.viajesMes) : '—'}
                  </div>

                  {/* Saldo */}
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtM(c.saldoTotal)}
                    {c.saldoCritico > 0 && (
                      <div style={{ fontSize: 10, color: '#7c3aed' }}>
                        {fmtM(c.saldoCritico)} crít.
                      </div>
                    )}
                  </div>

                  {/* DSO */}
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>
                    {c.dsoProm != null ? (
                      <span style={{ color: c.dsoProm > 60 ? '#dc2626' : (c.dsoProm > 45 ? '#d97706' : '#059669') }}>
                        {Math.round(c.dsoProm)}d
                      </span>
                    ) : c.dsoEfectivo != null ? (
                      <span style={{ color: 'var(--tx-muted)', fontSize: 11 }}>~{Math.round(c.dsoEfectivo)}d</span>
                    ) : '—'}
                  </div>
                </div>
              );
            })}

            {clientesFiltrados.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-muted)', fontSize: 13 }}>
                Ningún cliente coincide con los filtros.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Drawer */}
      {seleccion && (
        <ClienteDrawer
          cliente={seleccion}
          onClose={() => setSeleccion(null)}
          meses12m={maestro.meses12m}
        />
      )}
    </div>
  );
}
