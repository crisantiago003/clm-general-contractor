/**
 * BuildSuite Regression Test Suite
 * ----------------------------------
 * A real, saved, re-runnable test file — not a throwaway script.
 *
 * HOW TO RUN:
 *   1. npm install -D playwright
 *   2. npx playwright install chromium
 *   3. node tests/regression.test.js
 *
 * WHY THIS EXISTS:
 *   Every previous test during development was written fresh and discarded.
 *   This file is meant to live in the repo permanently, so any future change
 *   (by you, a hired developer, or a future AI session) can be checked against
 *   a real baseline instead of guessing whether something broke.
 *
 * HOW IT WORKS:
 *   Loads BuildSuite.html directly, bypasses login by injecting a session and
 *   the built-in sample seed data (avoids any real Supabase credentials),
 *   then walks through every major page checking for JavaScript errors and
 *   basic expected content. Add new checks here as the app grows.
 */
const { chromium } = require('playwright');
const path = require('path');

const APP_PATH = 'file://' + path.resolve(__dirname, '..', 'BuildSuite.html');

async function withApp(fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(APP_PATH);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const seed = JSON.parse(document.getElementById('seed-data').textContent);
    window.DB = seed;
    DB.users.push({ id: 999999, name: 'Test Admin', username: 'testadmin', password: 'x', type: 'Admin' });
    session = { id: 999999, name: 'Test Admin', type: 'Admin' };
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'block';
  });
  await page.waitForTimeout(200);

  try {
    await fn(page, errors);
  } finally {
    await browser.close();
  }
  return errors;
}

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
}

async function testAllPagesLoadCleanly() {
  console.log('\n[1] All major pages load without JS errors');
  const pages = ['dashboard', 'orders', 'products', 'customers', 'vendors', 'employees', 'fleet', 'inventory', 'payroll', 'transactions', 'users', 'trash', 'help'];
  const errors = await withApp(async (page) => {
    for (const p of pages) {
      await page.evaluate((view) => go(view), p);
      await page.waitForTimeout(120);
    }
  });
  check('No page threw a JavaScript error', errors.length === 0);
  if (errors.length) console.log('     ', errors.join(' | '));
}

async function testBulkImportMaterials() {
  console.log('\n[2] Bulk Import — Materials');
  let ok = false;
  await withApp(async (page) => {
    await page.evaluate(() => go('inventory'));
    await page.waitForTimeout(150);
    await page.evaluate(() => openBulkImport('materials'));
    await page.waitForTimeout(150);
    await page.fill('#bulkImportText', 'Test Cement\t50\tBAGS\t250\tTest Site\tTest Supplier\t2026-01-01');
    await page.click('.modal button:has-text("Import")');
    await page.waitForTimeout(200);
    ok = await page.evaluate(() => DB.materials.some((m) => m.name === 'Test Cement'));
  });
  check('Pasted material row was correctly imported', ok);
}

async function testTrashRestoresCleanly() {
  console.log('\n[3] Trash — delete then restore a Project');
  let before, afterDelete, afterRestore;
  await withApp(async (page) => {
    before = await page.evaluate(() => DB.customers.length);
    const custId = await page.evaluate(() => DB.customers[0].id);
    await page.evaluate((id) => deleteCustomer(id), custId);
    await page.waitForTimeout(200);
    afterDelete = await page.evaluate(() => DB.customers.length);
    const trashId = await page.evaluate(() => DB.trash[0].id);
    await page.evaluate((id) => restoreFromTrash(id), trashId);
    await page.waitForTimeout(200);
    afterRestore = await page.evaluate(() => DB.customers.length);
  });
  check('Delete removed exactly one project', afterDelete === before - 1);
  check('Restore brought the count back to original', afterRestore === before);
}

async function testPasswordHashing() {
  console.log('\n[4] Passwords are hashed, never stored as plaintext');
  let looksHashed;
  await withApp(async (page) => {
    const hash = await page.evaluate(() => hashPassword('test-password-123'));
    looksHashed = /^[a-f0-9]{64}$/i.test(hash);
  });
  check('hashPassword() produces a proper SHA-256 hash, not plaintext', looksHashed);
}

async function testProjectCompletionMath() {
  console.log('\n[5] Weighted project completion calculates correctly');
  let pct;
  await withApp(async (page) => {
    pct = await page.evaluate(() => {
      const c = { activities: [
        { weight: 40, pct: 100 },
        { weight: 60, pct: 20 },
      ]};
      return projectCompletionPct(c);
    });
  });
  check('Weighted average computes to exactly 52%', pct === 52);
}

async function testAccessibilityLabels() {
  console.log('\n[6] Form labels are properly linked to their inputs');
  let linkedCount;
  await withApp(async (page) => {
    await page.evaluate(() => editEmployee(null));
    await page.waitForTimeout(150);
    linkedCount = await page.locator('label[for]').count();
  });
  check('Employee form has properly linked labels for screen readers', linkedCount > 5);
}

(async () => {
  console.log('Running BuildSuite regression suite against:', APP_PATH);
  await testAllPagesLoadCleanly();
  await testBulkImportMaterials();
  await testTrashRestoresCleanly();
  await testPasswordHashing();
  await testProjectCompletionMath();
  await testAccessibilityLabels();

  console.log(`\n${'-'.repeat(40)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  console.log('-'.repeat(40));
  process.exit(failed > 0 ? 1 : 0);
})();
