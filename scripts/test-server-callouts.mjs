// Requires external Playwright and a running dev server; no new dependency.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : { channel: 'msedge' });
const site = process.env.SITE_URL || 'http://localhost:4322';
const parts = ['cpu', 'gpu', 'ram', 'mb', 'psu'];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${site}/server`);
  await page.locator('.server-case.is-drawn').waitFor();
  await page.waitForTimeout(700);
  const snapshot = () => page.$$eval('.case-lead', els => els.map(el => el.getAttribute('points')));
  const initial = await snapshot();
  for (const points of initial) {
    const p = points.split(' ').map(point => point.split(',').map(Number));
    assert.equal(p.length, 4);
    assert.equal(p[0][1], p[1][1], 'horizontal segment leaving component');
    assert.equal(p[1][0], p[2][0], 'vertical elbow');
    assert.equal(p[2][1], p[3][1], 'horizontal segment entering label');
  }
  const bounds = await page.locator('.server-case').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 110, bounds.y + bounds.height / 2, { steps: 20 });
  await page.mouse.up();
  // During damping, every projected anchor must progress in one direction.
  const samples = await page.evaluate(() => new Promise(resolve => {
    const frames = [];
    const sample = () => {
      frames.push([...document.querySelectorAll('.case-anchor-core')].map(el => Number(el.getAttribute('cx'))));
      if (frames.length < 90) requestAnimationFrame(sample); else resolve(frames);
    };
    requestAnimationFrame(sample);
  }));
  for (let i = 0; i < 5; i++) {
    const direction = Math.sign(samples.at(-1)[i] - samples[0][i]);
    for (let f = 1; f < samples.length; f++) {
      assert.ok((samples[f][i] - samples[f - 1][i]) * direction >= 0, 'anchor must not oscillate during settling');
    }
  }
  assert.notDeepEqual(await snapshot(), initial, 'leaders follow drag');
  await page.waitForTimeout(1800); // Allow the bounded camera damping to finish.
  const settled = await snapshot();
  await page.waitForTimeout(1200);
  assert.deepEqual(await snapshot(), settled, 'settled leaders remain still');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.waitForTimeout(200);
    const clearance = await page.evaluate(() => {
      const canvas = document.querySelector('.server-canvas').getBoundingClientRect();
      const labels = [...document.querySelectorAll('.case-lbl')].map(el => el.getBoundingClientRect());
      const lanes = [...document.querySelectorAll('g[data-part]')].map(el => {
        const points = el.querySelector('.case-lead').points;
        return { key: el.getAttribute('data-part'), x: points.getItem(1).x };
      });
      return {
        separate: labels.every(r => r.right + 20 <= canvas.left || r.left - 20 >= canvas.right
          || r.bottom + 20 <= canvas.top || r.top - 20 >= canvas.bottom),
        leftLanes: Math.abs(lanes.find(l => l.key === 'gpu').x - lanes.find(l => l.key === 'mb').x),
        rightLanes: new Set(lanes.filter(l => ['cpu', 'ram', 'psu'].includes(l.key)).map(l => l.x)).size,
      };
    });
    assert.ok(clearance.separate, `${width}px: labels must clear model canvas by at least 20px`);
    assert.ok(clearance.leftLanes >= 20 && clearance.rightLanes === 3, 'parts must use separate elbow lanes');
    if ([1440, 390].includes(width)) {
      await page.screenshot({ path: join(tmpdir(), `server-labels-${width}.png`), fullPage: true });
    }
    for (const part of parts) {
      const before = await snapshot();
      await page.locator(`.case-lbl[data-part="${part}"]`).click();
      await page.waitForTimeout(50);
      assert.equal(await page.locator('.case-card.is-show').getAttribute('data-active-part'), part);
      assert.deepEqual(await snapshot(), before, 'opening card must preserve entire leader geometry');
      const geometry = await page.evaluate(part => {
        const label = document.querySelector(`.case-lbl[data-part="${part}"]`);
        const card = document.querySelector('.case-card');
        const stage = document.querySelector('.server-case').getBoundingClientRect();
        const l = label.getBoundingClientRect(), c = card.getBoundingClientRect();
        const canvas = document.querySelector('.server-canvas').getBoundingClientRect();
        const points = document.querySelector(`g[data-part="${part}"] .case-lead`).points;
        const endpoint = points.getItem(points.numberOfItems - 1);
        const left = part === 'gpu' || part === 'mb';
        return {
          hidden: getComputedStyle(label).visibility === 'hidden',
          edge: Math.abs(left ? c.right - l.right : c.left - l.left),
          connected: stage.y + endpoint.y >= c.top && stage.y + endpoint.y <= c.bottom,
          labelConnection: Math.abs(stage.y + endpoint.y - (l.top + l.height / 2)) < 1,
          inside: c.left >= stage.left && c.right <= stage.right + 1 && c.top >= stage.top && c.bottom <= stage.bottom + 1,
          overflow: document.documentElement.scrollWidth > innerWidth,
          clear: c.right + 20 <= canvas.left || c.left - 20 >= canvas.right
            || c.bottom + 8 <= canvas.top || c.top - 8 >= canvas.bottom,
        };
      }, part);
      assert.ok(geometry.hidden && geometry.edge < 1 && geometry.connected && geometry.labelConnection && geometry.inside && !geometry.overflow && geometry.clear,
        `${width}px ${part}: ${JSON.stringify(geometry)}`);
      if (part === 'cpu' && [1440, 390].includes(width)) {
        await page.screenshot({ path: join(tmpdir(), `server-callout-${width}.png`), fullPage: true });
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.case-card.is-show').count(), 0);
      assert.deepEqual(await snapshot(), before, 'closing restores label without moving leader');
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.server-case.is-drawn').waitFor({ timeout: 3000 });
  await page.locator('.case-lbl[data-part="gpu"]').click();
  await page.locator('.case-card-close').click();
  assert.equal(await page.locator('.case-card.is-show').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: orthogonal leaders; 90-frame settling; idle stability; fixed endpoints and card bounds for 5 parts × 4 viewports; reduced motion; no browser errors.');
} finally {
  await browser.close();
}
