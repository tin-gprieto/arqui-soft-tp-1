import { nanoid } from "nanoid";
import operationQueue from "./queue.js";

let accounts;
let rates;
let log;

//call to initialize the exchange service
export async function init() {
  await operationQueue.init();
  
  // Get data from queue
  const data = operationQueue.getData();
  accounts = data.accounts;
  rates = data.rates;
  log = data.log;
}

//returns all internal accounts
export function getAccounts() {
  return accounts;
}

//sets balance for an account
export async function setAccountBalance(accountId, balance) {
  return await operationQueue.enqueue(async (data) => {
    const account = data.accounts.get(parseInt(accountId));
    
    if (account != null) {
      account.balance = balance;
      // Update in all data structures
      data.accounts.set(parseInt(accountId), account);
      data.accountsByCurrency.set(account.currency, account);
      
      // Update in array
      const index = data.accountsArray.findIndex(acc => acc.id === parseInt(accountId));
      if (index !== -1) {
        data.accountsArray[index] = account;
      }
      
      return { success: true, account };
    }
    
    throw new Error(`Account ${accountId} not found`);
  });
}

//returns all current exchange rates
export function getRates() {
  return rates;
}

//returns the whole transaction log
export function getLog() {
  return operationQueue.getLog();
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  return await operationQueue.enqueue(async (data) => {
    const { baseCurrency, counterCurrency, rate } = rateRequest;

    // Update rates in the queue data
    data.rates.set(`${baseCurrency}_${counterCurrency}`, rate);
    data.rates.set(`${counterCurrency}_${baseCurrency}`, Number((1 / rate).toFixed(5)));
    
    return { success: true, rate, reciprocalRate: Number((1 / rate).toFixed(5)) };
  });
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  return await operationQueue.enqueue(async (data) => {
    const {
      baseCurrency,
      counterCurrency,
      baseAccountId: clientBaseAccountId,
      counterAccountId: clientCounterAccountId,
      baseAmount,
    } = exchangeRequest;

    //get the exchange rate
    const exchangeRate = data.rates.get(`${baseCurrency}_${counterCurrency}`);
    if (!exchangeRate) {
      throw new Error(`Exchange rate not found for ${baseCurrency}/${counterCurrency}`);
    }
    
    //compute the requested (counter) amount
    const counterAmount = baseAmount * exchangeRate;
    
    //find our account on the provided (base) currency (O(1) lookup)
    const baseAccount = data.accountsByCurrency.get(baseCurrency);
    //find our account on the counter currency (O(1) lookup)
    const counterAccount = data.accountsByCurrency.get(counterCurrency);

    //construct the result object with defaults
    const exchangeResult = {
      id: nanoid(),
      ts: new Date(),
      ok: false,
      request: exchangeRequest,
      exchangeRate: exchangeRate,
      counterAmount: 0.0,
      obs: null,
    };

    //check if we have funds on the counter currency account
    if (counterAccount.balance >= counterAmount) {
      //try to transfer from clients' base account
      if (await transfer(clientBaseAccountId, baseAccount.id, baseAmount)) {
        //try to transfer to clients' counter account
        if (
          await transfer(counterAccount.id, clientCounterAccountId, counterAmount)
        ) {
          //all good, update balances
          baseAccount.balance += baseAmount;
          counterAccount.balance -= counterAmount;
          
          // Update accounts in all data structures
          data.accounts.set(baseAccount.id, baseAccount);
          data.accountsByCurrency.set(baseAccount.currency, baseAccount);
          data.accounts.set(counterAccount.id, counterAccount);
          data.accountsByCurrency.set(counterAccount.currency, counterAccount);
          
          // Update in array
          const baseIndex = data.accountsArray.findIndex(acc => acc.id === baseAccount.id);
          const counterIndex = data.accountsArray.findIndex(acc => acc.id === counterAccount.id);
          if (baseIndex !== -1) data.accountsArray[baseIndex] = baseAccount;
          if (counterIndex !== -1) data.accountsArray[counterIndex] = counterAccount;
          
          exchangeResult.ok = true;
          exchangeResult.counterAmount = counterAmount;
        } else {
          //could not transfer to clients' counter account, return base amount to client
          await transfer(baseAccount.id, clientBaseAccountId, baseAmount);
          exchangeResult.obs = "Could not transfer to clients' account";
        }
      } else {
        //could not withdraw from clients' account
        exchangeResult.obs = "Could not withdraw from clients' account";
      }
    } else {
      //not enough funds on internal counter account
      exchangeResult.obs = "Not enough funds on counter currency account";
    }

    //log the transaction and save immediately
    await operationQueue.addLogEntry(exchangeResult);

    return exchangeResult;
  });
}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

