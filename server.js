const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();

const PORT =
  process.env.PORT || 3000;

const APP_NAME =
  process.env.APP_NAME ||
  'Poderosa Tracking - Motor Trimestral';

const OPERATION_NAME =
  process.env.OPERATION_NAME ||
  'Poderosa Tracking';

const API_KEY =
  String(
    process.env.RENDER_API_KEY || ''
  ).trim();


/* =========================================================
   DATA DE PRUEBA TRIMESTRAL
   ========================================================= */

const sampleReport =
  require('./data/sample-quarterly-report.json');


/* =========================================================
   SLIDES DEL REPORTE TRIMESTRAL
   =========================================================

   IMPORTANTE:

   - Todos utilizan el MISMO header.
   - Ningún slide es "standalone".
   - Cada slide puede tener:
       eyebrow
       title
       subtitle

   El diseño del encabezado vive en:
   views/components/quarterly-header.ejs

   ========================================================= */

const SLIDES = [

  {
    number: '10',

    view: 'slide10',

    style: 'summary',

    eyebrow:
      'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Resumen ejecutivo del trimestre',

    subtitle:
      'Panorama operativo y puntos de atención gerencial'
  },


  {
    number: '11',

    view: 'slide11',

    style: 'daily',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Distribución por categoría de atención',

    subtitle:
      'Ocho categorías explican las atenciones del trimestre'
  },


  {
    number: '12',

    view: 'slide12',

    style: 'categories',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Evolución mensual de atenciones',

    subtitle:
      'Comparativo de atenciones durante los tres meses del periodo'
  },


  {
    number: '13',

    view: 'slide13',

    style: 'demand',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Compañias con mayor demanda de atención',

    subtitle:
      'Ranking trimestral y concentración de la carga operativa'
  },


  {
    number: '14',

    view: 'slide14',

    style: 'quarterly',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Vehículos con 3 o más atenciones',

    subtitle:
      'Unidades priorizadas para revisión de causa y seguimiento'
  },


  {
    number: '15',

    view: 'slide15',

    style: 'supplies',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Reincidencia de dispositivos',

    subtitle:
      'Distribución de las unidades únicas atendidas'
  },


  {
    number: '16',

    view: 'slide16',

    style: 'quarterly',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Cambio de cable USB-C: cantidad y participación',

    subtitle:
      'El volumen evoluciono de forma distinta'
  },


  {
    number: '18',

    view: 'slide18',

    style: 'quarterly',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Consumo trimestral de insumos',

    subtitle:
      'Se registraron diferentes tipos de insumos. El top 10 concentra la mayor cantidad acumulada.'
  },


  {
    number: '20',

    view: 'slide20',

    style: 'quarterly',

    eyebrow: 'INFORME TRIMESTRAL · TRACKING PODEROSA',

    title:
      'Conclusiones y acciones recomendadas',

    subtitle:
      'Prioridades propuestas para el siguiente ciclo de gestión'
  }

];


/* =========================================================
   EXPRESS
   ========================================================= */

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  '/public',
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

app.set(
  'view engine',
  'ejs'
);

app.set(
  'views',
  path.join(
    __dirname,
    'views'
  )
);


/* =========================================================
   HOME
   ========================================================= */

