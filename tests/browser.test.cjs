const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'qa');
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href;
const fixture = {
  uf: { codigo: 'uf', unidad_medida: 'Pesos', valor: 40000.5, fecha: '2026-09-05T04:00:00Z' },
  utm: { codigo: 'utm', unidad_medida: 'Pesos', valor: 70000, fecha: '2026-09-01T04:00:00Z' },
  dolar: { codigo: 'dolar', unidad_medida: 'Pesos', valor: 900, fecha: '2026-09-04T04:00:00Z' }
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('BROWSER:', message.text()); });
    let apiMode = 'success';
    await page.route('https://mindicador.cl/api', route => {
      if (apiMode === 'failure') return route.abort('failed');
      const data = apiMode === 'partial' ? { uf: fixture.uf, utm: null, dolar: { ...fixture.dolar, valor: 'invalid' } } : fixture;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
    });
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#data-status').dataset.state === 'ok');
    assert.equal(await page.locator('.result-value').innerText(), '$ 119.000');
    assert.match(await page.locator('.indicator-date').first().innerText(), /05 sept 2026/);
    const ids = await page.locator('.nav-button').evaluateAll(buttons => buttons.map(button => button.dataset.tool));
    assert.equal(ids.length, 16);
    for (const id of ids) {
      await page.locator(`.nav-button[data-tool="${id}"]`).click();
      await page.waitForFunction(tool => document.querySelector('.nav-button[aria-current="page"]').dataset.tool === tool, id);
      assert.equal(await page.locator('.result-value').count(), 1, `${id} should calculate its default values`);
      assert.equal(await page.locator('#form-error').isVisible(), false, `${id} has unexpected errors`);
    }
    console.log('PASS: all 16 calculators render valid default results.');

    await page.locator('.nav-button[data-tool="iva"]').click();
    await page.locator('#field-mode').selectOption('total');
    await page.locator('#field-amount').fill('119.000');
    assert.equal(await page.locator('#copy-result').isDisabled(), true);
    await page.getByRole('button', { name: 'Calcular', exact: false }).click();
    assert.equal(await page.locator('.result-value').innerText(), '$ 100.000');
    await page.locator('#field-amount').fill('15.25');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('#form-error').isVisible(), true);
    assert.equal(await page.locator('.result-value').count(), 0);

    await page.locator('.nav-button[data-tool="honorarios"]').click();
    assert.equal(await page.locator('.result-value').innerText(), '$ 84.750');
    await page.locator('#field-mode').selectOption('liquido');
    await page.locator('#field-amount').fill('84.750');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('.result-value').innerText(), '$ 100.000');
    await page.locator('.nav-button[data-tool="margen"]').click();
    await page.locator('#field-mode').selectOption('target');
    assert.equal(await page.locator('#field-sale').isVisible(), false);
    assert.equal(await page.locator('#field-target').isVisible(), true);
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('.result-value').innerText(), '$ 100.000');
    console.log('PASS: reverse calculations, margin mode, invalid numbers and stale result controls.');

    await page.locator('.nav-button[data-tool="prestamo"]').click();
    await page.locator('#field-rate').fill('0');
    await page.locator('#field-principal').fill('120.000');
    await page.locator('#field-months').fill('12');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('.result-value').innerText(), '$ 10.000');
    assert.equal(await page.locator('#table-section tbody tr').count(), 12);
    const downloading = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    const download = await downloading;
    await download.saveAs(path.join(output, 'amortizacion-verificada.csv'));
    const csv = fs.readFileSync(path.join(output, 'amortizacion-verificada.csv'), 'utf8');
    assert.ok(csv.includes('"12";"10000,00";"0,00";"10000,00";"0,00"'));
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#print-inputs').isVisible(), true);
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    await page.pdf({ path: path.join(output, 'impresion-verificada.pdf'), format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    console.log('PASS: zero-interest loan, CSV contents and print layout.');

    await page.locator('.nav-button[data-tool="flujo"]').click();
    await page.locator('#row-add').click();
    assert.equal(await page.locator('.editor-row').count(), 4);
    await page.locator('.row-remove').last().click();
    assert.equal(await page.locator('.editor-row').count(), 3);
    await page.locator('#clear').click();
    assert.equal(await page.locator('.result-value').count(), 0);
    assert.equal(await page.locator('#field-initial').inputValue(), '');

    await page.locator('#manual-open').click();
    await page.locator('#manual-enabled-uf').check();
    await page.locator('#manual-value-uf').fill('40.000');
    await page.locator('#manual-date-uf').fill('2026-09-05');
    await page.getByRole('button', { name: 'Guardar valores' }).click();
    assert.match(await page.locator('.indicator-date').first().innerText(), /Manual/);
    await page.locator('.nav-button[data-tool="conversion"]').click();
    assert.equal(await page.locator('.result-value').innerText(), '$ 400.000');
    await page.locator('#field-mode').selectOption('fromCLP');
    await page.locator('#field-amount').fill('400.000');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('.result-value').innerText(), '10,0000 UF');

    apiMode = 'partial';
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.querySelector('#data-status-text').textContent.includes('incompletos'));
    assert.equal(await page.locator('.indicator-value').nth(1).innerText(), 'Sin dato');
    await page.locator('#field-indicator').selectOption('utm');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    assert.match(await page.locator('#form-error').innerText(), /Falta el valor de UTM/);
    apiMode = 'failure';
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.querySelector('#data-status-text').textContent.includes('No se pudo actualizar'));
    assert.equal(await page.locator('.indicator-value').first().innerText(), '$ 40.000,00');
    console.log('PASS: row editing, clear, manual indicators, both conversion directions and partial/failed API responses.');

    await page.locator('#search').fill('interes');
    assert.equal(await page.locator('.nav-button').count(), 2);
    await page.locator('#search').fill('noexiste');
    assert.equal(await page.locator('.no-search').count(), 1);
    await page.locator('#search').fill('');
    await page.locator('.nav-button[data-tool="iva"]').click();
    await page.locator('#field-mode').selectOption('neto');
    await page.locator('#field-amount').fill('100.000');
    await page.locator('#calc-form').evaluate(form => form.requestSubmit());
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#sidebar').evaluate(el => el.inert), false);
    await page.locator('.nav-button[data-tool="ahorro"]').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#sidebar').evaluate(el => el.inert), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    for (const width of [360, 580, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}px`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: accent-insensitive search, mobile navigation, responsive widths and no JavaScript exceptions.');
    await context.close();

    const liveContext = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    const livePage = await liveContext.newPage();
    await livePage.goto(url);
    await livePage.waitForFunction(() => ['ok', 'error'].includes(document.querySelector('#data-status').dataset.state), { timeout: 16000 });
    const liveState = await livePage.locator('#data-status').getAttribute('data-state');
    const liveText = await livePage.locator('#data-status-text').innerText();
    await livePage.screenshot({ path: path.join(output, 'escritorio.png'), fullPage: true, animations: 'disabled' });
    await livePage.setViewportSize({ width: 390, height: 844 });
    await livePage.screenshot({ path: path.join(output, 'movil.png'), fullPage: true, animations: 'disabled' });
    fs.writeFileSync(path.join(output, 'verificacion.json'), JSON.stringify({ browser: await browser.version(), checks: 'All functional browser checks passed', liveApi: { state: liveState, message: liveText } }, null, 2));
    console.log('LIVE API:', liveState, liveText);
    await liveContext.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
