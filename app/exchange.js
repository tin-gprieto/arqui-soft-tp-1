import { nanoid } from "nanoid";
import operationQueue from "./queue.js";
import { dataManager } from "./state.js";

//call to initialize the exchange service
export async function init() {
  await dataManager.init();
  await operationQueue.init();
}

//returns all internal accounts
export function getAccounts() {
  return dataManager.getAccounts();
}

//sets balance for an account
export async function setAccountBalance(accountId, balance) {
  if (balance < 0) {
    throw new Error('Balance cannot be negative');
  }

  return await operationQueue.enqueue(async (dataManager) => {
    const account = dataManager.getAccountById(parseInt(accountId));
    
    if (account != null) {
      account.balance = balance;
      dataManager.updateAccount(account);
      
      return { success: true, account };
    }
    
    throw new Error(`Account ${accountId} not found`);
  });
}

//returns all current exchange rates
export function getRates() {
  return dataManager.getRates();
}

//returns the whole transaction log
export function getLog() {
  return dataManager.getLog();
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;

  if (rate <= 0) {
    throw new Error('Rate must be positive');
  }

  return await operationQueue.enqueue(async (dataManager) => {
    dataManager.setExchangeRate(baseCurrency, counterCurrency, rate);
    
    return { success: true, rate, reciprocalRate: Number((1 / rate).toFixed(5)) };
  });
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  return await operationQueue.enqueue(async (dataManager) => {
    const {
      baseCurrency,
      counterCurrency,
      baseAccountId: clientBaseAccountId,
      counterAccountId: clientCounterAccountId,
      baseAmount,
    } = exchangeRequest;

    const exchangeRate = dataManager.getExchangeRate(baseCurrency, counterCurrency);
    if (!exchangeRate) {
      throw new Error(`Exchange rate not found for ${baseCurrency}/${counterCurrency}`);
    }
    
    //compute the requested (counter) amount
    const counterAmount = baseAmount * exchangeRate;
    
    const baseAccount = dataManager.getAccountByCurrency(baseCurrency);
    const counterAccount = dataManager.getAccountByCurrency(counterCurrency);

    if (!baseAccount) {
      throw new Error(`Base currency account not found for ${baseCurrency}`);
    }

    if (!counterAccount) {
      throw new Error(`Counter currency account not found for ${counterCurrency}`);
    }

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
        if (await checkClientAccountBalance(clientBaseAccountId, baseAmount)) {
        //try to transfer to clients' counter account
        if (checkInternalAccountBalance(counterAccount, counterAmount)) {
          //all good, update balances
          baseAccount.balance += baseAmount;
          counterAccount.balance -= counterAmount;
          
          try {
            dataManager.updateAccount(baseAccount);
            dataManager.updateAccount(counterAccount);
          } catch (error) {
            throw new Error(`Error updating accounts: ${error.message}`);
          }
          
          await transfer(counterAccount.id, clientCounterAccountId, counterAmount)
          await transfer(clientBaseAccountId, baseAccount.id, baseAmount)

          exchangeResult.ok = true;
          exchangeResult.counterAmount = counterAmount;
        } else {
          //could not transfer to clients' counter account, return base amount to client
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

async function checkClientAccountBalance(accountId, amount) {
  const min = 100;
  const max = 300;
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulated bank API call - always returns success for now
      // const response = await fetch(`https://api.bank.com/accounts/${accountId}/balance`, {
      //   method: 'GET',
      //   headers: {
      //     'Authorization': 'Bearer fake-token',
      //     'Content-Type': 'application/json'
      //   }
      // });
      
      // Simulated response - always return true for now
      resolve(true);
    }, Math.random() * (max - min + 1) + min);
  });
}

function checkInternalAccountBalance(account, amount) {
  return account.balance >= amount;
}

async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

