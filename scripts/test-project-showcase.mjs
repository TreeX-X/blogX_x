// Requires an external Playwright installation and a running dev server.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {});
const site = process.env.SITE_URL || 'http://127.0.0.1:4321';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(`${site}/about`);
  const cards = page.locator('.project-showcase');
  assert.equal(await cards.count(), 2);
  await cards.first().scrollIntoViewIfNeeded();
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await card.locator('.project-media img').evaluate(img => img.decode());
  }
  await page.locator('astro-island[component-url*="ProjectPreview"]:not([ssr])').first().waitFor();
  assert.equal(requests.filter(url => /\.gif(?:$|\?)/i.test(url)).length, 0);
  assert.equal(requests.filter(url => /api\.github\.com|raw\.githubusercontent\.com/.test(url)).length, 0);
  const preview = cards.first().locator('.project-media img');
  const poster = await preview.getAttribute('src');
  await cards.first().getByRole('button', { name: '播放演示' }).click();
  await page.waitForFunction(() => document.querySelector('.project-media img')?.getAttribute('src').endsWith('.gif'));
  await cards.first().getByRole('button', { name: '停止演示' }).click();
  assert.equal(await preview.getAttribute('src'), poster);
  const details = cards.first().locator('details');
  await details.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await details.getAttribute('open'), '');
  assert.ok(await details.locator('h4').count() > 0);
  await details.locator('summary').click();
  await page.evaluate(() => document.activeElement.blur());
  const screenshotStyle = await page.addStyleTag({ content: '.site-header { visibility: hidden !important; } astro-dev-toolbar { display: none !important; }' });
  await page.locator('.project-showcase-grid').screenshot({ path: join(tmpdir(), 'blogx-projects-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500); // Allow the existing stagger entrance animation to settle.
  for (const card of await cards.all()) {
    const box = await card.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 391);
    const media = await card.locator('.project-media').boundingBox();
    const copy = await card.locator('.project-copy').boundingBox();
    assert.ok(copy.y + 1 >= media.y + media.height, JSON.stringify({ media, copy }));
  }
  await cards.first().screenshot({ path: join(tmpdir(), 'blogx-projects-mobile.png') });
  await screenshotStyle.evaluate(style => style.remove());
  assert.deepEqual(errors, []);
  const broken = await browser.newPage();
  await broken.route('**/projects/*preview.webp', route => route.abort());
  await broken.goto(`${site}/about`);
  await broken.locator('.project-showcase').first().scrollIntoViewIfNeeded();
  await broken.locator('.project-media-fallback').first().waitFor();
  assert.match(await broken.locator('.project-media-fallback').first().innerText(), /暂时无法加载/);
  await broken.close();
  console.log('PASS: real posters, deferred GIF, keyboard details, mobile layout, image failure fallback; no visitor GitHub fetch.');

  const admin = await browser.newPage();
  const snapshot = { summary: 'README 简介 <img src=x>', highlights: ['能力一'], sections: [{ title: '功能', text: '功能介绍' }], images: [{ url: 'https://example.com/cover.png', alt: '封面' }], sourceUrl: 'https://github.com/owner/repo/blob/abc/README.md', revision: 'abc', fetchedAt: new Date().toISOString() };
  const fixture = { slug: 'demo', title: '演示项目', repoUrl: 'https://github.com/owner/repo', description: '项目描述', tags: ['tool'], summary: '手动简介', coverImage: '/projects/janusx-preview.webp', readmeSnapshot: snapshot };
  const writes = [];
  let failReadme = false;
  await admin.route('**/api/admin/projects', route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: [fixture] });
    writes.push(request.postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await admin.route('**/api/admin/project-readme', route => route.fulfill(failReadme ? { status: 429, json: { error: 'GitHub 读取失败' } } : { json: snapshot }));
  await admin.goto(`${site}/admin/projects`);
  await admin.getByRole('button', { name: '编辑', exact: true }).click();
  await admin.locator('#readmeButton').click();
  await admin.waitForFunction(() => document.querySelector('#readmeStatus').textContent.startsWith('已读取'));
  assert.equal(writes.length, 0);
  assert.equal(await admin.locator('#f-summary').inputValue(), fixture.summary);
  assert.equal(await admin.locator('#f-cover').inputValue(), fixture.coverImage);
  assert.equal(await admin.locator('#readmePreview img').count(), 0);
  assert.match(await admin.locator('#readmePreview').innerText(), /<img src=x>/);
  failReadme = true;
  await admin.locator('#readmeButton').click();
  await admin.waitForFunction(() => document.querySelector('#readmeStatus').textContent.includes('读取失败'));
  assert.equal(await admin.locator('#f-summary').inputValue(), fixture.summary);
  await admin.locator('#f-url').fill('https://github.com/owner/another');
  await admin.locator('#saveProjectButton').click();
  assert.equal(writes.length, 0);
  assert.match(await admin.locator('#formError').innerText(), /仓库链接已变化/);
  await admin.locator('#f-url').fill(fixture.repoUrl);
  await admin.locator('#saveProjectButton').click();
  await admin.waitForFunction(() => document.querySelector('#actionError').textContent.includes('已保存'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].summary, fixture.summary);
  assert.equal(writes[0].coverImage, fixture.coverImage);
  assert.deepEqual(writes[0].readmeSnapshot, snapshot);
  console.log('PASS: mocked admin preview does not write, manual overrides survive refresh/failure, stale repository blocked, explicit save preserves snapshot, markup escaped.');
} finally { await browser.close(); }
