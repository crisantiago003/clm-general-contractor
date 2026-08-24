const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML_PATH = 'file:///tmp/claude-0/-home-user-clm-general-contractor/28473b0a-0e92-514c-a4d5-c3747993da6e/scratchpad/konstrukt-device-ads.html';
const OUT_DIR = path.join(__dirname, 'ads', 'devices');

const SLIDE_NAMES = [
  '01-every-device',
  '02-desktop',
  '03-laptop',
  '04-tablet',
  '05-phone',
  '06-browsers-os',
  '07-install-pwa',
  '08-all-features',
  '09-cta-devices'
];

async function capture(suffix, scale) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(HTML_PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  if (scale !== 1) {
    await page.addStyleTag({
      content: `.slide { transform: scale(${scale}); transform-origin: top left; }`
    });
    await page.waitForTimeout(600);
  }

  const slides = await page.$$('.slide');
  const w = Math.round(1080 * scale);
  const h = Math.round(1920 * scale);
  console.log(`${slides.length} slides -> ${suffix} (${w}x${h})`);

  for (let i = 0; i < slides.length; i++) {
    const name = SLIDE_NAMES[i] || `slide-${i + 1}`;
    const outPath = path.join(OUT_DIR, `${name}-${suffix}.jpg`);

    await slides[i].scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const box = await slides[i].boundingBox();
    if (!box) { console.log(`  skip ${name}`); continue; }

    await page.screenshot({
      path: outPath,
      type: 'jpeg',
      quality: 95,
      clip: { x: box.x, y: box.y, width: w, height: h }
    });
    console.log(`  ${name}-${suffix}.jpg`);
  }

  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n=== PC (1080x1920) ===');
  await capture('pc', 1);

  console.log('\n=== MOBILE (430x764) ===');
  await capture('mobile', 430 / 1080);

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.jpg')).sort();
  console.log(`\nDone. ${files.length} files in ${OUT_DIR}`);
  files.forEach(f => {
    const s = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${(s.size / 1024).toFixed(0)} KB)`);
  });
})().catch(e => { console.error(e); process.exit(1); });
