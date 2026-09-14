# Poderosa Tracking · Reporte Trimestral COMM

Motor visual para generar automáticamente el reporte trimestral de **Soporte Técnico de Tracking - Santa María y Marañón**.

## Arquitectura

```text
Google Sheets → Apps Script → Render → Node/EJS → Puppeteer → PNG → Google Slides
```

El repositorio quedó preparado para trabajar con la lógica del **reporte trimestral**.

## Resolución

Todos los slides se renderizan en **1600 × 900 px (16:9)**.

La base trimestral elimina:

- el recorte reservado en la esquina superior derecha;
- el header mensual global;
- el footer mensual global;
- la numeración automática de página.

Cada diapositiva puede ser:

- **standalone**: controla completamente su diseño, como el slide 10;
- **shared shell**: utiliza el header/footer trimestral compartido mientras se termina su diseño definitivo.

## Diapositivas trimestrales

| PPT | Plantilla | Estado base | Endpoint PNG |
| --- | --- | --- | --- |
| 10 | `views/partials/slide10.ejs` | Diseño trimestral standalone | `/test-slide10-png` |
| 11 | `views/partials/slide11.ejs` | Pendiente rediseño definitivo | `/test-slide11-png` |
| 12 | `views/partials/slide12.ejs` | Pendiente rediseño definitivo | `/test-slide12-png` |
| 13 | `views/partials/slide13.ejs` | Pendiente rediseño definitivo | `/test-slide13-png` |
| 14 | `views/partials/slide14.ejs` | Base trimestral lista | `/test-slide14-png` |
| 15 | `views/partials/slide15.ejs` | Pendiente rediseño definitivo | `/test-slide15-png` |
| 16 | `views/partials/slide16.ejs` | Base trimestral lista | `/test-slide16-png` |
| 18 | `views/partials/slide18.ejs` | Base trimestral lista | `/test-slide18-png` |
| 20 | `views/partials/slide20.ejs` | Base trimestral lista | `/test-slide20-png` |

Producción:

```text
POST /render/slide10
POST /render/slide11
POST /render/slide12
POST /render/slide13
POST /render/slide14
POST /render/slide15
POST /render/slide16
POST /render/slide18
POST /render/slide20
```

## Base visual trimestral

Archivos principales:

```text
views/report.ejs
public/quarterly.css
views/components/quarterly-header.ejs
views/components/quarterly-footer.ejs
views/components/quarterly-placeholder.ejs
```

`report.ejs` ya no dibuja automáticamente elementos mensuales. El motor decide por slide si usa un diseño standalone o el shell trimestral compartido.

## Datos de prueba

La fuente de prueba trimestral es:

```text
data/sample-quarterly-report.json
```

Incluye los KPI del slide 10, series mensuales/semanales y estructuras compatibles con categorías, compañías, vehículos, suministros, hallazgos y acciones.

## Contrato principal del slide 10

```json
{
  "period": "MAYO-JUNIO-JULIO 2026",
  "comparison": {
    "previousTotal": 46,
    "currentTotal": 80,
    "variationPct": 73.9
  },
  "metrics": {
    "totalAttentions": 183,
    "weeklyAverage": 13.9,
    "companiesCount": 44,
    "uniqueDevices": 128,
    "reincidenceCount": 10,
    "categoryConcentrationShare": 64.5,
    "demandShare": 53.6,
    "topCompaniesAttentions": 98,
    "periodLabel": "MAYO-JUNIO-JULIO 2026"
  }
}
```

El normalizador acepta también equivalentes en español para facilitar la integración con Apps Script.

## Próxima etapa

Rediseñar, uno por uno y contra el PPT aprobado, los slides **11, 12, 13, 14, 15, 16, 18 y 20**, manteniendo intacta esta base trimestral.
