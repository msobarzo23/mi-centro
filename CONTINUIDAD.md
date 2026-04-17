# Centro de Gestión Miguel — Documento de continuidad

> Este documento permite retomar el desarrollo del app en un nuevo chat sin perder contexto. Pegarlo al iniciar conversación nueva con Claude.

---

## Contexto

**Miguel Sobarzo** — Gerente de Finanzas en Transportes Bello e Hijos Ltda. (Chile).
Construyó el app **"Centro de Gestión — Miguel"** en React/Vite + Vercel. Es su tablero personal privado que cruza datos de varios dashboards que ya tenía (Centro Financiero, dashboard-ventas, dashboard-operaciones, Sales) + un archivo .xlsx de cobranzas que sube manualmente desde Defontana.

El app responde **3 preguntas clave**:
1. Cuánto falta por completar en las semanas venideras
2. Cuánto tenemos para responder
3. Cuánto deberíamos recibir por viajes + facturas pendientes

## Decisiones tomadas

- **Stack:** React 18 + Vite 5 + Recharts + SheetJS (xlsx) + Papaparse (CSV) + Lucide icons. PWA instalable.
- **Hosting:** Vercel + GitHub privado.
- **Privacidad:** Archivo de cobranzas se procesa 100% en navegador. Se guarda en localStorage. Password gate via `VITE_APP_PASSWORD`.
- **Acceso:** Privado pero accesible desde PC y móvil (como Defontana). PWA instalable.
- **Frecuencia:** Miguel lo usa varias veces al día. Auto-refresh de Google Sheets cada 15 min.
- **Fuente de vencimientos:** Columna "Vencimiento" del archivo de Defontana (default 30d, Maxam 60d si falta).
- **Proyección facturación:** Tasa $/viaje histórica año anterior por cliente, lag 1 mes.
- **DSO real:** Se calcula matcheando "Número Doc. Pago" con "Número Doc." de factura.

## Estado actual (v1)

**Completado (4 tabs):**

1. ✅ **Cockpit** — 3 preguntas en cards grandes, semáforo ejecutivo, KPIs de contexto, tabla 4 semanas, ratios de salud, agenda próximos 7 días.
2. ✅ **Flujo 90d** — 13 semanas con ingresos esperados (cobranzas existentes + nueva facturación + DAPs) vs egresos, gráfico ComposedChart, caja rodante, desglose por categoría.
3. ✅ **Por cobrar** — aging buckets, DSO real, top morosos sortable por monto/DSO/vencidas, búsqueda, drill-down a facturas por cliente.
4. ✅ **Ciclo viajes** — vista por cliente que conecta viajes del mes → facturación proyectada → cobranza subsiguiente. Alertas de anomalías.

**Build verificado:** `npm run build` compila limpio (~1MB gzipped 305KB). Deploy directo a Vercel.

## Estructura del código

```
mi-centro/
├── package.json                 # React 18, Vite 5, Recharts, SheetJS, Papaparse, Lucide
├── vite.config.js
├── index.html                   # Fonts: Fraunces + Inter + JetBrains Mono
├── .env.example                 # VITE_APP_PASSWORD
├── public/manifest.webmanifest  # PWA con icon ámbar "M"
└── src/
    ├── main.jsx
    ├── App.jsx                  # Nav tabs, header, theme toggle, refresh
    ├── styles.css               # CSS vars light/dark, paleta editorial cálida
    ├── config/
    │   └── sources.js           # URLs Google Sheets, CLIENTE_PAGO_DIAS, MEPCO_CLIENTES
    ├── utils/
    │   ├── format.js            # parseNum/parseDate chileno, fmtM/fmtFull, fechas
    │   ├── parsers.js           # fetchCSV/fetchFinCSV + parsers por hoja
    │   └── fileProcessor.js     # Procesa xlsx Defontana en navegador, aging, DSO
    ├── hooks/
    │   ├── useData.js           # Orquesta todas las fuentes, localStorage cobranzas
    │   └── useCompute.js        # MOTOR: cruza todo, calcula las 3 preguntas
    ├── components/
    │   ├── PasswordGate.jsx
    │   ├── FileUploader.jsx     # Drag & drop xlsx
    │   └── common.jsx           # KpiCard, SectionCard, DataTable, ChartTooltip, StatusBadge
    └── tabs/
        ├── Cockpit.jsx
        ├── FlujoCaja.jsx
        ├── Cobranzas.jsx
        └── CicloViajes.jsx
```

## Decisiones de diseño clave (no romper)

- **Tipografía editorial:** Fraunces (serif display para títulos) + Inter (cuerpo) + JetBrains Mono (números). Sin Space Grotesk ni Roboto.
- **Paleta cálida:** fondos casi-negro (dark) o crema (light). Acento ámbar/ocre `#d97706` en vez de azul SaaS genérico.
- **CSS vars:** todo usa `var(--bg)`, `var(--accent)`, etc. Para cambiar tema completo, solo se tocan vars en `styles.css`.
- **Formato CLP:** siempre `fmtM` para mostrar resumido, `fmtFull` para tablas detalladas. Usar `fontVariantNumeric: "tabular-nums"` en números.
- **ChartTooltip custom** que respeta `var(--tooltip-bg)` — importante porque Recharts por default ignora el tema.
- **Semáforo de semanas** (Cockpit) basado en la columna `Falta` del calendario financiero de Miguel. Su control manual domina, no lo calculamos.
- **Liquidez operativa** = caja + DAP Trabajo ventana + FFMM. Excluye DAP Crédito (reservado compra terrenos) y DAP Inversión (colchón largo plazo).