app.get(
  '/',
  (req, res) => {

    res.json({

      ok: true,

      service:
        APP_NAME,

      operation:
        OPERATION_NAME,

      reportType:
        'quarterly',

      resolution:
        '1600x900',

      slides:
        SLIDES.map(
          ({
            number,
            view,
            title,
            subtitle,
            eyebrow
          }) => ({
            number,
            view,
            eyebrow,
            title,
            subtitle
          })
        ),

      endpoints: {

        health:
          '/health',

        preview:
          SLIDES.map(
            slide =>
              `/test-slide${slide.number}`
          ),

        png:
          SLIDES.map(
            slide =>
              `/test-slide${slide.number}-png`
          ),

        render:
          SLIDES.map(
            slide =>
              `/render/slide${slide.number}`
          )

      }

    });

  }
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
  '/health',
  (req, res) => {

    res.json({

      ok: true,

      service:
        APP_NAME,

      operation:
        OPERATION_NAME,

      reportType:
        'quarterly',

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   API KEY
   ========================================================= */

function requireApiKey(
  req,
  res,
  next
) {

  /*
    Si Render no tiene una API key configurada,
    permite el acceso.
  */

  if (!API_KEY) {
    return next();
  }


  const provided =
    String(
      req.get('x-api-key') || ''
    ).trim();


  if (
    provided &&
    provided === API_KEY
  ) {

    return next();

  }


  return res
    .status(401)
    .json({

      ok: false,

      error:
        'No autorizado'

    });

}


/* =========================================================
   REGISTRAR ENDPOINTS DE LOS 9 SLIDES
   ========================================================= */

for (
  const slide
  of SLIDES
) {

  registerSlide(slide);

}


/* =========================================================
   ENDPOINTS POR SLIDE
   ========================================================= */

function registerSlide(
  slide
) {


  /* -------------------------------------------------------
     PREVIEW HTML
     ------------------------------------------------------- */

  app.get(
    `/test-slide${slide.number}`,
    (req, res) => {

      try {

        res.render(
          'report',
          buildSlideData(
            sampleReport,
            slide
          )
        );

      } catch (error) {

        console.error(
          `Error en test slide ${slide.number}:`,
          error
        );

        res
          .status(500)
          .send(
            String(error)
          );

      }

    }
  );


  /* -------------------------------------------------------
     PREVIEW PNG
     ------------------------------------------------------- */

  app.get(
    `/test-slide${slide.number}-png`,
    async (
      req,
      res
    ) => {

      try {

        const html =
          await renderEjsToString(
            'report',
            buildSlideData(
              sampleReport,
              slide
            )
          );


        const imageBuffer =
          await htmlToPng(
            html
          );


        res.setHeader(
          'Content-Type',
          'image/png'
        );


        res.setHeader(
          'Content-Length',
          imageBuffer.length
        );


        res.end(
          imageBuffer
        );

      } catch (error) {

        console.error(
          `Error generando PNG slide ${slide.number}:`,
          error
        );


        res
          .status(500)
          .send(
            String(error)
          );

      }

    }
  );


  /* -------------------------------------------------------
     RENDER DESDE APPS SCRIPT
     ------------------------------------------------------- */

  app.post(
    `/render/slide${slide.number}`,

    requireApiKey,

    async (
      req,
      res
    ) => {

      try {

        /*
          req.body será el JSON
          enviado por Apps Script.

          Allí llegará el periodo
          seleccionado desde Google Sheets.
        */

        const html =
          await renderEjsToString(

            'report',

            buildSlideData(
              req.body || {},
              slide
            )

          );


        const imageBuffer =
          await htmlToPng(
            html
          );


        res.setHeader(
          'Content-Type',
          'image/png'
        );


        res.setHeader(
          'Content-Length',
          imageBuffer.length
        );


        res.end(
          imageBuffer
        );

      } catch (error) {

        console.error(
          `Error renderizando slide ${slide.number}:`,
          error
        );


        res
          .status(500)
          .json({

            ok: false,

            error:
              String(error)

          });

      }

    }
  );

}


/* =========================================================
   CONSTRUIR DATA DEL SLIDE
   ========================================================= */

/* =========================================================
   SLIDE 20 · MOTOR DE CONCLUSIONES Y ACCIONES
   ========================================================= */

function buildSlide20Management(
  report
) {

  const metrics =
    report.metrics || {};


  const monthly =
    Array.isArray(
      report.monthlySeries
    )
      ? report.monthlySeries
      : [];


  const categories =
    Array.isArray(
      report.categories
    )
      ? report.categories
      : [];


  const companies =
    Array.isArray(
      report.companies
    )
      ? report.companies
      : [];


  const supplies =
    Array.isArray(
      report.supplies
    )
      ? report.supplies
      : [];


  const quarterly =
    report.quarterly || {};


  const totalAttentions =
    number(
      metrics.totalAttentions
    );


  const uniqueDevices =
    number(
      metrics.uniqueDevices ||
      metrics.uniqueVehicles
    );


  const reincidenceCount =
    number(
      metrics.reincidenceCount
    );


  /* =======================================================
     HELPERS LOCALES
     ======================================================= */

  function pct(
    part,
    total
  ) {

    return (
      total > 0

        ? (
            part /
            total
          ) * 100

        : 0
    );

  }


  function lowerFirst(
    value
  ) {

    const input =
      text(value);


    if (
      !input
    ) {

      return '';

    }


    return (
      input
        .charAt(0)
        .toLowerCase() +
      input.slice(1)
    );

  }


  /* =======================================================
     1. CAPACIDAD OPERATIVA
     ======================================================= */

  const firstMonth =
    monthly[0] || null;


  const lastMonth =
    monthly.length
      ? monthly[
          monthly.length - 1
        ]
      : null;


  let monthlyGrowth =
    null;


  if (
    firstMonth &&
    lastMonth &&
    number(firstMonth.value) > 0
  ) {

    monthlyGrowth =
      (
        (
          number(lastMonth.value) -
          number(firstMonth.value)
        ) /
        number(firstMonth.value)
      ) * 100;

  }


  const capacityScore =
    monthlyGrowth === null

      ? 0

      : (
          70 +
          Math.min(
            Math.abs(
              monthlyGrowth
            ) / 2,
            30
          )
        );


  const capacityBase =
    firstMonth &&
    lastMonth &&
    monthlyGrowth !== null

      ? (
          `Base: ${lastMonth.month} cerró con ` +
          `${formatNumber(lastMonth.value)} atenciones, ` +
          `${formatPct(Math.abs(monthlyGrowth))} ` +
          `${
            monthlyGrowth >= 0
              ? 'más'
              : 'menos'
          } que ${lowerFirst(firstMonth.month)}.`
        )

      : (
          `Base: Se registraron ` +
          `${formatNumber(totalAttentions)} atenciones en el trimestre.`
        );


  /* =======================================================
     2. CATEGORÍA / MANTENIMIENTO PREVENTIVO
     ======================================================= */

  const topCategory =
    categories[0] || {
      name: 'Sin datos',
      count: 0
    };


  const topCategoryShare =
    pct(
      number(
        topCategory.count
      ),
      totalAttentions
    );


  const maintenanceScore =
    topCategory.count > 0

      ? (
          75 +
          Math.min(
            topCategoryShare / 2,
            20
          )
        )

      : 0;


  const maintenanceBase =
    topCategory.count > 0

      ? (
          `Base: ${topCategory.name} concentra ` +
          `${formatPct(topCategoryShare)} del trimestre.`
        )

      : 'Base: Sin información suficiente de categorías.';


  /* =======================================================
     3. REINCIDENCIA
     ======================================================= */

  const recurrenceShare =
    pct(
      reincidenceCount,
      uniqueDevices
    );


  const recurrenceScore =
    reincidenceCount > 0

      ? (
          78 +
          Math.min(
            recurrenceShare,
            10
          )
        )

      : 0;


  const recurrenceBase =
    reincidenceCount > 0

      ? (
          `Base: ${formatNumber(reincidenceCount)} ` +
          `${
            reincidenceCount === 1
              ? 'vehículo registró'
              : 'vehículos registraron'
          } 3 o más atenciones.`
        )

      : 'Base: No se registraron vehículos con 3 o más atenciones.';


  /* =======================================================
     4. USB-C
     ======================================================= */

  const usbCategory =
    categories.find(
      item =>
        /USB[\s-]*C/i.test(
          item.name
        )
    ) || null;


  const usbMonthlyRaw =
    Array.isArray(
      quarterly.usbCMonthly
    )

      ? quarterly.usbCMonthly

      : (
          Array.isArray(
            quarterly.usbMonthly
          )

            ? quarterly.usbMonthly

            : (
                Array.isArray(
                  quarterly.cambioUsbCMonthly
                )

                  ? quarterly.cambioUsbCMonthly

                  : []
              )
        );


  const usbMonthly =
    usbMonthlyRaw.map(
      item => ({

        month:
          text(
            item.month ||
            item.mes
          ),

        value:
          number(
            item.value ??
            item.count ??
            item.cantidad ??
            item.casos
          )

      })
    );


  const usbTotal =
    usbMonthly.length

      ? usbMonthly.reduce(
          (
            total,
            item
          ) =>
            total +
            item.value,
          0
        )

      : (
          usbCategory
            ? number(
                usbCategory.count
              )
            : 0
        );


  const usbQuarterShare =
    pct(
      usbTotal,
      totalAttentions
    );


  let usbLastShare =
    usbQuarterShare;


  let usbPreviousShare =
    null;


  if (
    usbMonthly.length >= 2 &&
    monthly.length >= 2
  ) {

    const lastIndex =
      Math.min(
        usbMonthly.length,
        monthly.length
      ) - 1;


    const previousIndex =
      lastIndex - 1;


    const lastTotal =
      number(
        monthly[lastIndex].value
      );


    const previousTotal =
      number(
        monthly[previousIndex].value
      );


    usbLastShare =
      pct(
        usbMonthly[lastIndex].value,
        lastTotal
      );


    usbPreviousShare =
      pct(
        usbMonthly[previousIndex].value,
        previousTotal
      );

  }


  const usbScore =
    usbTotal > 0

      ? (
          70 +
          Math.min(
            usbTotal / 5,
            12
          ) +
          Math.min(
            usbLastShare / 5,
            6
          )
        )

      : 0;


  let usbBase;


  if (
    usbTotal <= 0
  ) {

    usbBase =
      'Base: No se registraron casos USB-C en el trimestre.';

  } else if (
    usbPreviousShare !== null &&
    lastMonth
  ) {

    const direction =
      usbLastShare <
      usbPreviousShare

        ? 'bajó'

        : (
            usbLastShare >
            usbPreviousShare

              ? 'subió'

              : 'se mantuvo'
          );


    usbBase =
      `Base: La participación ${direction} a ` +
      `${formatPct(usbLastShare)} en ` +
      `${lowerFirst(lastMonth.month)}; ` +
      `acumuló ${formatNumber(usbTotal)} casos.`;

  } else {

    usbBase =
      `Base: USB-C acumuló ` +
      `${formatNumber(usbTotal)} casos, ` +
      `${formatPct(usbQuarterShare)} del trimestre.`;

  }


  /* =======================================================
     5. CONCENTRACIÓN DE DEMANDA
     ======================================================= */

  const demandShare =
    number(
      metrics.demandShare
    );


  const demandScore =
    companies.length

      ? (
          55 +
          Math.min(
            demandShare / 10,
            8
          )
        )

      : 0;


  const demandBase =
    companies.length

      ? (
          `Base: Las principales compañías concentran ` +
          `${formatPct(demandShare)} de las atenciones.`
        )

      : 'Base: Sin información suficiente de compañías.';


  /* =======================================================
     6. GESTIÓN DE INSUMOS
     ======================================================= */

  const topSupply =
    supplies[0] || null;


  const top10SupplyQuantity =
    supplies.reduce(
      (
        total,
        item
      ) =>
        total +
        number(
          item.quantity
        ),
      0
    );


  const supplyDominance =
    topSupply

      ? pct(
          number(
            topSupply.quantity
          ),
          top10SupplyQuantity
        )

      : 0;


  const supplyScore =
    topSupply &&
    number(topSupply.quantity) > 0

      ? (
          48 +
          Math.min(
            supplyDominance / 8,
            12
          )
        )

      : 0;


  const supplyBase =
    topSupply

      ? (
          `Base: ${topSupply.name} registró ` +
          `${formatNumber(topSupply.quantity)} ` +
          `${topSupply.unit || 'unidades'} utilizadas.`
        )

      : 'Base: Sin información suficiente de consumo de insumos.';


  /* =======================================================
     CANDIDATOS
     ======================================================= */

  const candidates = [

    {
      key:
        'capacity',

      label:
        'CAPACIDAD OPERATIVA',

      action:
        monthlyGrowth !== null &&
        monthlyGrowth < 0

          ? 'Ajustar la programación al nivel de demanda observado.'

          : 'Ajustar la programación al mayor nivel observado.',

      base:
        capacityBase,

      score:
        capacityScore,

      tone:
        'blue'
    },


    {
      key:
        'maintenance',

      label:
        'MANTENIMIENTO PREVENTIVO',

      action:
        'Programar rondas preventivas sobre la principal causa de atención.',

      base:
        maintenanceBase,

      score:
        maintenanceScore,

      tone:
        'teal'
    },


    {
      key:
        'recurrence',

      label:
        'RECURRENCIA FOCALIZADA',

      action:
        'Revisar causa, instalación y entorno de las unidades reincidentes.',

      base:
        recurrenceBase,

      score:
        recurrenceScore,

      tone:
        'orange'
    },


    {
      key:
        'usb',

      label:
        'CONTROL USB-C',

      action:
        'Mantener el seguimiento del indicador y disponibilidad de repuestos.',

      base:
        usbBase,

      score:
        usbScore,

      tone:
        'purple'
    },


    {
      key:
        'demand',

      label:
        'CONCENTRACIÓN DE DEMANDA',

      action:
        'Priorizar coordinación preventiva con las compañías de mayor demanda.',

      base:
        demandBase,

      score:
        demandScore,

      tone:
        'cyan'
    },


    {
      key:
        'supplies',

      label:
        'GESTIÓN DE INSUMOS',

      action:
        'Asegurar disponibilidad preventiva de los insumos de mayor rotación.',

      base:
        supplyBase,

      score:
        supplyScore,

      tone:
        'navy'
    }

  ];


  /* =======================================================
     SELECCIONAR LAS 4 PRIORIDADES MÁS RELEVANTES
     ======================================================= */

  const priorities =
    candidates

      .filter(
        item =>
          item.score > 0
      )

      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      )

      .slice(
        0,
        4
      )

      .map(
        (
          item,
          index
        ) => ({

          ...item,

          number:
            index + 1

        })
      );


  /* =======================================================
     ENFOQUE DEL PRÓXIMO TRIMESTRE
     ======================================================= */

  const focusFragments = {

    capacity:
      'asegurar capacidad frente a los niveles de mayor demanda',

    maintenance:
      'reforzar el mantenimiento preventivo',

    recurrence:
      'prevenir la repetición de atenciones',

    usb:
      'mantener control visible sobre USB-C',

    demand:
      'focalizar la gestión en las compañías de mayor demanda',

    supplies:
      'asegurar disponibilidad de insumos críticos'

  };


  const fragments =
    priorities
      .map(
        item =>
          focusFragments[
            item.key
          ]
      )
      .filter(
        Boolean
      );


  let focusText =
    'Mantener seguimiento de los principales indicadores operativos.';


  if (
    fragments.length === 1
  ) {

    focusText =
      fragments[0];

  }


  if (
    fragments.length === 2
  ) {

    focusText =
      `${fragments[0]} y ${fragments[1]}`;

  }


  if (
    fragments.length >= 3
  ) {

    focusText =
      `${
        fragments
          .slice(
            0,
            -1
          )
          .join(', ')
      } y ${
        fragments[
          fragments.length - 1
        ]
      }`;

  }


  focusText =
    focusText
      .charAt(0)
      .toUpperCase() +
    focusText.slice(1) +
    '.';


  /* =======================================================
     RESULTADO
     ======================================================= */

  return {

    priorities,

    focusTitle:
      'Enfoque del próximo trimestre',

    focusText

  };

}

function buildSlideData(
  raw,
  slide
) {

  const report =
    normalizeReportData(
      raw
    );


  /* =======================================================
     MOTOR GERENCIAL · SOLO PARA SLIDE 20
     ======================================================= */

  const management =
    slide.number === '20'

      ? buildSlide20Management(
          report
        )

      : null;


  return {

    /*
      Toda la información del reporte
      normalizado.
    */

    ...report,


    /*
      Conclusiones y recomendaciones
      automáticas del slide 20.
    */

    management,


    /*
      Plantilla EJS específica.
    */

    viewName:
      slide.view,


    /*
      Clase CSS específica.
    */

    viewClass:
      slide.style,


    /*
      Número lógico del slide.
    */

    slideNumber:
      slide.number,


    /*
      HEADER COMPARTIDO
    */

    slideEyebrow:
      slide.eyebrow || '',


    slideTitle:
      slide.title || '',


    slideSubtitle:
      slide.subtitle || '',


    /*
      Helpers disponibles
      dentro de los EJS.
    */

    formatNumber,

    formatPct,

    truncate

  };

}


/* =========================================================
   NORMALIZACIÓN DEL JSON TRIMESTRAL
   ========================================================= */

function normalizeReportData(
  raw = {}
) {


  /* -------------------------------------------------------
     INFORMACIÓN GENERAL
     ------------------------------------------------------- */

  const period =
    text(
      raw.period ||
      raw.periodo ||
      'MAYO-JUNIO-JULIO 2026'
    );


  const operation =
    text(
      raw.operation ||
      raw.operacion ||
      'Poderosa'
    );


  const reportName =
    text(
      raw.reportName ||
      raw.nombreInforme ||
      'Atenciones de Tracking'
    );


  const metricsRaw =
    raw.metrics ||
    raw.indicadores ||
    {};


  /* -------------------------------------------------------
     SERIE DIARIA
     ------------------------------------------------------- */

  const daily =
    array(
      raw.daily ||
      raw.dias
    )
      .map(
        (
          item,
          index
        ) => ({

          day:
            text(
              item.day ||
              item.dia ||
              String(
                index + 1
              ).padStart(
                2,
                '0'
              )
            ),

          value:
            number(
              item.value ??
              item.atenciones ??
              item.cantidad
            )

        })
      );


  /* -------------------------------------------------------
     CATEGORÍAS
     ------------------------------------------------------- */

  const categories =
    array(
      raw.categories ||
      raw.categorias
    )
      .map(
        item => ({

          name:
            text(
              item.name ||
              item.nombre ||
              item.categoria ||
              'SIN CATEGORÍA'
            ),

          count:
            number(
              item.count ??
              item.atenciones ??
              item.cantidad
            )

        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      );


  /* -------------------------------------------------------
     COMPAÑÍAS
     ------------------------------------------------------- */

  const allCompanies =
    array(
      raw.companies ||
      raw.companias
    )
      .map(
        item => ({

          name:
            text(
              item.name ||
              item.nombre ||
              item.compania ||
              'SIN COMPAÑÍA'
            ),

          count:
            number(
              item.count ??
              item.atenciones ??
              item.cantidad
            )

        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      );


  /*
    Los gráficos pueden utilizar
    hasta las 10 principales.
  */

  const companies =
    allCompanies.slice(
      0,
      10
    );


  /* -------------------------------------------------------
     TIPOS DE VEHÍCULO
     ------------------------------------------------------- */

  const vehicleTypes =
    array(
      raw.vehicleTypes ||
      raw.tiposVehiculo
    )
      .map(
        item => ({

          name:
            text(
              item.name ||
              item.nombre ||
              item.tipo ||
              'SIN TIPO'
            ),

          count:
            number(
              item.count ??
              item.atenciones ??
              item.cantidad
            )

        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      );


  /* -------------------------------------------------------
     INSUMOS
     ------------------------------------------------------- */

  const allSupplies =
    array(
      raw.supplies ||
      raw.insumos
    )
      .map(
        item => ({

          name:
            text(
              item.name ||
              item.nombre ||
              item.insumo ||
              'SIN INSUMO'
            ),

          quantity:
            number(
              item.quantity ??
              item.cantidad
            ),

          unit:
            text(
              item.unit ||
              item.unidad ||
              ''
            ),

          uses:
            number(
              item.uses ??
              item.usos ??
              item.frecuencia
            )

        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.quantity -
          a.quantity
      );


  const supplies =
    allSupplies.slice(
      0,
      10
    );


  /* -------------------------------------------------------
     SERIE MENSUAL
     ------------------------------------------------------- */

  const monthlySeries =
    array(
      raw.monthlySeries ||
      raw.serieMensual ||
      raw.meses
    )
      .map(
        item => ({

          month:
            text(
              item.month ||
              item.mes ||
              item.name ||
              item.nombre
            ),

          value:
            number(
              item.value ??
              item.atenciones ??
              item.cantidad
            )

        })
      );


  /* -------------------------------------------------------
     SERIE SEMANAL
     ------------------------------------------------------- */

  const weeklySeries =
    array(
      raw.weeklySeries ||
      raw.serieSemanal ||
      raw.semanas
    )
      .map(
        item => ({

          week:
            text(
              item.week ||
              item.semana ||
              item.name ||
              item.nombre
            ),

          value:
            number(
              item.value ??
              item.atenciones ??
              item.cantidad
            )

        })
      );


  /* =======================================================
     INDICADORES
     ======================================================= */


  /* -------------------------------------------------------
     ATENCIONES TOTALES
     ------------------------------------------------------- */

  const totalAttentionsFallback =
    categories.length

      ? sum(
          categories,
          'count'
        )

      : sum(
          monthlySeries,
          'value'
        );


  const totalAttentions =
    number(

      metricsRaw.totalAttentions ??

      metricsRaw.totalAtenciones ??

      raw.totalAtenciones ??

      totalAttentionsFallback

    );


  /* -------------------------------------------------------
     VEHÍCULOS / DISPOSITIVOS
     ------------------------------------------------------- */

  const uniqueVehicles =
    number(

      metricsRaw.uniqueVehicles ??

      metricsRaw.vehiculosUnicos ??

      metricsRaw.uniqueDevices ??

      metricsRaw.dispositivosUnicos ??

      raw.vehiculosUnicos

    );


  const uniqueDevices =
    number(

      metricsRaw.uniqueDevices ??

      metricsRaw.devicesCount ??

      metricsRaw.dispositivosUnicos ??

      uniqueVehicles

    );


  /* -------------------------------------------------------
     PROMEDIO SEMANAL
     ------------------------------------------------------- */

  const weeklyAverageFallback =
    weeklySeries.length

      ? (
          sum(
            weeklySeries,
            'value'
          ) /
          weeklySeries.length
        )

      : (
          totalAttentions
            ? totalAttentions /
              13.142857
            : 0
        );


  const weeklyAverage =
    number(

      metricsRaw.weeklyAverage ??

      metricsRaw.averagePerWeek ??

      metricsRaw.promedioSemanal ??

      weeklyAverageFallback

    );


  /* -------------------------------------------------------
     COMPAÑÍAS
     ------------------------------------------------------- */

  const companiesCount =
    number(

      metricsRaw.companiesCount ??

      metricsRaw.companyCount ??

      metricsRaw.companiasAtendidas ??

      raw.companiesCount ??

      allCompanies.length

    );


  /* -------------------------------------------------------
     REINCIDENCIA
     ------------------------------------------------------- */

  const reincidenceCount =
    number(

      metricsRaw.reincidenceCount ??

      metricsRaw.reincidencia ??

      metricsRaw.vehiculosReincidentes ??

      raw.reincidenceCount

    );


  /* -------------------------------------------------------
     DÍAS ACTIVOS
     ------------------------------------------------------- */

  const activeDays =
    number(

      metricsRaw.activeDays ??

      metricsRaw.diasConAtencion ??

      daily.filter(
        x =>
          x.value > 0
      ).length

    );


  /* -------------------------------------------------------
     PICO DIARIO
     ------------------------------------------------------- */

  const peakValue =
    number(

      metricsRaw.peakValue ??

      metricsRaw.maximoDiario ??

      Math.max(
        0,
        ...daily.map(
          x =>
            x.value
        )
      )

    );


  const peakDay =
    text(

      metricsRaw.peakDay ||

      metricsRaw.diaPico ||

      daily
        .filter(
          x =>
            x.value ===
              peakValue &&
            peakValue > 0
        )
        .map(
          x =>
            x.day
        )
        .join(', ')

    );


  /* -------------------------------------------------------
     INSUMOS DIFERENTES
     ------------------------------------------------------- */

  const distinctSupplies =
    number(

      metricsRaw.distinctSupplies ??

      metricsRaw.insumosDistintos ??

      allSupplies.length

    );


  /* =======================================================
     COMPARACIÓN ENTRE MESES
     ======================================================= */

  const comparisonRaw =
    raw.comparison ||
    raw.comparacion ||
    {};


  const previousTotalValue =

    comparisonRaw.previousTotal ??

    comparisonRaw.totalAnterior;


  const previousTotal =

    previousTotalValue === null ||

    previousTotalValue === undefined ||

    previousTotalValue === ''

      ? null

      : number(
          previousTotalValue
        );


  const currentTotalValue =

    comparisonRaw.currentTotal ??

    comparisonRaw.totalActual;


  const currentTotal =

    currentTotalValue === null ||

    currentTotalValue === undefined ||

    currentTotalValue === ''

      ? null

      : number(
          currentTotalValue
        );


  let variationPct =

    comparisonRaw.variationPct ??

    comparisonRaw.variacionPct;


  if (
    variationPct === null ||

    variationPct === undefined ||

    variationPct === ''
  ) {

    variationPct =

      previousTotal > 0 &&

      currentTotal !== null

        ? (
            (
              currentTotal -
              previousTotal
            ) /
            previousTotal
          ) * 100

        : null;

  }


  variationPct =

    variationPct === null

      ? null

      : number(
          variationPct
        );


  /* =======================================================
     MÁXIMOS Y TOTALES
     ======================================================= */

  const dailyMax =
    Math.max(
      1,
      ...daily.map(
        x =>
          x.value
      )
    );


  const dailyAverage =

    daily.length

      ? (
          sum(
            daily,
            'value'
          ) /
          daily.length
        )

      : 0;


  const categoryMax =
    Math.max(
      1,
      ...categories.map(
        x =>
          x.count
      )
    );


  const companyMax =
    Math.max(
      1,
      ...companies.map(
        x =>
          x.count
      )
    );


  const supplyMax =
    Math.max(
      1,
      ...supplies.map(
        x =>
          x.quantity
      )
    );


  const vehicleTotal =
    sum(
      vehicleTypes,
      'count'
    );


  /* =======================================================
     PALETA
     ======================================================= */

  const palette = [

    '#0b63ce',

    '#12a6b1',

    '#ff7a00',

    '#7c3aed',

    '#2f8f61',

    '#e5484d',

    '#6b7a90',

    '#0ea5e9',

    '#f59e0b',

    '#14b8a6'

  ];


  /* =======================================================
     PREPARAR CATEGORÍAS
     ======================================================= */

  categories.forEach(
    (
      item,
      index
    ) => {

      item.share =
        totalAttentions

          ? (
              item.count /
              totalAttentions
            ) * 100

          : 0;


      item.width =
        (
          item.count /
          categoryMax
        ) * 100;


      item.color =
        palette[
          index %
          palette.length
        ];

    }
  );


  /* =======================================================
     PREPARAR COMPAÑÍAS
     ======================================================= */

  companies.forEach(
    (
      item,
      index
    ) => {

      item.share =
        totalAttentions

          ? (
              item.count /
              totalAttentions
            ) * 100

          : 0;


      item.width =
        (
          item.count /
          companyMax
        ) * 100;


      item.color =
        palette[
          index %
          palette.length
        ];

    }
  );


  /* =======================================================
     PREPARAR INSUMOS
     ======================================================= */

  supplies.forEach(
    (
      item,
      index
    ) => {

      item.width =
        (
          item.quantity /
          supplyMax
        ) * 100;


      item.color =
        palette[
          index %
          palette.length
        ];

    }
  );


  /* =======================================================
     PREPARAR DÍAS
     ======================================================= */

  daily.forEach(
    item => {

      item.height =
        (
          item.value /
          dailyMax
        ) * 100;


      item.isPeak =

        item.value ===
          peakValue &&

        peakValue > 0;

    }
  );


  /* =======================================================
     PREPARAR VEHÍCULOS
     ======================================================= */

  vehicleTypes.forEach(
    (
      item,
      index
    ) => {

      item.share =
        vehicleTotal

          ? (
              item.count /
              vehicleTotal
            ) * 100

          : 0;


      item.color =
        palette[
          index %
          palette.length
        ];

    }
  );


  /* =======================================================
     PRINCIPALES
     ======================================================= */

  const topCategory =

    categories[0] ||

    {
      name:
        'Sin datos',

      count:
        0,

      share:
        0
    };


  const topCompany =

    companies[0] ||

    {
      name:
        'Sin datos',

      count:
        0,

      share:
        0
    };


  const topSupply =

    supplies[0] ||

    {
      name:
        'Sin datos',

      quantity:
        0,

      unit:
        ''
    };


  /* =======================================================
     TOP 2 CATEGORÍAS
     ======================================================= */

  const top2CategoryCount =

    categories
      .slice(
        0,
        2
      )
      .reduce(
        (
          acc,
          item
        ) =>
          acc +
          item.count,

        0
      );


  /* =======================================================
     TOP 10 COMPAÑÍAS
     ======================================================= */

  const top10CompaniesCount =

    companies
      .slice(
        0,
        10
      )
      .reduce(
        (
          acc,
          item
        ) =>
          acc +
          item.count,

        0
      );


  /* =======================================================
     CONCENTRACIÓN POR CATEGORÍA
     ======================================================= */

  const categoryConcentrationShare =
    number(

      metricsRaw.categoryConcentrationShare ??

      metricsRaw.concentracionCategoria ??

      metricsRaw.topCategoryShare ??

      (
        totalAttentions

          ? (
              top2CategoryCount /
              totalAttentions
            ) * 100

          : 0
      )

    );


  const categoryConcentrationLabel =
    text(

      metricsRaw.categoryConcentrationLabel ??

      metricsRaw.etiquetaConcentracionCategoria ??

      metricsRaw.topCategoryLabel ??

      (
        categories.length >= 2

          ? `${categories[0].name} y ${categories[1].name}`

          : topCategory.name
      )

    );


  /* =======================================================
     CONCENTRACIÓN DE DEMANDA
     ======================================================= */

  const demandShare =
    number(

      metricsRaw.demandShare ??

      metricsRaw.topCompaniesShare ??

      metricsRaw.concentracionDemanda ??

      (
        totalAttentions

          ? (
              top10CompaniesCount /
              totalAttentions
            ) * 100

          : 0
      )

    );


  const topCompaniesTopN =
    number(

      metricsRaw.topCompaniesTopN ??

      metricsRaw.topCompaniasN ??

      Math.min(
        10,
        companies.length
      )

    );


  const topCompaniesAttentions =
    number(

      metricsRaw.topCompaniesAttentions ??

      metricsRaw.atencionesTopCompanias ??

      top10CompaniesCount

    );


  /* =======================================================
     PERIODO DINÁMICO
     =======================================================

     Este valor será enviado por Apps Script.

     Ejemplo:

     MAYO-JUNIO-JULIO 2026

     o

     AGOSTO-SEPTIEMBRE-OCTUBRE 2026

     ======================================================= */

  const periodLabel =
    text(

      metricsRaw.periodLabel ??

      metricsRaw.periodoTrimestral ??

      raw.periodLabel ??

      period

    );


  /* =======================================================
     LECTURA EJECUTIVA
     ======================================================= */

  const executiveTitle =
    text(

      metricsRaw.executiveTitle ??

      metricsRaw.tituloEjecutivo ??

      raw.executiveTitle

    );


  const executiveBody =
    text(

      metricsRaw.executiveBody ??

      metricsRaw.lecturaEjecutiva ??

      raw.executiveBody

    );


  /* =======================================================
     FOOTER
     ======================================================= */

  const sourceLabel =
    text(

      metricsRaw.sourceLabel ??

      metricsRaw.fuente ??

      raw.sourceLabel ??

      'Fuente: Reporte Trimestral y Registros - SOPORTE DE TRACKING_PODEROSA'

    );


  const footerCenter =
    text(

      metricsRaw.footerCenter ??

      metricsRaw.pieCentro ??

      raw.footerCenter ??

      'Poderosa - Atenciones de Tracking'

    );


  /* =======================================================
     INSIGHTS
     ======================================================= */

  const insights =
    array(
      raw.insights ||
      raw.hallazgos
    );


  const normalizedInsights =

    insights.length

      ? insights.map(
          item => ({

            title:
              text(
                item.title ||
                item.titulo
              ),

            text:
              text(
                item.text ||
                item.descripcion
              ),

            tone:
              text(
                item.tone ||
                item.tono ||
                'blue'
              )

          })
        )

      : [];


  /* =======================================================
     ACCIONES
     ======================================================= */

  const actions =
    array(
      raw.actions ||
      raw.acciones
    );


  const normalizedActions =
    actions.map(
      item =>
        text(
          item.text ||
          item.descripcion ||
          item
        )
    );


  /* =======================================================
     OBJETO FINAL
     ======================================================= */

  return {

    period,

    operation,

    reportName,

    generatedAt:
      text(
        raw.generatedAt ||
        raw.fechaGeneracion ||
        ''
      ),


    metrics: {

      totalAttentions,

      uniqueVehicles,

      uniqueDevices,

      weeklyAverage,

      companiesCount,

      reincidenceCount,

      activeDays,

      peakDay,

      peakValue,

      distinctSupplies,

      categoryConcentrationShare,

      categoryConcentrationLabel,

      demandShare,

      topCompaniesTopN,

      topCompaniesAttentions,

      periodLabel,

      executiveTitle,

      executiveBody,

      sourceLabel,

      footerCenter

    },


    comparison: {

      previousPeriod:
        text(

          comparisonRaw.previousPeriod ||

          comparisonRaw.periodoAnterior ||

          'Periodo anterior'

        ),

      previousTotal,

      currentTotal,

      variationPct,

      label:

        variationPct === null

          ? 'Sin base de comparación'

          : `${
              variationPct >= 0
                ? '+'
                : ''
            }${formatPct(
              variationPct
            )}`,

      tone:

        variationPct === null

          ? 'neutral'

          : variationPct <= 0

            ? 'good'

            : 'alert'

    },


    monthlySeries,

    weeklySeries,

    daily,


    dailyAverage,


    dailyAverageHeight:
      Math.min(

        100,

        (
          dailyAverage /
          dailyMax
        ) * 100

      ),


    categories,


    companies,


    allCompanies,


    vehicleTypes,


    vehicleTotal,


    vehicleGradient:
      conicGradient(
        vehicleTypes
      ),


    supplies,


    allSupplyCount:
      allSupplies.length,


    supplyHeading:

      allSupplies.length > 10

        ? `TOP 10 INSUMOS MÁS UTILIZADOS | ${period.toUpperCase()}`

        : `INSUMOS UTILIZADOS | ${period.toUpperCase()}`,


    topCategory,


    topCompany,


    topSupply,


    insights:
      normalizedInsights,


    actions:
      normalizedActions,


    quarterly:

      raw.quarterly ||

      raw.trimestral ||

      {}

  };

}


/* =========================================================
   CONIC GRADIENT
   ========================================================= */

function conicGradient(
  items
) {

  if (
    !items.length
  ) {

    return (
      'conic-gradient(#dbe5f2 0 100%)'
    );

  }


  let cursor = 0;

  const stops = [];


  for (
    const item
    of items
  ) {

    const end =

      cursor +
      item.share;


    stops.push(

      `${item.color} ` +
      `${cursor.toFixed(2)}% ` +
      `${end.toFixed(2)}%`

    );


    cursor =
      end;

  }


  return (
    `conic-gradient(${stops.join(', ')})`
  );

}


/* =========================================================
   HELPERS
   ========================================================= */

function array(
  value
) {

  return (
    Array.isArray(
      value
    )

      ? value

      : []
  );

}


function text(
  value
) {

  return String(
    value ?? ''
  ).trim();

}


function number(
  value
) {

  if (
    typeof value ===
    'number'
  ) {

    return (
      Number.isFinite(
        value
      )

        ? value

        : 0
    );

  }


  const normalized =
    String(
      value ?? ''
    )
      .trim()
      .replace(
        /\s/g,
        ''
      )
      .replace(
        /\.(?=\d{3}(?:\D|$))/g,
        ''
      )
      .replace(
        ',',
        '.'
      );


  const parsed =
    Number(
      normalized.replace(
        '%',
        ''
      )
    );


  return (
    Number.isFinite(
      parsed
    )

      ? parsed

      : 0
  );

}


function sum(
  items,
  key
) {

  return items.reduce(

    (
      acc,
      item
    ) =>

      acc +
      number(
        item[key]
      ),

    0

  );

}


function formatNumber(
  value,
  decimals = 0
) {

  return new Intl
    .NumberFormat(
      'es-PE',
      {

        minimumFractionDigits:
          decimals,

        maximumFractionDigits:
          decimals

      }
    )
    .format(
      number(
        value
      )
    );

}


function formatPct(
  value
) {

  return `${
    new Intl
      .NumberFormat(
        'es-PE',
        {

          minimumFractionDigits:
            1,

          maximumFractionDigits:
            1

        }
      )
      .format(
        number(
          value
        )
      )
  }%`;

}


function truncate(
  value,
  max = 38
) {

  const input =
    text(
      value
    );


  return (

    input.length <=
    max

      ? input

      : `${
          input
            .slice(
              0,
              max - 1
            )
            .trim()
        }…`

  );

}


/* =========================================================
   EJS → HTML
   ========================================================= */

function renderEjsToString(
  viewName,
  data
) {

  return new Promise(

    (
      resolve,
      reject
    ) => {

      app.render(

        viewName,

        data,

        (
          error,
          html
        ) =>

          error

            ? reject(
                error
              )

            : resolve(
                html
              )

      );

    }

  );

}


/* =========================================================
   PUPPETEER
   ========================================================= */

let browserPromise =
  null;


async function getBrowser() {

  if (
    !browserPromise
  ) {

    const launchOptions = {

      headless:
        true,

      protocolTimeout:
        300000,

      timeout:
        120000,

      args: [

        '--no-sandbox',

        '--disable-setuid-sandbox',

        '--disable-dev-shm-usage',

        '--disable-gpu',

        '--disable-software-rasterizer'

      ]

    };


    const localChromePath =
      getLocalChromePath();


    if (
      localChromePath
    ) {

      launchOptions.executablePath =
        localChromePath;

    }


    browserPromise =

      puppeteer
        .launch(
          launchOptions
        )
        .catch(
          error => {

            browserPromise =
              null;

            throw error;

          }
        );

  }


  return (
    browserPromise
  );

}


/* =========================================================
   CHROME PATH
   ========================================================= */

function getLocalChromePath() {

  const headlessShellPath =
    findHeadlessShellPath();


  const candidates = [

    process.env
      .PUPPETEER_EXECUTABLE_PATH,

    process.env
      .CHROME_BIN,

    headlessShellPath,

    '/usr/bin/google-chrome-stable',

    '/usr/bin/google-chrome',

    '/usr/bin/chromium',

    '/usr/bin/chromium-browser'

  ].filter(
    Boolean
  );


  return (
    candidates.find(
      candidate =>
        fs.existsSync(
          candidate
        )
    )
  );

}


/* =========================================================
   HEADLESS SHELL
   ========================================================= */

function findHeadlessShellPath() {

  const cacheRoot =

    process.env
      .PUPPETEER_CACHE_DIR ||

    '/opt/render/.cache/puppeteer';


  const shellRoot =
    path.join(

      cacheRoot,

      'chrome-headless-shell'

    );


  if (
    !fs.existsSync(
      shellRoot
    )
  ) {

    return null;

  }


  const versions =
    fs
      .readdirSync(
        shellRoot
      )
      .sort()
      .reverse();


  for (
    const version
    of versions
  ) {

    const candidate =
      path.join(

        shellRoot,

        version,

        'chrome-headless-shell-linux64',

        'chrome-headless-shell'

      );


    if (
      fs.existsSync(
        candidate
      )
    ) {

      return candidate;

    }

  }


  return null;

}


/* =========================================================
   HTML → PNG
   ========================================================= */

async function htmlToPng(
  html
) {

  let lastError;


  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {

    try {

      return await captureHtmlToPng(
        html
      );

    } catch (error) {

      lastError =
        error;


      console.warn(

        `Intento ${attempt} de PNG fallido; reiniciando Chrome:`,

        error.message

      );


      await resetBrowser();

    }

  }


  throw lastError;

}


/* =========================================================
   CAPTURA 1600 × 900
   ========================================================= */

async function captureHtmlToPng(
  html
) {

  const browser =
    await getBrowser();


  const page =
    await browser
      .newPage();


  try {

    await page
      .setViewport({

        width:
          1600,

        height:
          900,

        deviceScaleFactor:
          2

      });


    await page
      .setContent(

        html,

        {

          waitUntil:
            'domcontentloaded',

          timeout:
            120000

        }

      );


    /*
      CSS anterior.

      Se conserva temporalmente porque
      algunos slides todavía utilizan
      componentes existentes.
    */

    const legacyStylePath =
      path.join(

        __dirname,

        'public',

        'styles.css'

      );


    if (
      fs.existsSync(
        legacyStylePath
      )
    ) {

      await page
        .addStyleTag({

          path:
            legacyStylePath

        });

    }


    /*
      CSS del nuevo reporte trimestral.

      Se carga DESPUÉS para que tenga
      prioridad sobre los estilos antiguos.
    */

    const quarterlyStylePath =
      path.join(

        __dirname,

        'public',

        'quarterly.css'

      );


    if (
      fs.existsSync(
        quarterlyStylePath
      )
    ) {

      await page
        .addStyleTag({

          path:
            quarterlyStylePath

        });

    }


    /*
      Esperar fuentes.
    */

    await page
      .evaluate(

        () =>
          document.fonts &&
          document.fonts.ready

      );


    /*
      Capturar únicamente
      1600 × 900.
    */

    return Buffer.from(

      await page
        .screenshot({

          type:
            'png',

          fullPage:
            false,

          omitBackground:
            false

        })

    );

  } finally {

    await page
      .close()
      .catch(
        () => {}
      );

  }

}


/* =========================================================
   REINICIAR CHROME
   ========================================================= */

async function resetBrowser() {

  const currentBrowser =
    browserPromise;


  browserPromise =
    null;


  if (
    !currentBrowser
  ) {

    return;

  }


  try {

    const browser =
      await currentBrowser;


    await browser
      .close();

  } catch (error) {

    console.warn(

      'No se pudo cerrar Chrome limpiamente:',

      error.message

    );

  }

}


/* =========================================================
   CERRAR CHROME
   ========================================================= */

async function closeBrowser() {

  if (
    !browserPromise
  ) {

    return;

  }


  try {

    const browser =
      await browserPromise;


    await browser
      .close();

  } finally {

    browserPromise =
      null;

  }

}


/* =========================================================
   CIERRE LIMPIO
   ========================================================= */

process.on(
  'SIGTERM',
  async () => {

    await closeBrowser();

    process.exit(
      0
    );

  }
);


process.on(
  'SIGINT',
  async () => {

    await closeBrowser();

    process.exit(
      0
    );

  }
);


/* =========================================================
   INICIAR SERVIDOR
   ========================================================= */

if (
  require.main ===
  module
) {

  app.listen(

    PORT,

    () =>
      console.log(
        `${APP_NAME} activo en puerto ${PORT}`
      )

  );

}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

  app,

  normalizeReportData,

  SLIDES

};
