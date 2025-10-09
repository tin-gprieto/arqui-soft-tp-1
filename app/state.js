import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCOUNTS = "./state/accounts.json";
const RATES = "./state/rates.json";
const LOG = "./state/log.json";

class DataManager {
  constructor() {
    this.accounts = new Map();        // id -> Account
    this.accountsByCurrency = new Map(); // currency -> Account
    this.accountsArray = [];         // For API responses and persistence
    this.rates = {};                  // Same structure as source JSON
    this.log = [];
    this.initialized = false;
    this.accountsTimer = null;
    this.ratesTimer = null;
    this.logTimer = null;
  }

  // Initialization
  async init() {
    if (this.initialized) return;
    
    try {
      const accounts = await this._loadData(ACCOUNTS);
      const rates = await this._loadData(RATES);
      const log = await this._loadData(LOG);

      this._indexAccounts(accounts);
      this._indexRates(rates);
      this._indexLog(log);

      this.initialized = true;
      this._startPeriodicSaving();
      console.log('DataManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataManager:', error);
      throw error;
    }
  }

  // Private helper methods
  async _loadData(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const raw = await fs.readFile(fullPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`File ${filePath} not found, using defaults`);
        return [];
      }
      throw error;
    }
  }

  _indexAccounts(accounts) {
    if (Array.isArray(accounts)) {
      this.accountsArray = [...accounts];
      accounts.forEach((account, index) => {
        this.accounts.set(account.id, index);
        this.accountsByCurrency.set(account.currency, index);
      });
    }
  }

  _indexRates(rates) {
    if (rates && typeof rates === 'object') {
      // Store rates in the same structure as source
      this.rates = rates;
    }
  }

  _indexLog(log) {
    if (Array.isArray(log)) {
      this.log = [...log];
    }
  }

  // Periodic saving methods (original approach)
  _startPeriodicSaving() {
    // Schedule saves like the original implementation
    this.accountsTimer = setInterval(async () => {
      await this._saveImmediately(this.accountsArray, './state/accounts.json');
    }, 1000); // 1 second for accounts

    this.ratesTimer = setInterval(async () => {
      await this._saveImmediately(this.rates, './state/rates.json');
    }, 5000); // 5 seconds for rates

    this.logTimer = setInterval(async () => {
      await this._saveImmediately(this.log, './state/log.json');
    }, 1000); // 1 second for log
  }


  async _saveImmediately(data, filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    const tempFile = `${fullPath}.tmp`;
    
    try {
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
      await fs.rename(tempFile, fullPath);
    } catch (error) {
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  // Public API - Data Access
  getAccounts() {
    return [...this.accountsArray];
  }

  getRates() {
    return this.rates;
  }

  getLog() {
    return [...this.log];
  }

  getAccountById(id) {
    const index = this.accounts.get(parseInt(id));
    return index !== undefined ? this.accountsArray[index] : undefined;
  }

  getAccountByCurrency(currency) {
    const index = this.accountsByCurrency.get(currency);
    return index !== undefined ? this.accountsArray[index] : undefined;
  }

  getAccountIndexByCurrency(currency) {
    return this.accountsByCurrency.get(currency);
  }

  getAccountIndexById(id) {
    return this.accounts.get(parseInt(id));
  }

  getExchangeRate(baseCurrency, counterCurrency) {
    return this.rates[baseCurrency]?.[counterCurrency];
  }

  // Public API - Data Modification
  updateAccount(account) {
    const existingIndex = this.accounts.get(account.id);

    if (existingIndex === undefined) {
      throw new Error(`Account ${account.id} not found`);
    }

    this.accountsArray[existingIndex] = account;
    this.accountsByCurrency.set(account.currency, existingIndex);
  }

  updateAccountBalance(index, newBalance) {
    if (index === undefined || index < 0 || index >= this.accountsArray.length) {
      throw new Error(`Invalid account index: ${index}`);
    }

    if (typeof newBalance !== 'number' || isNaN(newBalance)) {
      throw new Error('Balance must be a valid number');
    }

    if (newBalance < 0) {
      throw new Error('Balance cannot be negative');
    }

    this.accountsArray[index].balance = newBalance;
  }

  setExchangeRate(baseCurrency, counterCurrency, rate) {
    // Initialize base currency object if it doesn't exist
    if (!this.rates[baseCurrency]) {
      this.rates[baseCurrency] = {};
    }
    if (!this.rates[counterCurrency]) {
      this.rates[counterCurrency] = {};
    }
    
    // Set the rate and its reciprocal
    this.rates[baseCurrency][counterCurrency] = rate;
    this.rates[counterCurrency][baseCurrency] = Number((1 / rate).toFixed(5));
  }


  async addLogEntryAndSave(logEntry) {
    try {
      // Add to log array - periodic save will handle persistence
      this.log.push(logEntry);
      
      console.log(`Log entry added: ${logEntry.id}`);
      return logEntry;
    } catch (error) {
      console.error('Failed to add log entry:', error);
      throw error;
    }
  }

  // Public API - Persistence
  async saveAccountsAndRates() {
    // Periodic saves will handle persistence automatically
    // No immediate action needed
  }




  // Public API - Status
  isInitialized() {
    return this.initialized;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      accountsCount: this.accounts.size,
      ratesCount: this.rates.size,
      logsCount: this.log.length
    };
  }
}

// Create singleton instance
const dataManager = new DataManager();

export async function init() {
  await dataManager.init();
  console.log('State initialized with DataManager');
}

export function getAccounts() {
  return dataManager.getAccounts();
}

export function getRates() {
  return dataManager.getRates();
}

export function getLog() {
  return dataManager.getLog();
}

export { dataManager };

