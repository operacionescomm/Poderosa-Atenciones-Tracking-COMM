const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Poderosa Atenciones Tracking - Visual Engine';
const OPERATION_NAME = process.env.OPERATION_NAME || 'Poderosa Tracking';
const API_KEY = String(process.env.RENDER_API_KEY || '').trim();
const sampleReport = require('./data/sample-report.json');

const SLIDES = [
  { number: '10', view: 'slide10', style: 'summary', title: 'RESUMEN EJECUTIVO DEL PERIODO' },
  { number: '11', view: 'slide11', style: 'daily', title: 'EVOLUCIÓN DIARIA DE ATENCIONES' },
  { number: '12', view: 'slide12', style: 'categories', title: 'DISTRIBUCIÓN POR CATEGORÍA DE ATENCIÓN' },
  { number: '13', view: 'slide13', style: 'demand', title: 'CONCENTRACIÓN DE LA DEMANDA OPERATIVA' },
  { number: '15', view: 'slide15', style: 'supplies', title: 'INSUMOS UTILIZADOS' },
  { number: '17', view: 'slide17', style: 'insights', title: 'HALLAZGOS Y ACCIONES PRIORITARIAS' }
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
    resolution: '1600x900',
    slides: SLIDES,
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
    message: 'Motor visual de Tracking Poderosa activo',
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
  app.get(`/test-slide${slide.number}`, async (req, res) => {
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
    slideNumber: slide.number,
    slideTitle: slide.number === '15' ? report.supplyHeading : slide.title,
    formatNumber,
    formatPct,
    truncate
  };
}

function normalizeReportData(raw) {
  const period = text(raw.period || raw.periodo || 'Periodo no indicado');
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

  const companies = array(raw.companies || raw.companias)
    .map(item => ({
      name: text(item.name || item.nombre || item.compania || 'SIN COMPAÑÍA'),
      count: number(item.count ?? item.atenciones ?? item.cantidad)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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

  const totalAttentions = number(
    metricsRaw.totalAttentions ?? metricsRaw.totalAtenciones ?? raw.totalAtenciones ?? sum(categories, 'count')
  );
  const uniqueVehicles = number(metricsRaw.uniqueVehicles ?? metricsRaw.vehiculosUnicos ?? raw.vehiculosUnicos);
  const activeDays = number(metricsRaw.activeDays ?? metricsRaw.diasConAtencion ?? daily.filter(x => x.value > 0).length);
  const peakValue = number(metricsRaw.peakValue ?? metricsRaw.maximoDiario ?? Math.max(0, ...daily.map(x => x.value)));
  const peakDay = text(metricsRaw.peakDay || metricsRaw.diaPico || daily.filter(x => x.value === peakValue).map(x => x.day).join(', '));
  const distinctSupplies = number(metricsRaw.distinctSupplies ?? metricsRaw.insumosDistintos ?? allSupplies.length);

  const comparisonRaw = raw.comparison || raw.comparacion || {};
  const previousTotalValue = comparisonRaw.previousTotal ?? comparisonRaw.totalAnterior;
  const previousTotal = previousTotalValue === null || previousTotalValue === undefined || previousTotalValue === ''
    ? null
    : number(previousTotalValue);
  let variationPct = comparisonRaw.variationPct ?? comparisonRaw.variacionPct;
  if (variationPct === null || variationPct === undefined || variationPct === '') {
    variationPct = previousTotal > 0 ? ((totalAttentions - previousTotal) / previousTotal) * 100 : null;
  }
  variationPct = variationPct === null ? null : number(variationPct);

  const dailyMax = Math.max(1, ...daily.map(x => x.value));
  const dailyAverage = daily.length ? totalAttentions / daily.length : 0;
  const categoryMax = Math.max(1, ...categories.map(x => x.count));
  const companyMax = Math.max(1, ...companies.map(x => x.count));
  const supplyMax = Math.max(1, ...supplies.map(x => x.quantity));
  const vehicleTotal = sum(vehicleTypes, 'count');
  const palette = ['#0b63ce', '#12a6b1', '#ff7a00', '#7c3aed', '#2f8f61', '#e5484d', '#6b7a90'];

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
  const repeatedVisits = Math.max(0, totalAttentions - uniqueVehicles);
  const top3Companies = companies.slice(0, 3).reduce((acc, item) => acc + item.count, 0);

  const insights = array(raw.insights || raw.hallazgos);
  const normalizedInsights = insights.length ? insights.map(item => ({
    title: text(item.title || item.titulo),
    text: text(item.text || item.descripcion),
    tone: text(item.tone || item.tono || 'blue')
  })) : [
    {
      title: 'Categoría predominante',
      text: `${topCategory.name} concentra ${formatPct(topCategory.share)} de las atenciones del periodo.`,
      tone: 'blue'
    },
    {
      title: 'Concentración por compañía',
      text: `Las tres compañías principales representan ${formatPct(totalAttentions ? top3Companies / totalAttentions * 100 : 0)} de la demanda mensual.`,
      tone: 'teal'
    },
    {
      title: 'Consumo principal',
      text: `${topSupply.name} lidera el consumo con ${formatNumber(topSupply.quantity)} ${topSupply.unit}.`,
      tone: 'orange'
    },
    {
      title: 'Recurrencia operativa',
      text: repeatedVisits > 0
        ? `Se observan ${formatNumber(repeatedVisits)} atenciones adicionales sobre el total de vehículos únicos.`
        : 'No se observan atenciones repetidas sobre los vehículos registrados.',
      tone: 'purple'
    }
  ];

  const actions = array(raw.actions || raw.acciones);
  const normalizedActions = actions.length ? actions.map(item => text(item.text || item.descripcion || item)) : [
    `Priorizar revisión preventiva para reducir la participación de ${topCategory.name}.`,
    `Coordinar programación con ${topCompany.name}, principal fuente de demanda del periodo.`,
    `Asegurar disponibilidad de ${topSupply.name} según el consumo mensual observado.`
  ];

  return {
    period,
    operation,
    reportName,
    generatedAt: text(raw.generatedAt || raw.fechaGeneracion || ''),
    metrics: { totalAttentions, uniqueVehicles, activeDays, peakDay, peakValue, distinctSupplies },
    comparison: {
      previousPeriod: text(comparisonRaw.previousPeriod || comparisonRaw.periodoAnterior || 'Mes anterior'),
      previousTotal,
      variationPct,
      label: variationPct === null ? 'Sin base de comparación' : `${variationPct >= 0 ? '+' : ''}${formatPct(variationPct)}`,
      tone: variationPct === null ? 'neutral' : variationPct <= 0 ? 'good' : 'alert'
    },
    daily,
    dailyAverage,
    dailyAverageHeight: Math.min(100, (dailyAverage / dailyMax) * 100),
    categories,
    companies,
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
    actions: normalizedActions
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
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
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
  return `${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number(value))}%`;
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
    const candidate = path.join(
      shellRoot,
      version,
      'chrome-headless-shell-linux64',
      'chrome-headless-shell'
    );
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
    const stylePath = path.join(__dirname, 'public', 'styles.css');
    if (fs.existsSync(stylePath)) await page.addStyleTag({ path: stylePath });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    return Buffer.from(await page.screenshot({ type: 'png', fullPage: false, omitBackground: true }));
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

module.exports = { app, normalizeReportData };
