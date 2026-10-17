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
      await page.locator(`.case-lbl[data-part="${part}"]`).click();
      await page.waitForFunction(part => document.querySelector('.server-canvas').dataset.focus === part, part);
      const progressing = await page.locator('.server-canvas').evaluate((el, part) => {
        const key = `detail${part[0].toUpperCase()}${part.slice(1)}`;
        return { counts: el.dataset[key].split('/').map(Number), distance: Number(el.dataset.cameraDistance) };
      }, part);
      assert.ok(progressing.counts[0] < progressing.counts[1] && progressing.counts[1] > 0, 'L2 begins with a partial stroke set');
      await page.waitForFunction(part => {
        const d = document.querySelector('.server-canvas').dataset;
        const counts = d[`detail${part[0].toUpperCase()}${part.slice(1)}`].split('/').map(Number);
        return Number(d.focusExtent) <= 0.841 && counts[0] === counts[1];
      }, part);
      assert.ok(await page.locator('.server-canvas').evaluate(el => Number(el.dataset.cameraDistance) < 225),
        `${width}px ${part}: focus should still move closer than overview`);
      for (const other of parts.filter(p => p !== part)) {
        const count = await page.locator('.server-canvas').evaluate((el, part) => el.dataset[`detail${part[0].toUpperCase()}${part.slice(1)}`], other);
        assert.equal(Number(count.split('/')[0]), 0, 'inactive details must be hidden');
      }
      assert.equal(await page.locator('.case-card.is-show').getAttribute('data-active-part'), part);
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
          labelsClear: [...document.querySelectorAll('.case-lbl')].filter(el => el !== label).every(el => {
            const r = el.getBoundingClientRect();
            return r.right <= c.left || r.left >= c.right || r.bottom + 12 <= c.top || r.top - 12 >= c.bottom;
          }),
          inside: c.left >= stage.left && c.right <= stage.right + 1 && c.top >= stage.top && c.bottom <= stage.bottom + 1,
          overflow: document.documentElement.scrollWidth > innerWidth,
          clear: c.right + 20 <= canvas.left || c.left - 20 >= canvas.right
            || c.bottom + 8 <= canvas.top || c.top - 8 >= canvas.bottom,
        };
      }, part);
      assert.ok(geometry.hidden && geometry.edge < 1 && geometry.connected && geometry.labelsClear && geometry.inside && !geometry.overflow && geometry.clear,
        `${width}px ${part}: ${JSON.stringify(geometry)}`);
      if (part === 'cpu' && [1440, 390].includes(width)) {
        await page.screenshot({ path: join(tmpdir(), `server-callout-${width}.png`), fullPage: true });
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.case-card.is-show').count(), 0);
      await page.waitForFunction(() => Number(document.querySelector('.server-canvas').dataset.cameraDistance) === 225);
      assert.equal(await page.locator('.server-canvas').getAttribute('data-context'), '0.000',
        'context restoration must finish with the returning camera, without a delayed tail');
      const count = await page.locator('.server-canvas').evaluate((el, part) => el.dataset[`detail${part[0].toUpperCase()}${part.slice(1)}`], part);
      assert.equal(Number(count.split('/')[0]), 0, 'closing retracts detail strokes');
    }
    console.log(`PASS: ${width}px — five focus transitions, L2 drawing/retraction, cards clear every other label.`);
  }
  // 镜头归位后的画面必须稳定，不能再延迟补出结构或切换遮挡。
  await page.locator('.server-canvas').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);
  const returned = await page.locator('.server-canvas').screenshot();
  await page.waitForTimeout(1000);
  const late = await page.locator('.server-canvas').screenshot();
  const changedRatio = await page.evaluate(async ({ before, after }) => {
    const pixels = async source => {
      const img = new Image();
      img.src = `data:image/png;base64,${source}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    };
    const a = await pixels(before), b = await pixels(after);
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 16) changed++;
    }
    return changed / (a.length / 4);
  }, { before: returned.toString('base64'), after: late.toString('base64') });
  // 容忍 GPU 抗锯齿的少量像素噪声，结构迟现应远超此阈值。
  assert.ok(changedRatio < 0.001, `late overview changes: ${(changedRatio * 100).toFixed(4)}%`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.server-case.is-drawn').waitFor({ timeout: 3000 });
  await page.locator('.case-lbl[data-part="gpu"]').click();
  await page.waitForFunction(() => {
    const d = document.querySelector('.server-canvas').dataset;
    const [n, total] = d.detailGpu.split('/').map(Number);
    return Number(d.focusExtent) <= 0.841 && n === total;
  });
  // 已选状态跨断点 resize、拖转、连续放大：整个显卡保持在安全范围内。
  for (const width of [768, 320, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.waitForFunction(() => Number(document.querySelector('.server-canvas').dataset.focusExtent) <= 0.841);
    const box = await page.locator('.server-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(1500);
    assert.ok(await page.locator('.server-canvas').evaluate(el => Number(el.dataset.focusExtent) <= 0.841),
      `${width}px: selected component remains inside canvas after rotation and zoom`);
  }
  await page.locator('.case-card-close').click();
  assert.equal(await page.locator('.case-card.is-show').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: orthogonal leaders; 90-frame settling; idle stability; focus and L2 for 5 parts × 4 viewports; cards clear model and labels; reduced motion; no browser errors.');
} finally {
  await browser.close();
}
