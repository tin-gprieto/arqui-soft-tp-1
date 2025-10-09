import { nanoid } from "nanoid";
import fs from "fs/promises";
import path from "path";

class AtomicOperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.data = {
      accounts: new Map(),        // id -> Account
      accountsByCurrency: new Map(), // currency -> Account
      accountsArray: [],         // For API responses and persistence
      rates: new Map(),
      log: []
    };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      const accounts = await this.loadData('./state/accounts.json');
      const rates = await this.loadData('./state/rates.json');
      const log = await this.loadData('./state/log.json');

      // Index accounts data
      if (Array.isArray(accounts)) {
        this.data.accountsArray = [...accounts];
        accounts.forEach(account => {
          this.data.accounts.set(account.id, account);
          this.data.accountsByCurrency.set(account.currency, account);
        });
      }

      if (rates && typeof rates === 'object') {
        Object.entries(rates).forEach(([base, counterRates]) => {
          Object.entries(counterRates).forEach(([counter, rate]) => {
            this.data.rates.set(`${base}_${counter}`, rate);
          });
        });
      }

      if (Array.isArray(log)) {
        this.data.log = [...log];
      }

      this.initialized = true;
      console.log('Queue initialized successfully');
    } catch (error) {
      console.error('Failed to initialize queue:', error);
      throw error;
    }
  }

  async loadData(filePath) {
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

  async enqueue(operation) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        operation,
        resolve,
        reject,
        id: nanoid(),
        timestamp: Date.now()
      };

      this.queue.push(queueItem);
      console.log(`Operation ${queueItem.id} queued. Queue length: ${this.queue.length}`);
      
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    console.log('Starting queue processing...');

    while (this.queue.length > 0) {
      const { operation, resolve, reject, id } = this.queue.shift();
      
      try {
        console.log(`Processing operation ${id}`);
        const result = await this.executeAtomically(operation);
        resolve(result);
        console.log(`Operation ${id} completed successfully`);
      } catch (error) {
        console.error(`Operation ${id} failed:`, error);
        reject(error);
      }
    }
    
    this.processing = false;
    console.log('Queue processing completed');
  }

  async executeAtomically(operation) {
    const backup = this.createBackup();
    
    try {
      const result = await operation(this.data);
      
      await this.saveAllData();
      
      return result;
    } catch (error) {
      this.restoreFromBackup(backup);
      throw error;
    }
  }

  createBackup() {
    return {
      accounts: new Map(this.data.accounts),
      accountsByCurrency: new Map(this.data.accountsByCurrency),
      accountsArray: [...this.data.accountsArray],
      rates: new Map(this.data.rates),
      log: [...this.data.log]
    };
  }

  restoreFromBackup(backup) {
    this.data.accounts = new Map(backup.accounts);
    this.data.accountsByCurrency = new Map(backup.accountsByCurrency);
    this.data.accountsArray = [...backup.accountsArray];
    this.data.rates = new Map(backup.rates);
    this.data.log = [...backup.log];
  }

  async saveAllData() {
    try {
      // Use the maintained array for direct persistence
      const ratesObject = this.convertRatesToObject();
      
      await Promise.all([
        this.saveImmediately(this.data.accountsArray, './state/accounts.json'),
        this.saveImmediately(ratesObject, './state/rates.json'),
        this.saveImmediately(this.data.log, './state/log.json')
      ]);
      
      console.log('All data saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  }

  convertRatesToObject() {
    const ratesObject = {};
    
    this.data.rates.forEach((rate, key) => {
      const [base, counter] = key.split('_');
      if (!ratesObject[base]) {
        ratesObject[base] = {};
      }
      ratesObject[base][counter] = rate;
    });
    
    return ratesObject;
  }

  async saveImmediately(data, filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    const tempFile = `${fullPath}.tmp`;
    
    try {
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
      
      await fs.rename(tempFile, fullPath);
    } catch (error) {
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
      }
      throw error;
    }
  }

  getData() {
    return {
      accounts: this.data.accountsArray,  // Direct array for API responses
      rates: this.convertRatesToObject(),
      log: [...this.data.log]
    };
  }

  getLog() {
    return [...this.data.log];
  }

  getAccount(id) {
    return this.data.accounts.get(parseInt(id));
  }

  // Get account by currency (O(1))
  getAccountByCurrency(currency) {
    return this.data.accountsByCurrency.get(currency);
  }

  // Update account in all data structures
  updateAccount(account) {
    this.data.accounts.set(account.id, account);
    this.data.accountsByCurrency.set(account.currency, account);
    
    // Update in array
    const index = this.data.accountsArray.findIndex(acc => acc.id === account.id);
    if (index !== -1) {
      this.data.accountsArray[index] = account;
    } else {
      this.data.accountsArray.push(account);
    }
  }

  getRate(baseCurrency, counterCurrency) {
    return this.data.rates.get(`${baseCurrency}_${counterCurrency}`);
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      initialized: this.initialized
    };
  }
}

const operationQueue = new AtomicOperationQueue();

export default operationQueue;
