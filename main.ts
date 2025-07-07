import puppeteer, { Page } from "puppeteer";
import { parseArgs } from "util";
import lighthouse from "lighthouse";
import path from "path";
import { formatScore } from "@/libs/utils";

const LH_DIR = 'config';
const LH_CONF_FILE_NAME = 'lh.conf.json';
const LH_SCORES_FILE_NAME = 'scores.json';

interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

interface LHConfig {
  operators: Record<string, {url: string}>
}

async function loadConfig(): Promise<LHConfig> {
  const fp = path.join(LH_DIR, LH_CONF_FILE_NAME);
  return Bun.file(fp).json();
}

async function runlh(page: Page, {
  url,
}: {
  url: string;
}): Promise<Scores> {
  console.log(`start to run lighthouse for: ${url}`);

  const result = await lighthouse(url, {
    logLevel: 'info',
  }, {
    extends: 'lighthouse:default',
    settings: {
      output: 'html',
    }
  }, page);
  if (!result) {
    throw new Error('failed to get lighthouse result');
  }
  const { lhr: { categories } } = result;
  const performance = formatScore(categories.performance?.score);
  const accessibility = formatScore(categories.accessibility?.score);
  const bestPractices = formatScore(categories['best-practices']?.score);
  const seo = formatScore(categories.seo?.score);
  console.log(`finish to run lighthouse for: ${url}`);

  return {
    performance, 
    accessibility, 
    bestPractices, 
    seo
  }
}

async function checkScores(prevScoresUrl: string,
  {
    performance,
    accessibility,
    bestPractices,
    seo,
  }: Scores) {
  const prevScores = await getPrevScores(prevScoresUrl);

  if (performance < prevScores.performance) {
    throw new Error(`failed on performance: current=${performance}, prev=${prevScores.performance}`);
  }
  if (accessibility < prevScores.accessibility) {
    throw new Error(`failed on accessibility: current=${accessibility}, prev=${prevScores.accessibility}`);
  }
  if (bestPractices < prevScores.bestPractices) {
    throw new Error(`failed on bestPractices: current=${bestPractices}, prev=${prevScores.bestPractices}`);
  }
  if (seo < prevScores.seo) {
    throw new Error(`failed on seo: current=${seo}, prev=${prevScores.seo}`);
  }
}

async function getPrevScores(url: string): Promise<Scores> {
  return Bun.file(new URL(url)).json();
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      operator: {
        type: 'string'
      },
    }
  });

  const { operator } = values;

  if (!operator) {
    throw new Error('--operator is required');
  }
  const config = await loadConfig();
  const url = config.operators[operator]?.url;

  if (!url) {
    throw new Error(`failed to get url from ${LH_CONF_FILE_NAME} via operator: ${operator}`);
  }

  // Use Puppeteer to launch headless Chrome
  // - Omit `--enable-automation` (See https://github.com/GoogleChrome/lighthouse/issues/12988)
  // - Don't use 800x600 default viewport
  const browser = await puppeteer.launch({
    // Set to false if you want to see the script in action.
    headless: true,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation']
  });
  try {
    const page = await browser.newPage();
    const scores = await runlh(page, { url });
    console.log(`the result of current scores is: ${JSON.stringify(scores)}`);
    // await checkScores(scores);
  } finally {
    browser.close();
  }
}

main().catch(console.error)