## Archivo de cobranzas: estructura esperada

Archivo .xlsx exportado desde **Defontana → Informe por Análisis → Cuenta 1110401001 Clientes Nacionales**:

- Primeras 6 filas: metadata (nombre empresa, RUT, fecha del informe)
- Fila 7: headers
- Columnas clave:
  - `Fecha` (emisión)
  - `Tipo` — `Vta_FVAELECT` (venta), `INGRESO` (pago), `APERTURA`, `NCVELECT` (nota crédito)
  - `Ficha` (nombre cliente)
  - `ID Ficha` (RUT)
  - `Cargo ($)` / `Abono ($)` / `Saldo ($)`
  - `Vencimiento`
  - `Número Doc.` (folio factura)
  - `Número Doc. Pago` (matchea pago con factura → DSO real)

Total pendiente típico: ~$7.800M CLP en 46 clientes.

## Tabs pendientes para v2 (siguiente iteración)

Miguel dejó fuera de v1 estos 3 tabs para no demorar la entrega. Cuando retomemos:

### 5. Clientes 360
Vista maestra por cliente en una sola fila expandible:
- Concentración (% vs total)
- Viajes mes / facturación mes / cobranza promedio / DSO / saldo pendiente / tendencia 6m
- Identifica: clientes rentables con DSO bueno, grandes pero lentos, en fuga
- Heatmap histórico por mes (viajes × facturación)

### 6. Eficiencia de capital
Vista estratégica del gerente de finanzas:
- Yield ponderado DAPs vs benchmark Chile
- Capital ocioso (caja por encima de N días de compromisos)
- Costo financiero total mensual (intereses leasing + crédito + costo oportunidad)
- Ratio deuda/facturación trimestral (leasing + crédito Itaú)
- **Simulador "qué pasa si":** rescato DAP X, anticipo cuota crédito, rolo a tasa Y
- Yield individual de cada DAP vs tasa promedio mercado

### 7. Simulador MEPCO + Alertas unificadas
- Impacto MEPCO real por cliente desde mayo 2026 (Calidra, CBB, Novandino ya cerrados)
- Cuánto más cobramos vs sin ajuste
- Clientes que NO han absorbido el ajuste (comparar tarifa promedio post/pre)
- Alertas unificadas consolidadas en un feed:
  - Flujo proyectado negativo en semana N
  - Factura vencida +30d
  - Cliente grande cayó -25% en viajes
  - DAP vence sin estrategia rollover
  - Cobertura próxima semana <100%

## Para arrancar próximo chat

Pegar este doc + algo como:

> "Hola Claude, retomemos el Centro de Gestión — Miguel. Te paso el doc de continuidad. Ya tengo la v1 con 4 tabs (Cockpit, Flujo 90d, Por cobrar, Ciclo viajes) funcionando. Quiero construir ahora el tab 5: Clientes 360. Las otras dos (Eficiencia Capital, Simulador MEPCO) las dejo para iteración posterior."

Importante: Claude debe pedir a Miguel el archivo .xlsx de cobranzas actualizado de Defontana para tener los últimos datos reales al diseñar las nuevas vistas.

## Gotchas a recordar

1. **Papaparse con `download: true`** requiere que los Google Sheets estén publicados como CSV (en `sources.js`).
2. **`fetchFinCSV`** auto-detecta qué fila tiene los headers porque las hojas del Centro Financiero tienen metadata variable antes del header.
3. **`parseLeasingResumenRaw`** lee un CSV con 3 tablas concatenadas (Resumen por emisor + Próximas cuotas + Proyección mensual).
4. **DAPs** se clasifican en "trabajo", "inversion", "credito". Solo los de trabajo se consideran liquidez operativa.
5. **localStorage cobranzas**: el key es `mi_centro_cobranzas_v1`. Si se cambia la estructura, hay que subir la versión para que se invalide.
6. **Re-hidratar dates**: cuando se lee de localStorage, los `Date` vienen como strings. Hay código en `useData.js` para revivirlos.
7. **Modo compacto del FileUploader**: cuando ya hay archivo cargado, en el header del Cockpit se muestra un badge verde con "Actualizar" inline.

## Problemas conocidos / futuros refinamientos

- El bundle JS es 1MB (SheetJS pesa harto). Se podría lazy-load la librería xlsx solo cuando se sube el archivo.
- `buildFlujo` en `FlujoCaja.jsx` asume distribución uniforme de nueva facturación en 4 semanas (6-9 para mes actual, 9-12 para mes siguiente). Se podría refinar con distribución real según DSO histórico.
- El cálculo de `dsoReal` puede fallar si los folios tienen formato distinto en el archivo (strings vs numbers). Hay un cast con `String().trim()` pero no es bulletproof.
- Alertas en `CicloViajes.jsx` son estáticas. Podrían moverse a un feed global con dismiss.
