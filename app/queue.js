import { nanoid } from "nanoid";

import { dataManager } from "./state.js";

class AtomicOperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      
      this.initialized = true;
      console.log('Queue initialized successfully');
    } catch (error) {
      console.error('Failed to initialize queue:', error);
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

  // Add log entry and save immediately
  async addLogEntry(logEntry) {
    return new Promise(async (resolve, reject) => {
      try {
        // Use DataManager to add log entry and save
        await dataManager.addLogEntryAndSave(logEntry);
        
        console.log(`Log entry added and saved: ${logEntry.id}`);
        resolve(logEntry);
      } catch (error) {
        console.error('Failed to add log entry:', error);
        reject(error);
      }
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
    const backup = dataManager.createBackup();
    
    try {
      const result = await operation(dataManager);
      
      await dataManager.saveAccountsAndRates();
      
      return result;
    } catch (error) {
      dataManager.restoreFromBackup(backup);
      throw error;
    }
  }


  async saveAllData() {
    try {
      // Use DataManager to save accounts and rates
      await dataManager.saveAccountsAndRates();
      
      console.log('Accounts and rates saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
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
