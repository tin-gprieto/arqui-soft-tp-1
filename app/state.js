import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import operationQueue from "./queue.js";

let accounts = null;
let rates = null;
let log = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCOUNTS = "./state/accounts.json";
const RATES = "./state/rates.json";
const LOG = "./state/log.json";

export async function init() {
  // Initialize the operation queue
  await operationQueue.init();
  
  // Load data from queue
  const data = operationQueue.getData();
  accounts = data.accounts;
  rates = data.rates;
  log = data.log;

  console.log('State initialized with queue-based persistence');
}

export function getAccounts() {
  return accounts;
}

export function getRates() {
  return rates;
}

export function getLog() {
  return log;
}

