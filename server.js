const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Poderosa Tracking - Motor Trimestral';
const OPERATION_NAME = process.env.OPERATION_NAME || 'Poderosa Tracking';
const API_KEY = String(process.env.RENDER_API_KEY || '').trim();
const sampleReport = require('./data/sample-quarterly-report.json');

const SLIDES = [
  { number: '10', view: 'slide10', style: 'summary', standalone: true, title: 'Resumen ejecutivo del trimestre', subtitle: 'Panorama operativo y puntos de atención gerencial' },
  { number: '11', view: 'slide11', style: 'daily', standalone: false, title: 'Atenciones por tipo y evolución', subtitle: 'Comportamiento operativo del trimestre' },
  { number: '12', view: 'slide12', style: 'categories', standalone: false, title: 'Distribución por categoría de atención', subtitle: 'Concentración y composición del servicio' },
  { number: '13', view: 'slide13', style: 'demand', standalone: false, title: 'Concentración de la demanda operativa', subtitle: 'Compañías y unidades atendidas' },
  { number: '14', view: 'slide14', style: 'quarterly', standalone: false, title: 'Indicadores trimestrales', subtitle: 'Vista consolidada del servicio' },
  { number: '15', view: 'slide15', style: 'supplies', standalone: false, title: 'Análisis complementario', subtitle: 'Detalle operativo del trimestre' },
  { number: '16', view: 'slide16', style: 'quarterly', standalone: false, title: 'Seguimiento del servicio', subtitle: 'Indicadores y evolución trimestral' },
  { number: '18', view: 'slide18', style: 'quarterly', standalone: false, title: 'Suministros', subtitle: 'Consumo y disponibilidad de insumos' },
  { number: '20', view: 'slide20', style: 'quarterly', standalone: false, title: 'Hallazgos', subtitle: 'Puntos de atención y acciones prioritarias' }
];

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: APP_NAME,
    operation: OPERATION_NAME,
    reportType: 'quarterly',
    resolution: '1600x900',
    slides: SLIDES.map(({ number, view, title, subtitle, standalone }) => ({ number, view, title, subtitle, standalone })),
    endpoints: {
      health: '/health',
      preview: SLIDES.map(slide => `/test-slide${slide.number}`),
      png: SLIDES.map(slide => `/test-slide${slide.number}-png`),
      render: SLIDES.map(slide => `/render/slide${slide.number}`)
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: APP_NAME,
    operation: OPERATION_NAME,
    reportType: 'quarterly',
    timestamp: new Date().toISOString()
  });
});

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const provided = String(req.get('x-api-key') || '').trim();
  if (provided && provided === API_KEY) return next();
  return res.status(401).json({ ok: false, error: 'No autorizado' });
}

for (const slide of SLIDES) registerSlide(slide);

function registerSlide(slide) {
  app.get(`/test-slide${slide.number}`, (req, res) => {
    try {
      res.render('report', buildSlideData(sampleReport, slide));
    } catch (error) {
      console.error(`Error en test slide ${slide.number}:`, error);
      res.status(500).send(String(error));
    }
  });

  app.get(`/test-slide${slide.number}-png`, async (req, res) => {
    try {
      const html = await renderEjsToString('report', buildSlideData(sampleReport, slide));
      const imageBuffer = await htmlToPng(html);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', imageBuffer.length);
      res.end(imageBuffer);
    } catch (error) {
      console.error(`Error generando PNG slide ${slide.number}:`, error);
      res.status(500).send(String(error));
    }
  });

  app.post(`/render/slide${slide.number}`, requireApiKey, async (req, res) => {
    try {
      const html = await renderEjsToString('report', buildSlideData(req.body || {}, slide));
      const imageBuffer = await htmlToPng(html);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', imageBuffer.length);
      res.end(imageBuffer);
    } catch (error) {
      console.error(`Error renderizando slide ${slide.number}:`, error);
      res.status(500).json({ ok: false, error: String(error) });
    }
  });
}

