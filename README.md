# Poderosa Atenciones Tracking · COMM

Motor visual para generar automáticamente el informe mensual de atenciones de Tracking Poderosa. Utiliza plantillas, indicadores y contratos de datos propios.

## Arquitectura

```text
Google Sheets → Apps Script → Render → Node/EJS → Puppeteer → PNG → Google Slides
```

- **Google Sheets** conserva los registros y el mes seleccionado.
- **Apps Script** agrupa la información y envía un JSON por diapositiva.
- **Render** ejecuta este motor visual.
- **Puppeteer** produce imágenes 16:9 con viewport de 1600×900 y salida de alta definición.
- **Google Slides** recibe las imágenes y conforma el informe final.

## Diapositivas disponibles

| Diapositiva PPT | Plantilla EJS | Contenido | Endpoint de prueba |
| --- | --- | --- | --- |
| 10 | `views/partials/slide10.ejs` | Resumen ejecutivo | `/test-slide10-png` |
| 11 | `views/partials/slide11.ejs` | Evolución diaria | `/test-slide11-png` |
| 12 | `views/partials/slide12.ejs` | Categorías de atención | `/test-slide12-png` |
| 13 | `views/partials/slide13.ejs` | Compañías y tipos de vehículo | `/test-slide13-png` |
| 15 | `views/partials/slide15.ejs` | Insumos utilizados / Top 10 | `/test-slide15-png` |
| 17 | `views/partials/slide17.ejs` | Hallazgos y acciones | `/test-slide17-png` |

Cada vista también cuenta con:

- HTML: `/test-slideNN`
- PNG de prueba: `/test-slideNN-png`
- Producción: `POST /render/slideNN`

## Integración con la plantilla

- Los PNG se generan con fondo transparente para conservar los elementos existentes de la plantilla.
- La esquina superior derecha reserva una zona de 420 × 125 px para el logotipo oficial de COMM.
- El motor no dibuja ni sustituye el logotipo.
- Apps Script debe insertar cada PNG a tamaño completo, conservando la transparencia.

## Regla dinámica de insumos

- Si el mes tiene **10 insumos o menos**, la tabla y el gráfico muestran todos.
- Si el mes tiene **más de 10 insumos**, muestran los 10 de mayor cantidad.
- El orden siempre es descendente.
- Cada cantidad conserva su unidad (`und`, `m`, `veces de uso`, etc.).
- No se suman ni se generan porcentajes entre unidades incompatibles.

## Contrato de datos

Los endpoints de producción reciben el mismo objeto general y cada plantilla consume únicamente los campos que necesita.
El archivo de prueba usa compañías anonimizadas; los nombres reales se reciben solamente durante el renderizado desde Apps Script.

```json
{
  "period": "Mayo 2026",
  "operation": "Poderosa",
  "reportName": "Atenciones de Tracking",
  "comparison": {
    "previousPeriod": "Abril 2026",
    "previousTotal": 40,
    "variationPct": 15
  },
  "metrics": {
    "totalAttentions": 46,
    "uniqueVehicles": 42,
    "activeDays": 14,
    "peakDay": "04, 05, 06 y 12",
    "peakValue": 5,
    "distinctSupplies": 8
  },
  "daily": [{ "day": "01", "value": 0 }],
  "categories": [{ "name": "MANTENIMIENTO BÁSICO", "count": 22 }],
  "companies": [{ "name": "COMPAÑÍA A", "count": 6 }],
  "vehicleTypes": [{ "name": "CAMIONETA", "count": 17 }],
  "supplies": [{ "name": "CINTILLOS", "quantity": 103, "unit": "und", "uses": 27 }]
}
```

También se aceptan equivalentes en español como `periodo`, `categorias`, `companias`, `tiposVehiculo` e `insumos`.

## Ejecución local

```bash
npm install
npm start
```

Abrir `http://localhost:3000` para ver el inventario de endpoints.

## Despliegue en Render

1. Crear un nuevo **Blueprint** en Render.
2. Seleccionar este repositorio.
3. Render leerá `render.yaml` y creará el servicio.
4. Copiar el valor generado de `RENDER_API_KEY` a las propiedades de Apps Script.
5. Configurar en Apps Script la URL pública del servicio.

Los endpoints `/render/slideNN` requieren el encabezado `x-api-key` cuando `RENDER_API_KEY` está configurada.

## Estado del proyecto

- Motor visual inicial: listo.
- Contrato mensual y regla de Top 10: listos.
- Numeración alineada con la plantilla definitiva: lista (slides 10, 11, 12, 13, 15 y 17).
- Integración con Apps Script: siguiente etapa.
