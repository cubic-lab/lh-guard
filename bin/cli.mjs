#!/usr/bin/env node

import { parseArgs } from "util";
import { runGuard } from '../cmd/run-guard.mjs';

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

runGuard(env, operator);