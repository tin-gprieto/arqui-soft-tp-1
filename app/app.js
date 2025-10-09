import express from "express";

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

await exchangeInit();

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints

app.get("/accounts", (req, res) => {
  res.json(getAccounts());
});

app.put("/accounts/:id/balance", async (req, res) => {
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  }

  if (!Number.isInteger(parseInt(accountId))) {
    return res.status(400).json({ error: "Account ID must be a valid integer" });
  }

  if (typeof balance !== 'number' || isNaN(balance)) {
    return res.status(400).json({ error: "Balance must be a valid number" });
  }

  try {
    await setAccountBalance(accountId, balance);
    res.json(getAccounts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RATE endpoints

app.get("/rates", (req, res) => {
  res.json(getRates());
});

app.put("/rates", async (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }

  if (typeof baseCurrency !== 'string' || typeof counterCurrency !== 'string') {
    return res.status(400).json({ error: "Currencies must be valid strings" });
  }

  if (typeof rate !== 'number' || isNaN(rate)) {
    return res.status(400).json({ error: "Rate must be a valid number" });
  }

  try {
    const newRateRequest = { ...req.body };
    await setRate(newRateRequest);
    res.json(getRates());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOG endpoint

app.get("/log", (req, res) => {
  res.json(getLog());
});

// EXCHANGE endpoint

app.post("/exchange", async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  if (typeof baseCurrency !== 'string' || typeof counterCurrency !== 'string') {
    return res.status(400).json({ error: "Currencies must be valid strings" });
  }

  if (!Number.isInteger(baseAccountId) || !Number.isInteger(counterAccountId)) {
    return res.status(400).json({ error: "Account IDs must be valid integers" });
  }

  if (typeof baseAmount !== 'number' || isNaN(baseAmount)) {
    return res.status(400).json({ error: "Base amount must be a valid number" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else {
    res.status(500).json(exchangeResult);
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
