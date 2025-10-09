import { nanoid } from "nanoid";
import { dataManager } from "./state.js";

//call to initialize the exchange service
export async function init() {
  await dataManager.init();
}

//returns all internal accounts
export function getAccounts() {
  return dataManager.getAccounts();
}

//sets balance for an account
export async function setAccountBalance(accountId, balance) {
  const accountIndex = dataManager.getAccountIndexById(parseInt(accountId));

  if (accountIndex === undefined) {
    throw new Error(`Account ${accountId} not found`);
  }

  try {
    dataManager.updateAccountBalance(accountIndex, balance);
    const account = dataManager.getAccountById(parseInt(accountId));
    return { success: true, account };
  } catch (error) {
    throw new Error(`Failed to update account balance: ${error.message}`);
  }
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

  dataManager.setExchangeRate(baseCurrency, counterCurrency, rate);
  // Periodic save will handle persistence automatically
  
  return { success: true, rate, reciprocalRate: Number((1 / rate).toFixed(5)) };
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
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

  const baseAccountIndex = dataManager.getAccountIndexByCurrency(baseCurrency);
  const counterAccountIndex = dataManager.getAccountIndexByCurrency(counterCurrency);

  if (baseAccountIndex === undefined) {
    throw new Error(`Base currency account not found for ${baseCurrency}`);
  }

  if (counterAccountIndex === undefined) {
    throw new Error(`Counter currency account not found for ${counterCurrency}`);
  }

  const baseAccount = dataManager.getAccountByCurrency(baseCurrency);
  const counterAccount = dataManager.getAccountByCurrency(counterCurrency);

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
      if (await transfer(counterAccount.id, clientCounterAccountId, counterAmount)) {
        //all good, BOTH transfers succeeded - now update balances atomically
        baseAccount.balance += baseAmount;
        counterAccount.balance -= counterAmount;

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

  //log the transaction - periodic save will handle persistence
  await dataManager.addLogEntryAndSave(exchangeResult);

  return exchangeResult;
}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