function buildSlideData(raw, slide) {
  const report = normalizeReportData(raw);
  return {
    ...report,
    viewName: slide.view,
    viewClass: slide.style,
    standalone: Boolean(slide.standalone),
    slideNumber: slide.number,
    slideTitle: slide.number === '18' ? report.supplyHeading : slide.title,
    slideSubtitle: slide.subtitle || '',
    formatNumber,
    formatPct,
    truncate
  };
}

function normalizeReportData(raw = {}) {
  const period = text(raw.period || raw.periodo || 'MAYO-JUNIO-JULIO 2026');
  const operation = text(raw.operation || raw.operacion || 'Poderosa');
  const reportName = text(raw.reportName || raw.nombreInforme || 'Atenciones de Tracking');
  const metricsRaw = raw.metrics || raw.indicadores || {};

  const daily = array(raw.daily || raw.dias).map((item, index) => ({
    day: text(item.day || item.dia || String(index + 1).padStart(2, '0')),
    value: number(item.value ?? item.atenciones ?? item.cantidad)
  }));

  const categories = array(raw.categories || raw.categorias)
    .map(item => ({
      name: text(item.name || item.nombre || item.categoria || 'SIN CATEGORÍA'),
      count: number(item.count ?? item.atenciones ?? item.cantidad)
    }))
    .sort((a, b) => b.count - a.count);

  const allCompanies = array(raw.companies || raw.companias)
    .map(item => ({
      name: text(item.name || item.nombre || item.compania || 'SIN COMPAÑÍA'),
      count: number(item.count ?? item.atenciones ?? item.cantidad)
    }))
    .sort((a, b) => b.count - a.count);
  const companies = allCompanies.slice(0, 10);

  const vehicleTypes = array(raw.vehicleTypes || raw.tiposVehiculo)
    .map(item => ({
      name: text(item.name || item.nombre || item.tipo || 'SIN TIPO'),
      count: number(item.count ?? item.atenciones ?? item.cantidad)
    }))
    .sort((a, b) => b.count - a.count);

  const allSupplies = array(raw.supplies || raw.insumos)
    .map(item => ({
      name: text(item.name || item.nombre || item.insumo || 'SIN INSUMO'),
      quantity: number(item.quantity ?? item.cantidad),
      unit: text(item.unit || item.unidad || ''),
      uses: number(item.uses ?? item.usos ?? item.frecuencia)
    }))
    .sort((a, b) => b.quantity - a.quantity);
  const supplies = allSupplies.slice(0, 10);

  const monthlySeries = array(raw.monthlySeries || raw.serieMensual || raw.meses).map(item => ({
    month: text(item.month || item.mes || item.name || item.nombre),
    value: number(item.value ?? item.atenciones ?? item.cantidad)
  }));

  const weeklySeries = array(raw.weeklySeries || raw.serieSemanal || raw.semanas).map(item => ({
    week: text(item.week || item.semana || item.name || item.nombre),
    value: number(item.value ?? item.atenciones ?? item.cantidad)
  }));

  const totalAttentionsFallback = categories.length
    ? sum(categories, 'count')
    : sum(monthlySeries, 'value');
  const totalAttentions = number(
    metricsRaw.totalAttentions ??
    metricsRaw.totalAtenciones ??
    raw.totalAtenciones ??
    totalAttentionsFallback
  );

  const uniqueVehicles = number(
    metricsRaw.uniqueVehicles ??
    metricsRaw.vehiculosUnicos ??
    metricsRaw.uniqueDevices ??
    metricsRaw.dispositivosUnicos ??
    raw.vehiculosUnicos
  );

  const uniqueDevices = number(
    metricsRaw.uniqueDevices ??
    metricsRaw.devicesCount ??
    metricsRaw.dispositivosUnicos ??
    uniqueVehicles
  );

  const weeklyAverageFallback = weeklySeries.length
    ? sum(weeklySeries, 'value') / weeklySeries.length
    : (totalAttentions ? totalAttentions / 13.142857 : 0);
  const weeklyAverage = number(
    metricsRaw.weeklyAverage ??
    metricsRaw.averagePerWeek ??
    metricsRaw.promedioSemanal ??
    weeklyAverageFallback
  );

  const companiesCount = number(
    metricsRaw.companiesCount ??
    metricsRaw.companyCount ??
    metricsRaw.companiasAtendidas ??
    raw.companiesCount ??
    allCompanies.length
  );

  const reincidenceCount = number(
    metricsRaw.reincidenceCount ??
    metricsRaw.reincidencia ??
    metricsRaw.vehiculosReincidentes ??
    raw.reincidenceCount
  );

  const activeDays = number(
    metricsRaw.activeDays ??
    metricsRaw.diasConAtencion ??
    daily.filter(x => x.value > 0).length
  );
  const peakValue = number(
    metricsRaw.peakValue ??
    metricsRaw.maximoDiario ??
    Math.max(0, ...daily.map(x => x.value))
  );
  const peakDay = text(
    metricsRaw.peakDay ||
    metricsRaw.diaPico ||
    daily.filter(x => x.value === peakValue && peakValue > 0).map(x => x.day).join(', ')
  );
  const distinctSupplies = number(
    metricsRaw.distinctSupplies ??
    metricsRaw.insumosDistintos ??
    allSupplies.length
  );

  const comparisonRaw = raw.comparison || raw.comparacion || {};
  const previousTotalValue = comparisonRaw.previousTotal ?? comparisonRaw.totalAnterior;
  const previousTotal = previousTotalValue === null || previousTotalValue === undefined || previousTotalValue === ''
    ? null
    : number(previousTotalValue);
  const currentTotalValue = comparisonRaw.currentTotal ?? comparisonRaw.totalActual;
  const currentTotal = currentTotalValue === null || currentTotalValue === undefined || currentTotalValue === ''
    ? null
    : number(currentTotalValue);

  let variationPct = comparisonRaw.variationPct ?? comparisonRaw.variacionPct;
  if (variationPct === null || variationPct === undefined || variationPct === '') {
    variationPct = previousTotal > 0 && currentTotal !== null
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : null;
  }
  variationPct = variationPct === null ? null : number(variationPct);

  const dailyMax = Math.max(1, ...daily.map(x => x.value));
  const dailyAverage = daily.length ? sum(daily, 'value') / daily.length : 0;
  const categoryMax = Math.max(1, ...categories.map(x => x.count));
  const companyMax = Math.max(1, ...companies.map(x => x.count));
  const supplyMax = Math.max(1, ...supplies.map(x => x.quantity));
  const vehicleTotal = sum(vehicleTypes, 'count');
  const palette = ['#0b63ce', '#12a6b1', '#ff7a00', '#7c3aed', '#2f8f61', '#e5484d', '#6b7a90', '#0ea5e9', '#f59e0b', '#14b8a6'];

  categories.forEach((item, index) => {
    item.share = totalAttentions ? (item.count / totalAttentions) * 100 : 0;
    item.width = (item.count / categoryMax) * 100;
    item.color = palette[index % palette.length];
  });
  companies.forEach((item, index) => {
    item.share = totalAttentions ? (item.count / totalAttentions) * 100 : 0;
    item.width = (item.count / companyMax) * 100;
    item.color = palette[index % palette.length];
  });
  supplies.forEach((item, index) => {
    item.width = (item.quantity / supplyMax) * 100;
    item.color = palette[index % palette.length];
  });
  daily.forEach(item => {
    item.height = (item.value / dailyMax) * 100;
    item.isPeak = item.value === peakValue && peakValue > 0;
  });
  vehicleTypes.forEach((item, index) => {
    item.share = vehicleTotal ? (item.count / vehicleTotal) * 100 : 0;
    item.color = palette[index % palette.length];
  });

  const topCategory = categories[0] || { name: 'Sin datos', count: 0, share: 0 };
  const topCompany = companies[0] || { name: 'Sin datos', count: 0, share: 0 };
  const topSupply = supplies[0] || { name: 'Sin datos', quantity: 0, unit: '' };
  const top2CategoryCount = categories.slice(0, 2).reduce((acc, item) => acc + item.count, 0);
  const top10CompaniesCount = companies.slice(0, 10).reduce((acc, item) => acc + item.count, 0);

  const categoryConcentrationShare = number(
    metricsRaw.categoryConcentrationShare ??
    metricsRaw.concentracionCategoria ??
    metricsRaw.topCategoryShare ??
    (totalAttentions ? (top2CategoryCount / totalAttentions) * 100 : 0)
  );

  const categoryConcentrationLabel = text(
    metricsRaw.categoryConcentrationLabel ??
    metricsRaw.etiquetaConcentracionCategoria ??
    metricsRaw.topCategoryLabel ??
    (categories.length >= 2 ? `${categories[0].name} y ${categories[1].name}` : topCategory.name)
  );

  const demandShare = number(
    metricsRaw.demandShare ??
    metricsRaw.topCompaniesShare ??
    metricsRaw.concentracionDemanda ??
    (totalAttentions ? (top10CompaniesCount / totalAttentions) * 100 : 0)
  );

  const topCompaniesTopN = number(
    metricsRaw.topCompaniesTopN ?? metricsRaw.topCompaniasN ?? Math.min(10, companies.length)
  );
  const topCompaniesAttentions = number(
    metricsRaw.topCompaniesAttentions ?? metricsRaw.atencionesTopCompanias ?? top10CompaniesCount
  );

  const periodLabel = text(
    metricsRaw.periodLabel ?? metricsRaw.periodoTrimestral ?? raw.periodLabel ?? period
  );
  const executiveTitle = text(metricsRaw.executiveTitle ?? metricsRaw.tituloEjecutivo ?? raw.executiveTitle);
  const executiveBody = text(metricsRaw.executiveBody ?? metricsRaw.lecturaEjecutiva ?? raw.executiveBody);
  const sourceLabel = text(
    metricsRaw.sourceLabel ?? metricsRaw.fuente ?? raw.sourceLabel ?? 'Fuente: Reporte Trimestral y Registros - SOPORTE DE TRACKING_PODEROSA'
  );
  const footerCenter = text(
    metricsRaw.footerCenter ?? metricsRaw.pieCentro ?? raw.footerCenter ?? 'Poderosa - Atenciones de Tracking'
  );

  const insights = array(raw.insights || raw.hallazgos);
  const normalizedInsights = insights.length ? insights.map(item => ({
    title: text(item.title || item.titulo),
    text: text(item.text || item.descripcion),
    tone: text(item.tone || item.tono || 'blue')
  })) : [];

  const actions = array(raw.actions || raw.acciones);
  const normalizedActions = actions.map(item => text(item.text || item.descripcion || item));

  return {
    period,
    operation,
    reportName,
    generatedAt: text(raw.generatedAt || raw.fechaGeneracion || ''),
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
      previousPeriod: text(comparisonRaw.previousPeriod || comparisonRaw.periodoAnterior || 'Periodo anterior'),
      previousTotal,
      currentTotal,
      variationPct,
      label: variationPct === null ? 'Sin base de comparación' : `${variationPct >= 0 ? '+' : ''}${formatPct(variationPct)}`,
      tone: variationPct === null ? 'neutral' : variationPct <= 0 ? 'good' : 'alert'
    },
    monthlySeries,
    weeklySeries,
    daily,
    dailyAverage,
    dailyAverageHeight: Math.min(100, (dailyAverage / dailyMax) * 100),
    categories,
    companies,
    allCompanies,
    vehicleTypes,
    vehicleTotal,
    vehicleGradient: conicGradient(vehicleTypes),
    supplies,
    allSupplyCount: allSupplies.length,
    supplyHeading: allSupplies.length > 10
      ? `TOP 10 INSUMOS MÁS UTILIZADOS | ${period.toUpperCase()}`
      : `INSUMOS UTILIZADOS | ${period.toUpperCase()}`,
    topCategory,
    topCompany,
    topSupply,
    insights: normalizedInsights,
    actions: normalizedActions,
    quarterly: raw.quarterly || raw.trimestral || {}
  };
}

