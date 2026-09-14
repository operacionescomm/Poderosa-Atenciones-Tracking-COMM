const test = require('node:test');
const assert = require('node:assert/strict');
const sample = require('../data/sample-quarterly-report.json');
const { normalizeReportData, SLIDES } = require('../server');

test('registra exactamente las nueve diapositivas del reporte trimestral', () => {
  assert.deepEqual(SLIDES.map(slide => slide.number), ['10', '11', '12', '13', '14', '15', '16', '18', '20']);
});

test('normaliza los KPI principales del resumen trimestral', () => {
  const report = normalizeReportData(sample);
  assert.equal(report.period, 'MAYO-JUNIO-JULIO 2026');
  assert.equal(report.metrics.totalAttentions, 183);
  assert.equal(report.metrics.weeklyAverage, 13.9);
  assert.equal(report.metrics.companiesCount, 44);
  assert.equal(report.metrics.uniqueDevices, 128);
  assert.equal(report.metrics.reincidenceCount, 10);
  assert.equal(report.comparison.previousTotal, 46);
  assert.equal(report.comparison.currentTotal, 80);
  assert.equal(report.comparison.variationPct, 73.9);
});

test('mantiene la regla de top 10 para insumos', () => {
  const input = {
    period: 'MAYO-JUNIO-JULIO 2026',
    supplies: Array.from({ length: 12 }, (_, index) => ({
      name: `Insumo ${index + 1}`,
      quantity: index + 1,
      unit: 'und'
    }))
  };
  const report = normalizeReportData(input);
  assert.equal(report.supplies.length, 10);
  assert.equal(report.supplies[0].quantity, 12);
  assert.equal(report.supplies[9].quantity, 3);
  assert.match(report.supplyHeading, /^TOP 10 INSUMOS MÁS UTILIZADOS/);
});

test('interpreta cantidades decimales con coma', () => {
  const report = normalizeReportData({
    period: 'MAYO-JUNIO-JULIO 2026',
    supplies: [{ name: 'Cinta aislante', quantity: '1,45', unit: 'm' }]
  });
  assert.equal(report.supplies[0].quantity, 1.45);
});

test('calcula concentraciones trimestrales cuando no llegan explícitas', () => {
  const report = normalizeReportData({
    period: 'TRIMESTRE',
    metrics: { totalAttentions: 100 },
    categories: [
      { name: 'A', count: 35 },
      { name: 'B', count: 25 },
      { name: 'C', count: 40 }
    ],
    companies: Array.from({ length: 10 }, (_, index) => ({ name: `C${index + 1}`, count: 5 }))
  });
  assert.equal(report.metrics.categoryConcentrationShare, 75);
  assert.equal(report.metrics.demandShare, 50);
});
