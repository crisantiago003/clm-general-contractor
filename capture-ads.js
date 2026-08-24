const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML_PATH = 'file:///tmp/claude-0/-home-user-clm-general-contractor/28473b0a-0e92-514c-a4d5-c3747993da6e/scratchpad/konstrukt-ads.html';
const OUT_DIR = path.join(__dirname, 'ads');

const SLIDE_NAMES = [
  '01-hero-launch',
  '02-invoices-orders',
  '03-project-management',
  '04-inventory-materials',
  '05-payroll-workforce',
  '06-analytics-dashboard',
  '07-cloud-offline',
  '08-roles-security',
  '09-cta-closing'
];

async function capture(viewport, suffix, scale) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport });
  await page.goto(HTML_PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  if (scale && scale !== 1) {
    await page.addStyleTag({
      content: `.slide { transform: scale(${scale}); transform-origin: top left; }`
    });
    await page.waitForTimeout(500);
  }

  const slides = await page.$$('.slide');
  console.log(`Found ${slides.length} slides for ${suffix} (${viewport.width}x${viewport.height}, scale=${scale || 1})`);

  for (let i = 0; i < slides.length; i++) {
    const name = SLIDE_NAMES[i] || `slide-${i + 1}`;
    const outPath = path.join(OUT_DIR, `${name}-${suffix}.jpg`);

    await slides[i].scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const clipW = scale ? Math.round(1080 * scale) : 1080;
    const clipH = scale ? Math.round(1920 * scale) : 1920;

    const box = await slides[i].boundingBox();
    if (!box) { console.log(`  Skipping ${name} - no bounding box`); continue; }

    await page.screenshot({
      path: outPath,
      type: 'jpeg',
      quality: 95,
      clip: {
        x: box.x,
        y: box.y,
        width: clipW,
        height: clipH
      }
    });
    console.log(`  Saved: ${outPath} (${clipW}x${clipH})`);
  }

  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n=== Capturing DESKTOP (PC) versions ===');
  await capture({ width: 1080, height: 1920 }, 'pc', 1);

  console.log('\n=== Capturing MOBILE versions ===');
  const mobileScale = 430 / 1080;
  await capture({ width: 1080, height: 1920 }, 'mobile', mobileScale);

  console.log(`\nDone! Files saved to: ${OUT_DIR}`);
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.jpg'));
  console.log(`Total files: ${files.length}`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(0)} KB)`);
  });
})().catch(e => { console.error(e); process.exit(1); });
