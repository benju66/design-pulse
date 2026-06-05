/**
 * Playwright script to reproduce/verify the Coordination Board infinite re-render loop crash.
 * Navigates to the project Coordination view with 1,000 rows, navigates away, and back.
 * Monitors for React error #185 ("Maximum update depth exceeded").
 *
 * Usage:
 *   npx tsx src/scripts/loadTestRerender.ts <PROJECT_ID>
 *
 * Requires TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.local (see .env.local.example).
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Robust local env loading fallback if standard dotenv loading doesn't capture it
if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value.trim();
        }
      });
    }
  } catch (e) {
    console.warn('Could not read .env.local file', e);
  }
}

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

async function main() {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.error('❌ Error: Missing TEST_USER_EMAIL or TEST_USER_PASSWORD in env (see .env.local.example)');
    process.exit(1);
  }

  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/loadTestRerender.ts <PROJECT_ID>');
    process.exit(1);
  }

  const url = 'http://localhost:8000';
  console.log(`Launching Chromium browser to test on project: ${projectId}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      errors.push(`[Console Error] ${txt}`);
      console.error(`🔴 Console Error: ${txt}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`[Page Error] ${err.message}`);
    console.error(`🔴 Page Error: ${err.message}`);
  });

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url);

    console.log(`Logging in as ${TEST_USER_EMAIL}...`);
    await page.fill('input[type="email"], input[placeholder*="email" i]', TEST_USER_EMAIL);
    await page.fill('input[type="password"], input[placeholder*="password" i]', TEST_USER_PASSWORD);
    
    // Support both button text and submit inputs
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    console.log('Waiting for authentication and dashboard to load...');
    await page.waitForURL(/\/dashboard|\/project|\/sandbox/);
    console.log('✅ Logged in successfully.');

    // Direct navigation to target project
    const projectUrl = `${url}/project/${projectId}`;
    console.log(`Directly navigating to target project: ${projectUrl}...`);
    await page.goto(projectUrl);

    // Give it a moment to load project page
    await page.waitForSelector('button:has-text("Value Matrix")', { timeout: 30000 });
    console.log('✅ Project page loaded successfully.');

    let crashDetected = false;

    // Run navigate-away / navigate-back loop 3 times
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n🔄 Starting navigation cycle #${cycle}/3...`);

      // 1. Navigate to Coordination Board
      console.log('Clicking "Coordination Board" tab...');
      const coordBtn = page.locator('button:has-text("Coordination Board")');
      await coordBtn.click();

      console.log('Waiting for Coordination Board view to load (waiting for "Bulk Import" button)...');
      await page.waitForSelector('button:has-text("Bulk Import")', { timeout: 35000 });
      console.log('✅ Coordination Board loaded.');

      // Wait a moment for virtual table rendering and settle
      await page.waitForTimeout(3000);

      // Check console errors for React infinite re-render loop
      const crashError = errors.find(err => 
        err.includes('Maximum update depth exceeded') || 
        err.includes('Minified React error #185')
      );
      if (crashError) {
        console.error(`🔴 CRASH DETECTED on Coordination load: ${crashError}`);
        crashDetected = true;
        break;
      }

      // 2. Navigate Away to Value Matrix
      console.log('Clicking "Value Matrix" to navigate away...');
      const vmBtn = page.locator('button:has-text("Value Matrix")');
      await vmBtn.click();

      console.log('Waiting for Value Matrix view to settle (waiting for "+ New Item" button)...');
      await page.waitForSelector('button:has-text("+ New Item")', { timeout: 15000 });
      console.log('✅ Navigated away.');

      // Wait 2 seconds (user pause simulation)
      await page.waitForTimeout(2000);

      // Check again for errors
      const afterAwayCrash = errors.find(err => 
        err.includes('Maximum update depth exceeded') || 
        err.includes('Minified React error #185')
      );
      if (afterAwayCrash) {
        console.error(`🔴 CRASH DETECTED after navigating away: ${afterAwayCrash}`);
        crashDetected = true;
        break;
      }
    }

    if (crashDetected) {
      console.log('\n🔴 CRASH REPRODUCED: React #185 infinite re-render detected!');
      console.log('Full crash details:');
      console.log(errors.filter(e => e.includes('Maximum update depth') || e.includes('React error #185')).join('\n'));
    } else {
      console.log('\n🟢 NO CRASH: Coordination view survived navigate-away/back with 1,000 rows.');
    }

  } catch (err: any) {
    console.error('❌ Test script encountered an error:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
