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

  addLogEntry(logEntry) {
    this.log.push(logEntry);
  }

  async addLogEntryAndSave(logEntry) {
    return new Promise(async (resolve, reject) => {
      try {
        // Add to log array
        this.log.push(logEntry);
        
        // Save log immediately
        await this._saveImmediately(this.log, './state/log.json');
        
        console.log(`Log entry added and saved: ${logEntry.id}`);
        resolve(logEntry);
      } catch (error) {
        console.error('Failed to add log entry:', error);
        reject(error);
      }
    });
  }

  // Public API - Persistence
  async saveAccountsAndRates() {
    try {
      await Promise.all([
        this._saveImmediately(this.accountsArray, './state/accounts.json'),
        this._saveImmediately(this.rates, './state/rates.json')
      ]);
      
      console.log('Accounts and rates saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  }

  async saveLogs() {
    try {
      await this._saveImmediately(this.log, './state/log.json');
      console.log('Log saved successfully');
    } catch (error) {
      console.error('Failed to save log:', error);
      throw error;
    }
  }

  // Public API - Transaction Support
  createBackup() {
    return {
      accounts: new Map(this.accounts),
      accountsByCurrency: new Map(this.accountsByCurrency),
      accountsArray: [...this.accountsArray],
      rates: JSON.parse(JSON.stringify(this.rates)), // Deep copy of object
      log: [...this.log]
    };
  }

  restoreFromBackup(backup) {
    this.accounts = new Map(backup.accounts);
    this.accountsByCurrency = new Map(backup.accountsByCurrency);
    this.accountsArray = [...backup.accountsArray];
    this.rates = JSON.parse(JSON.stringify(backup.rates)); // Deep copy of object
    this.log = [...backup.log];
  }

  // Public API - Raw Data Access (for queue operations)
  getRawData() {
    return {
      accounts: this.accounts,
      accountsByCurrency: this.accountsByCurrency,
      accountsArray: this.accountsArray,
      rates: this.rates,
      log: this.log
    };
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

