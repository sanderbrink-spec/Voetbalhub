'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  const output = '.browser-output/phase51';
  fs.mkdirSync(output, { recursive: true });
  const assets = path.resolve('android-project/app/src/main/assets');
  try {
    for (const width of [320, 393, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 851 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(assets, 'clubquiz.html')).href);
      const categories = page.getByRole('radio');
      assert.equal(await categories.count(), 7);
      const rules = page.locator('.quiz-rules');
      assert.equal(await rules.evaluate(element => element.open), false);
      await rules.locator('summary').click();
      assert.equal(await rules.evaluate(element => element.open), true);
      await rules.locator('summary').click();
      assert.equal(await page.locator('#level').isVisible(), true);
      await page.getByRole('radio', { name: /Clubspecial/ }).check();
      assert.equal(await page.locator('#club').isVisible(), true);
      await page.getByRole('radio', { name: /Snelle aftrap/ }).check();
      assert.equal(await page.locator('#mode').inputValue(), 'quick');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (width === 393) await page.screenshot({ path: output + '/quizkeuze.png', fullPage: true });
      await page.locator('#start').click();
      await page.locator('#answers button').first().waitFor();
      assert.equal(await page.locator('#timer svg').count(), 1);
      assert.equal(await page.locator('#answers button').count(), 4);
      assert.ok((await page.locator('#answers button').first().boundingBox()).height >= 48);
      if (width === 393) await page.screenshot({ path: output + '/quizvraag.png' });
      await page.locator('#answers button').first().click();
      await page.locator('#next').waitFor();
      await page.locator('#next').click();
      assert.match(await page.locator('#position').textContent(), /Vraag 2/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(width + 'px: zeven categorieën, regels, selecties, voortgang en antwoordfeedback');
    }
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
