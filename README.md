# Centro de Gestión — Miguel

App personal de gestión financiera. Cruza ventas, viajes, caja, DAPs, leasing, crédito y cuentas por cobrar para responder **las 3 preguntas clave**:

1. **¿Cuánto falta por completar** en las semanas venideras?
2. **¿Cuánto tenemos para responder?**
3. **¿Cuánto deberíamos recibir** por viajes del mes y facturas pendientes?

## Secciones

- **Cockpit** — las 3 preguntas, semáforo ejecutivo, 4 semanas rodantes, agenda próximos 7 días
- **Flujo 90d** — ingresos vs egresos semana por semana con caja rodante proyectada
- **Por cobrar** — aging, DSO real por cliente, top morosos, drill-down a facturas individuales
- **Ciclo viajes** — viajes del mes → facturación proyectada próximo mes → cobranza subsiguiente

## Privacidad

- El archivo de cobranzas (Defontana) se procesa **100% en tu navegador**. Nunca sale de tu equipo.
- Se persiste en `localStorage` para que no tengas que subirlo en cada visita.
- Los demás datos vienen de tus Google Sheets publicados (los mismos que usas en tus otros dashboards).
- Protección por password en el frontend (`VITE_APP_PASSWORD`).

## Setup local

```bash
cp .env.example .env
# editá .env y cambiá VITE_APP_PASSWORD
npm install
npm run dev
```

Se abre en http://localhost:5173

## Deploy en Vercel (acceso desde PC + móvil)

1. Subir este folder a GitHub (repo privado).
2. Importar en Vercel.
3. Settings → Environment Variables → agregar:
   - `VITE_APP_PASSWORD` = tu password
4. Deploy.
5. En móvil abre la URL y desde el menú del navegador elegí "Instalar como app" o "Agregar a pantalla de inicio" — queda como app nativa gracias al manifest PWA.

## Uso diario

1. **Defontana → Informe por Análisis → Cuenta 1110401001 Clientes Nacionales → exportar .xlsx**.
2. En el app, arrastrás el archivo al uploader del Cockpit (o al tab Por Cobrar).
3. El archivo queda guardado localmente hasta que lo reemplaces con uno nuevo.

### Cuándo actualizar

- **Google Sheets** → automático cada 15 min (o manual con el botón ↻).
- **Archivo de cobranzas** → cuando lo exportes desde Defontana. Típicamente semanal o antes de cada reunión.

## Archivos clave si quieres modificar algo

| Archivo | Para qué |
|---|---|
| `src/config/sources.js` | URLs de Google Sheets, días de pago por cliente |
| `src/utils/fileProcessor.js` | Lógica de parseo del informe Defontana |
| `src/hooks/useCompute.js` | Motor de cálculo que cruza todo |
| `src/tabs/*` | Cada tab visual |

## Stack

React 18 + Vite 5 + Recharts + SheetJS (parseo xlsx en cliente) + Papaparse (CSVs).
Desplegable en Vercel con config cero.

## Notas técnicas

- **DSO real** se calcula matcheando el "Número Doc. Pago" con el "Número Doc." de la factura original.
- **Proyección de facturación**: tasa $/viaje histórica del año anterior por cliente, lag 1 mes. Confianza alta si ≥3 meses de data.
- **Cobertura semana**: respeta tu columna `Falta` del calendario — tu control manual domina.
- **Liquidez operativa**: caja + DAP Trabajo en ventana + FFMM. Excluye DAP Crédito (terrenos) y DAP Inversión (colchón).

Para retomar el desarrollo en otro chat, abrir `CONTINUIDAD.md`.
