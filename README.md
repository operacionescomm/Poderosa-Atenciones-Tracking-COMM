# Poderosa Atenciones Tracking · COMM

Motor visual para generar automáticamente el informe trimestral de soporte y tracking Poderosa.

## Arquitectura

Google Sheets → Apps Script → Render → Node/EJS → Puppeteer → PNG → Google Slides

## Diapositivas automatizadas

| Diapositiva PPT | Plantilla EJS |
| --- | --- |
| 10 | slide10.ejs |
| 11 | slide11.ejs |
| 12 | slide12.ejs |
| 13 | slide13.ejs |
| 14 | slide14.ejs |
| 15 | slide15.ejs |
| 16 | slide16.ejs |
| 18 | slide18.ejs |
| 20 | slide20.ejs |

La estructura fue migrada desde el reporte mensual hacia el nuevo reporte trimestral basado en la plantilla corporativa aprobada.

Los PNG mantienen formato 16:9 para inserción automática en Google Slides.

## Estado

- Migración de numeración mensual → trimestral realizada.
- Slides trimestrales incorporados: 10, 11, 12, 13, 14, 15, 16, 18 y 20.
- Slide 17 mensual retirado.
- Pendiente: ajuste fino de cada plantilla EJS con los gráficos y componentes visuales definitivos del PPT trimestral.
