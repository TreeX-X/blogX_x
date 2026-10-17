import assert from 'node:assert/strict';
// Requires external Playwright and a running dev server; no new dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE
 ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {channel:'msedge',headless:true});
const site=process.env.SITE_URL || 'http://localhost:4322';
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${site}/server`);
 await page.locator('.server-case.is-drawn').waitFor();
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:960});
  for(const part of ['cpu','gpu','ram']) {
   await page.locator(`.case-lbl[data-part="${part}"]`).click();
   await page.waitForFunction(part=>document.querySelector('.server-canvas').dataset.focus===part,part);
   const samples=await page.evaluate(()=>new Promise(resolve=>{
    const frames=[], start=performance.now();
    const sample=()=>{
     const card=document.querySelector('.case-card'),canvas=document.querySelector('.server-canvas');
     const p=Number(card.style.getPropertyValue('--focus-progress'));
     frames.push({p,opacity:Number(getComputedStyle(card).opacity),distance:Number(canvas.dataset.cameraDistance),scale:new DOMMatrix(getComputedStyle(card).transform).a});
     if(performance.now()-start<1150)requestAnimationFrame(sample);else resolve(frames);
    };requestAnimationFrame(sample);
   }));
   const end=samples.at(-1).distance;
   for(let i=0;i<samples.length;i++) {
    const s=samples[i];
    assert.ok(Math.abs(s.opacity-s.p)<0.00001);
    assert.ok(Math.abs(s.distance-(225+(end-225)*s.p))<0.025,'card and camera must share eased progress');
    assert.ok(s.scale<=1.00001&&s.scale>=0.9799,'no overshoot');
    if(i)assert.ok(s.p>=samples[i-1].p);
   }
   assert.equal(samples.at(-1).p,1);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.querySelector('.server-canvas').dataset.cameraDistance==='225.00');
   console.log('PASS',width,part,'same-frame progress, opacity, no bounce, synchronized finish');
  }
 }
 await page.locator('.case-lbl[data-part="cpu"]').click();
 await page.waitForTimeout(200);
 await page.locator('.case-lbl[data-part="gpu"]').click();
 await page.waitForTimeout(1200);
 assert.equal(await page.locator('.case-card').getAttribute('data-active-part'),'gpu');
 assert.equal(await page.locator('.case-card').evaluate(el=>el.style.getPropertyValue('--focus-progress')),'1');
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'}); await page.reload();
 await page.locator('.server-case.is-drawn').waitFor();
 await page.locator('.case-lbl[data-part="ram"]').click();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('.case-card').evaluate(el=>getComputedStyle(el).opacity),'1');
 assert.equal(await page.locator('.case-card').evaluate(el=>getComputedStyle(el).transform),'none');
 assert.deepEqual(errors,[]);
 console.log('PASS rapid switch, reduced motion, no browser errors');
} finally {await browser.close();}
