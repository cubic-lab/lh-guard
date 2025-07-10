import puppeteer, { Page } from "puppeteer";
import { parseArgs } from "util";
import lighthouse from "lighthouse";
import path from "path";
import { formatScore, utcnow } from "./libs/utils.js"; 
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";

const LH_BASE_DIR = 'lh'
const LH_REPORT_FILE_NAME = 'lh-report.html';
const LH_SCORES_FILE_NAME = 'lh-scores.json';
const SUPABASE_BUCKET = 'guards';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

interface Scores {
  generatedAt: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

type Env = string;
type Operator = string;
type LHConfig = Record<Env, Record<Operator, {url: string}>>;

async function loadConfig(): Promise<LHConfig> {
  const fp = path.join(process.cwd(), LH_BASE_DIR, `lh-conf.json`);
  const buffer = await fs.readFile(fp, 'utf-8');

  return JSON.parse(buffer);
}

async function runlh(page: Page, url: string) {
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
  const { lhr: { categories }, report } = result;
  const performance = formatScore(categories.performance?.score);
  const accessibility = formatScore(categories.accessibility?.score);
  const bestPractices = formatScore(categories['best-practices']?.score);
  const seo = formatScore(categories.seo?.score);
  const scores = {
    performance, 
    accessibility, 
    bestPractices, 
    seo,
    generatedAt: utcnow(),
  }

  console.log('start to generate report files...');

  const reportFile = path.join(process.cwd(), LH_BASE_DIR, LH_REPORT_FILE_NAME);
  await fs.writeFile(reportFile, report);
  const scoresFile = path.join(process.cwd(), LH_BASE_DIR, LH_SCORES_FILE_NAME);
  await fs.writeFile(scoresFile, JSON.stringify(scores));

  console.log(`finish to run lighthouse for: ${url}`);

  return scores;
}

async function checkScores(current: Scores, previous: Scores) {
  console.log('checking scores...');
  const { performance, accessibility, bestPractices, seo } = current;

  if (performance < previous.performance) {
    console.warn(`failed on performance: current=${performance}, prev=${previous.performance}`);
    return false;
  }
  if (accessibility < previous.accessibility) {
    console.warn(`failed on accessibility: current=${accessibility}, prev=${previous.accessibility}`);
    return false;
  }
  if (bestPractices < previous.bestPractices) {
    console.warn(`failed on bestPractices: current=${bestPractices}, prev=${previous.bestPractices}`);
    return false;
  }
  if (seo < previous.seo) {
    console.warn(`failed on seo: current=${seo}, prev=${previous.seo}`);
    return false;
  }
  console.log('scores checked and passed');
  return true;
}

async function fetchPrevScores(env: string, operator: string): Promise<Scores|null> {
  const objectName = `${operator}-${env}.scores.json`;
  console.log('start to fetch prev scores from supabase', objectName);
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(objectName);

  if (error) {
    console.error('failed to fetch prev scores', error);
    return null;
  }
  console.log('finish to fetch prev scores from supabase', objectName);
  const content = await data.text();

  return JSON.parse(content);
}

async function storeScores(env: string, operator: string, scores: Scores) {
  const objectName = `${operator}-${env}.scores.json`;
  console.log('start to upload object to supabase', objectName);
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(objectName, JSON.stringify(scores), {
    upsert: true
  });

  if (error) {
    console.error('failed to store scores', error.message);
    return;
  }
  console.log('finish to upload object to supabase', objectName);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv,
    strict: true,
    allowPositionals: true,
    options: {
      env: {
        type: 'string',
      },
      operator: {
        type: 'string'
      },
    }
  });

  const { env: envFromArg, operator: operatorFromArg } = values;
  const env = envFromArg || process.env.ENV;
  const operator = operatorFromArg || process.env.OPERATOR;

  if (!env) {
    throw new Error('--env is required');
  }
  if (!operator) {
    throw new Error('--operator is required');
  }
  const config = await loadConfig();
  const url = config[env]?.[operator]?.url;

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
  let scores = null;
  try {
    const page = await browser.newPage();
    scores = await runlh(page, url);
    console.log(`the result of current scores is: ${JSON.stringify(scores)}`);
    const prevScores = await fetchPrevScores(env, operator);
    if (!prevScores) {
      console.warn('No prev scores file found');
      return;
    }
    console.log(`the result of previous scores is: ${JSON.stringify(prevScores)}`);
    if (!checkScores(scores, prevScores)) {
      throw new Error('lighthouse audit get failed');
    }
  } finally {
    if (scores) {
      await storeScores(env, operator, scores);
    }
    browser.close();
  }
}

main()