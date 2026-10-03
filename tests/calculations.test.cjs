const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(script => script.trim());
const context = vm.createContext({});
vm.runInContext(scripts[0] + '\nthis.F = Finance;', context);
const F = context.F;
function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should equal ${expected}`);
}

test('Both embedded scripts have valid JavaScript syntax', () => {
  assert.equal(scripts.length, 2);
  scripts.forEach(script => new vm.Script(script));
});

test('Chilean input format supports grouping, decimals, signs and zero', () => {
  close(F.parse('1.000.000,50'), 1000000.5);
  close(F.parse('15,25'), 15.25);
  close(F.parse('-1.250,75'), -1250.75);
  close(F.parse('0'), 0);
  close(F.parse('1000'), 1000);
  ['', 'abc', '15.25', '1.00.000', '1,000,00', 'Infinity', '1e5', '0x12', '9999999999999999'].forEach(value => assert.throws(() => F.parse(value)));
});

test('IVA forward and reverse recover net, tax and total', () => {
  const forward = F.iva(100000, 19, 'neto');
  close(forward.net, 100000); close(forward.tax, 19000); close(forward.total, 119000);
  const reverse = F.iva(119000, 19, 'total');
  close(reverse.net, 100000); close(reverse.tax, 19000);
  close(F.iva(100, 0, 'total').net, 100);
  assert.throws(() => F.iva(-1, 19, 'neto'));
});

test('Honorarios 2026 support gross and desired net', () => {
  const forward = F.fees(100000, 15.25, 'bruto');
  close(forward.net, 84750); close(forward.withheld, 15250);
  close(F.fees(84750, 15.25, 'liquido').gross, 100000);
  assert.throws(() => F.fees(100, 100, 'liquido'));
  assert.throws(() => F.fees(100, -1, 'liquido'));
});

test('Margin and markup use different bases; objective price is reversible', () => {
  const result = F.pricing(60, 100, undefined, 'analyze');
  close(result.profit, 40); close(result.margin, 40); close(result.markup, 66.6666666667);
  close(F.pricing(60, undefined, 40, 'target').sale, 100);
  assert.equal(F.pricing(0, 100, undefined, 'analyze').markup, null);
  assert.throws(() => F.pricing(60, 100, 100, 'target'));
  assert.throws(() => F.pricing(60, 0, 0, 'analyze'));
  close(F.pricing(100, 50, 0, 'analyze').margin, -100);
});

test('Equilibrium rounds up units and rejects nonpositive contribution', () => {
  const result = F.equilibrium(1001, 6, 10);
  close(result.exact, 250.25); close(result.units, 251); close(result.sales, 2510);
  close(F.equilibrium(0, 6, 10).units, 0);
  assert.throws(() => F.equilibrium(100, 10, 10));
  assert.throws(() => F.equilibrium(100, 12, 10));
});

test('Simple and compound interest match annual reference cases', () => {
  close(F.simple(1000000, 6, 12).gain, 60000);
  close(F.growth(1000000, 6, 12).balance, 1060000, 0.00001);
  close(F.growth(1000000, 6, 24).balance, 1123600, 0.00001);
  close(F.growth(1000, -10, 12).balance, 900, 0.00001);
  assert.throws(() => F.growth(1000, -100, 12));
});

