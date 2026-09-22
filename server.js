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

    eyebrow: '',

    title:
      'Evolución mensual de atenciones',

    subtitle:
      'Comparativo de atenciones durante los tres meses del periodo'
  },


  {
    number: '13',

    view: 'slide13',

    style: 'demand',

    eyebrow: '',

    title:
      'Concentración de la demanda operativa',

    subtitle:
      'Compañías y unidades atendidas'
  },


  {
    number: '14',

    view: 'slide14',

    style: 'quarterly',

    eyebrow: '',

    title:
      'Indicadores trimestrales',

    subtitle:
      'Vista consolidada del servicio'
  },


  {
    number: '15',

    view: 'slide15',

    style: 'supplies',

    eyebrow: '',

    title:
      'Análisis complementario',

    subtitle:
      'Detalle operativo del trimestre'
  },


  {
    number: '16',

    view: 'slide16',

    style: 'quarterly',

    eyebrow: '',

    title:
      'Seguimiento del servicio',

    subtitle:
      'Indicadores y evolución trimestral'
  },


  {
    number: '18',

    view: 'slide18',

    style: 'quarterly',

    eyebrow: '',

    title:
      'Suministros',

    subtitle:
      'Consumo y disponibilidad de insumos'
  },


  {
    number: '20',

    view: 'slide20',

    style: 'quarterly',

    eyebrow: '',

    title:
      'Hallazgos',

    subtitle:
      'Puntos de atención y acciones prioritarias'
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

function buildSlideData(
  raw,
  slide
) {

  const report =
    normalizeReportData(
      raw
    );


  return {

    /*
      Toda la información del reporte
      normalizado.
    */

    ...report,


    /*
      Plantilla EJS específica.
    */

    viewName:
      slide.view,


    /*
      Clase CSS específica del contenido.
    */

    viewClass:
      slide.style,


    /*
      Número lógico del PPT.
      Ya NO se imprime automáticamente.
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
      Helpers disponibles dentro
      de los archivos EJS.
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
