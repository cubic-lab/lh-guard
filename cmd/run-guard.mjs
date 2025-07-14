import puppeteer, { Page } from "puppeteer";
import lighthouse from "lighthouse";
import path from "path";
import { formatScore, urlOfRotationDomain, utcnow, formatValue } from "../libs/utils.mjs"; 
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import "dotenv/config";

const LH_BASE_DIR = 'lh'
const LH_REPORT_FILE_NAME = 'lh-report.html';
const LH_METRICS_FILE_NAME = 'lh-metrics.json';
const SUPABASE_BUCKET = 'guards';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

/**
 * @param {string} env 
 * @param {string} operator 
 * @returns 
 */
export async function runGuard(env, operator) {
  const config = await loadConfig();
  const url = config[env]?.[operator]?.url;
  const domainRotation = config[env]?.[operator]?.domainRotation;

  if (!url) {
    throw new Error(`failed to get url from config via operator: ${operator} and env: ${env}`);
  }

  // Use Puppeteer to launch headless Chrome
  // - Omit `--enable-automation` (See https://github.com/GoogleChrome/lighthouse/issues/12988)
  // - Don't use 800x600 default viewport
  const browser = await puppeteer.launch({
    // Set to false if you want to see the script in action.
    headless: true,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ["disable-gpu","--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  let metrics = null;
  try {
    const page = await browser.newPage();
    let runUrl = url;

    if (domainRotation) {
      await page.goto(url);
      runUrl = urlOfRotationDomain(page);
    }

    metrics = await runlh(page, runUrl);
    console.log(`the result of current metrics is: ${JSON.stringify(metrics)}`);
    const prevMetrics = await getPrevMetrics(env, operator);
    if (!prevMetrics) {
      console.warn('No prev metrics file found');
      return;
    }
    console.log(`the result of previous metrics is: ${JSON.stringify(prevMetrics)}`);
    if (!checkPerf(metrics, prevMetrics)) {
      throw new Error('lighthouse audit get failed');
    }
  } finally {
    if (metrics) {
      await storeMetrics(env, operator, metrics);
    }
    await browser.close();
  }
}

/**
 * @returns {Promise<LHConfig>}
 */
async function loadConfig() {
  const fp = path.join(process.cwd(), LH_BASE_DIR, `lh-conf.json`);
  const buffer = await fs.readFile(fp, 'utf-8');

  return JSON.parse(buffer);
}

/**
 * @param {Page} page 
 * @param {string} url 
 * @returns {Promise<Metrics>}
 */
async function runlh(page, url) {
  console.log(`start to run lighthouse for: ${url}`);

  const result = await lighthouse(url, {
    logLevel: 'error',
  }, {
    extends: 'lighthouse:default',
    settings: {
      output: 'html',
    }
  }, page);
  if (!result) {
    throw new Error('failed to get lighthouse result');
  }
  const { lhr: { categories, audits }, report } = result;
  const performance = formatScore(categories.performance?.score);
  const accessibility = formatScore(categories.accessibility?.score);
  const bestPractices = formatScore(categories['best-practices']?.score);
  const seo = formatScore(categories.seo?.score);
  const fcp = formatValue(audits['first-contentful-paint']?.numericValue);
  const lcp = formatValue(audits['largest-contentful-paint']?.numericValue);
  const tbt = formatValue(audits['total-blocking-time']?.numericValue);
  const cls = formatValue(audits['cumulative-layout-shift']?.numericValue);
  const si = formatValue(audits['speed-index']?.numericValue);

  const metrics = {
    performance, 
    accessibility, 
    bestPractices, 
    seo,
    fcp,
    lcp,
    tbt,
    cls,
    si,
    generatedAt: utcnow(),
  };

  console.log('start to generate report files...');

  const reportFile = path.join(process.cwd(), LH_BASE_DIR, LH_REPORT_FILE_NAME);
  await fs.writeFile(reportFile, report);
  const metricsFile = path.join(process.cwd(), LH_BASE_DIR, LH_METRICS_FILE_NAME);
  await fs.writeFile(metricsFile, JSON.stringify(metrics));

  console.log(`finish to run lighthouse for: ${url}`);

  return metrics;
}

/**
 * @param {Metrics} current 
 * @param {Metrics} previous 
 * @returns {boolean}
 */
async function checkPerf(current, previous) {
  console.log('checking performance metrics...');
  const { fcp, lcp, tbt, cls, si } = current;
  const { fcp: prevFcp, lcp: prevLcp, tbt: prevTbt, cls: prevCls, si: prevSi } = previous;

  if (fcp > prevFcp) {
    console.warn(`failed on fcp: current=${fcp}, prev=${prevFcp}`);
    return false;
  }
  if (lcp > prevLcp) {
    console.warn(`failed on lcp: current=${lcp}, prev=${prevLcp}`);
    return false;
  }
  if (tbt > prevTbt) {
    console.warn(`failed on tbt: current=${tbt}, prev=${prevTbt}`);
    return false;
  }
  if (cls > prevCls) {
    console.warn(`failed on cls: current=${cls}, prev=${prevCls}`);
    return false;
  }
  if (si > prevSi) {
    console.warn(`failed on si: current=${si}, prev=${prevSi}`);
    return false;
  }
  console.log('metrics checked and passed');
  return true;
}

/**
 * @param {string} env 
 * @param {string} operator 
 * @returns 
 */
async function getPrevMetrics(env, operator) {
  const objectName = getMetricsObject(env, operator);
  console.log('start to fetch prev metrics from supabase', objectName);
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(objectName);

  if (error) {
    console.error('failed to fetch prev metrics', error);
    return null;
  }
  console.log('finish to fetch prev scores from supabase', objectName);
  const content = await data.text();

  return JSON.parse(content);
}

/**
 * 
 * @param {string} env
 * @param {string} operator 
 * @param {*} metrics 
 * @returns 
 */
async function storeMetrics(env, operator, metrics) {
  const objectName = getMetricsObject(env, operator);
  console.log('start to upload object to supabase', objectName);
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(objectName, JSON.stringify(metrics), {
    upsert: true
  });

  if (error) {
    console.error('failed to store metrics', error.message);
    return;
  }
  console.log('finish to upload object to supabase', objectName);
}

/**
 * @param {string} env 
 * @param {string} operator 
 * @returns {string}
 */
function getMetricsObject(env, operator) {
  return `${operator}-${env}.metrics.json`;
}