function conicGradient(items) {
  if (!items.length) return 'conic-gradient(#dbe5f2 0 100%)';
  let cursor = 0;
  const stops = [];
  for (const item of items) {
    const end = cursor + item.share;
    stops.push(`${item.color} ${cursor.toFixed(2)}% ${end.toFixed(2)}%`);
    cursor = end;
  }
  return `conic-gradient(${stops.join(', ')})`;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(items, key) {
  return items.reduce((acc, item) => acc + number(item[key]), 0);
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number(value));
}

function formatPct(value) {
  return `${new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(number(value))}%`;
}

function truncate(value, max = 38) {
  const input = text(value);
  return input.length <= max ? input : `${input.slice(0, max - 1).trim()}…`;
}

function renderEjsToString(viewName, data) {
  return new Promise((resolve, reject) => {
    app.render(viewName, data, (error, html) => error ? reject(error) : resolve(html));
  });
}

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const launchOptions = {
      headless: true,
      protocolTimeout: 300000,
      timeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    };
    const localChromePath = getLocalChromePath();
    if (localChromePath) launchOptions.executablePath = localChromePath;
    browserPromise = puppeteer.launch(launchOptions).catch(error => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

function getLocalChromePath() {
  const headlessShellPath = findHeadlessShellPath();
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    headlessShellPath,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

function findHeadlessShellPath() {
  const cacheRoot = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
  const shellRoot = path.join(cacheRoot, 'chrome-headless-shell');
  if (!fs.existsSync(shellRoot)) return null;
  const versions = fs.readdirSync(shellRoot).sort().reverse();
  for (const version of versions) {
    const candidate = path.join(shellRoot, version, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function htmlToPng(html) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await captureHtmlToPng(html);
    } catch (error) {
      lastError = error;
      console.warn(`Intento ${attempt} de PNG fallido; reiniciando Chrome:`, error.message);
      await resetBrowser();
    }
  }
  throw lastError;
}

async function captureHtmlToPng(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const legacyStylePath = path.join(__dirname, 'public', 'styles.css');
    if (fs.existsSync(legacyStylePath)) {
      await page.addStyleTag({ path: legacyStylePath });
    }

    const quarterlyStylePath = path.join(__dirname, 'public', 'quarterly.css');
    if (fs.existsSync(quarterlyStylePath)) {
      await page.addStyleTag({ path: quarterlyStylePath });
    }

    await page.evaluate(() => document.fonts && document.fonts.ready);
    return Buffer.from(await page.screenshot({ type: 'png', fullPage: false, omitBackground: false }));
  } finally {
    await page.close().catch(() => {});
  }
}

async function resetBrowser() {
  const currentBrowser = browserPromise;
  browserPromise = null;
  if (!currentBrowser) return;
  try {
    const browser = await currentBrowser;
    await browser.close();
  } catch (error) {
    console.warn('No se pudo cerrar Chrome limpiamente:', error.message);
  }
}

async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } finally {
    browserPromise = null;
  }
}

process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });

if (require.main === module) {
  app.listen(PORT, () => console.log(`${APP_NAME} activo en puerto ${PORT}`));
}

module.exports = { app, normalizeReportData, SLIDES };
