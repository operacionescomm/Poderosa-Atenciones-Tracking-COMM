const test = require('node:test');
const assert = require('node:assert/strict');
const sample = require('../data/sample-report.json');
const { normalizeReportData } = require('../server');

test('conserva todos los insumos cuando hay diez o menos', () => {
  const report = normalizeReportData(sample);
  assert.equal(report.supplies.length, 8);
  assert.match(report.supplyHeading, /^INSUMOS UTILIZADOS/);
});

test('muestra únicamente el top 10 cuando existen más de diez insumos', () => {
  const input = {
    period: 'Julio 2026',
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

test('interpreta cantidades decimales con coma sin agregar signos al valor', () => {
  const report = normalizeReportData({
    period: 'Mayo 2026',
    supplies: [{ name: 'Cinta aislante', quantity: '1,45', unit: 'm' }]
  });
  assert.equal(report.supplies[0].quantity, 1.45);
});

test('mantiene los días con cero atenciones en la serie mensual', () => {
  const report = normalizeReportData(sample);
  assert.equal(report.daily.length, 31);
  assert.equal(report.daily.filter(item => item.value === 0).length, 17);
});
