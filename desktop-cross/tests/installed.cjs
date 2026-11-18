'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { _electron } = require('playwright-core');
const pdfLib = require('../../dev/vendor/pdf-lib.min.js');
const fixture = require('../../desktop-webview2/tests/pdf-fixtures.js');

const run = promisify(execFile);

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), 'pdf-grid-smoke-'));
  const args = [`--user-data-dir=${path.join(directory, 'profile')}`];
  const executablePath = process.env.PDF_GRID_EXECUTABLE;
  if (!executablePath) args.unshift(path.resolve(__dirname, '..'));

  const paperA = path.join(directory, 'Paper A.pdf');
  const paperB = path.join(directory, '논문 B.pdf');
  await writeFile(paperA, await fixture(pdfLib, 20));
  await writeFile(paperB, await fixture(pdfLib, 17));
  const mac = process.platform === 'darwin';
  const modifier = mac ? 'Meta' : 'Control';
  let application;
  let page;

  async function launch(files = []) {
    application = await _electron.launch({ executablePath, args: [...args, ...files] });
    page = await application.firstWindow();
    await page.evaluate(async () => window.PDFGridSession?.ready);
    page.setDefaultTimeout(15000);
  }

  const tab = name => page.getByRole('tab', { name, exact: true });
  async function stage(name) {
    const panel = await tab(name).getAttribute('aria-controls');
    const locator = page.frameLocator('#' + panel + ' iframe').locator('#stage.ready');
    await locator.waitFor();
    return locator;
  }

  try {
    await launch([paperA]);
    await stage('Paper A.pdf');
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    assert.equal(await page.evaluate(async () => {
      try {
        await pdfGridDesktop.openExternal('file:///etc/passwd');
        return false;
      } catch {
        return true;
      }
    }), true);

    if (mac && executablePath) {
      await run('open', ['-a', path.resolve(executablePath, '../../..'), paperB]);
    } else if (executablePath) {
      await run(executablePath, [...args, paperB], { timeout: 10000 });
    } else {
      // The unpackaged Windows developer run uses the same second-instance route.
      await run(require('electron'), [...args, paperB], { timeout: 10000 });
    }
    const right = await stage('논문 B.pdf');
    assert.equal(await page.getByRole('tab').count(), 2);
    await tab('논문 B.pdf').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '절대경로 복사' }).click();
    assert.equal(await application.evaluate(({ clipboard }) => clipboard.readText()), paperB);
    console.log('Opened PDFs through startup and existing instance; native path clipboard passed.');

    await right.focus();
    await page.keyboard.press(modifier + '+w');
    await tab('논문 B.pdf').waitFor({ state: 'detached' });
    await page.keyboard.press(modifier + '+Shift+t');
    const reopened = await stage('논문 B.pdf');
    await writeFile(paperB, await fixture(pdfLib, 23));
    await reopened.focus();
    await page.keyboard.press(modifier + '+r');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('iframe')].some(frame => frame.contentDocument.querySelector('#page')?.max === '23'));
    await page.locator('#toggleSplitView').click();
    await page.locator('.splitLeft iframe').waitFor();
    await page.locator('.splitRight iframe').waitFor();
    await application.close();

    await launch();
    await stage('Paper A.pdf');
    await stage('논문 B.pdf');
    assert.equal(await page.locator('.pdfTabPanel[aria-hidden="false"]').count(), 2);
    console.log('Closed-tab restore, disk reload, and split workspace restart passed.');
  } finally {
    await application?.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
