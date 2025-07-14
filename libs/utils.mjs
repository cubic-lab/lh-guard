import { Page } from "puppeteer";
import fs from 'fs/promises';

/**
 * @param {number | null | undefined} score
 * @param {number | undefined} fractionDigits
 * @returns {number}
 */
export function formatScore(score, fractionDigits = 2) {
  return parseFloat(((score || 0) * 100).toFixed(fractionDigits));
}

/**
 * 
 * @param {number | null | undefined} value 
 * @param {number | undefined} fractionDigits 
 */
export function formatValue(value, fractionDigits = 2) {
  if (value) {
    return parseFloat(value.toFixed(fractionDigits))
  }
  return value;
}

/**
 * @param {Page} page 
 * @returns {string}
 */
export function urlOfRotationDomain(page) {
  const newURL = new URL(page.url());
  const redirectUrl = [newURL.protocol, newURL.hostname].join('//');

  return redirectUrl;
}

/**
 * get utc datetime
 * @returns {string}
 */
export function utcnow() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = now.getUTCDate().toString().padStart(2, '0');
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  const seconds = now.getUTCSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 
 * @param {string} dir 
 * @returns {Promise<boolean>}
 */
export async function dirExists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch (error) {
    return false;
  }
}