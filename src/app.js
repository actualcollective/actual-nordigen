import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import hbs from 'hbs';
import { validateTokenMiddleware } from './middleware.js';
import { randomUUID } from 'crypto';
import { getBankContext, putWebTokenContent, setBankContext } from './clients/actual.js';
import { client } from './clients/nordigen.js';
import { nordigenAccountToPlaid, nordigenTransactionToPlaid } from './util/mapping.js';

dotenv.config();

const app = express();
const port = process.env.APP_PORT;


app.disable('view cache');
app.set('view engine', 'hbs');
hbs.registerHelper('json', (context) => {
  return JSON.stringify(context);
});

app.set('json spaces', 4);
app.use(session({
  secret: randomUUID(),
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

app.use(bodyParser.json())

const COUNTRY = process.env.COUNTRY;
const REDIRECT_URI = process.env.APP_URL + "/results";

app.get('/install', async (req, res, next) => {
  try {
    const base64Options = req.query.options;
    const buff = Buffer.from(base64Options, 'base64');
    const options = JSON.parse(buff.toString('utf-8'));

    const payload = await client.generateToken();
    const ref = randomUUID();

    req.session.options = options;
    req.session.payload = payload;
    req.session.refId = ref;
    req.session.save();

    //Get list of institutions
    const institutions = await client.institution.getInstitutions({ country: COUNTRY });
    return res.render('index', { data: JSON.stringify(institutions) });
  } catch (e) {
    next(e);
  }
});

app.get('/agreements/:id', async (req, res, next) => {
  try {
    const institutionId = req.params.id;

    if (!institutionId) {
      return res.render('index');
    }

    const refId = req.session.refId;

    if (!refId) {
      return res.render('index');
    }

    const init = await client.initSession({
      redirectUrl: REDIRECT_URI,
      institutionId: institutionId,
      referenceId: refId,
    });

    req.session.requisition = init.id;
    req.session.institutionId = institutionId;
    req.session.save((err) => {
      if (err) {
        throw new Error(err.message);
      }

      return res.redirect(init.link);
    });
  } catch (e) {
    return next(e);
  }
});

app.get('/results/', async (req, res, next) => {
  try {
    const requisitionId = req.session.requisition;
    const institutionId = req.session.institutionId;

    if (!requisitionId || !institutionId) {
      throw new Error('Requisition/Institution ID is not found. Please complete authorization with your bank');
    }

    const requisitionData = await client.requisition.getRequisitionById(requisitionId);
    const accountIds = requisitionData.accounts;
    let accounts = [];

    for (let i = 0; i < accountIds.length; i++) {
      accounts[i] = await nordigenAccountToPlaid(client, accountIds[i]);
    }

    let institution = await client.institution.getInstitutionById(institutionId);
    institution = {
      institution_id: institution.id,
      name: institution.name,
    };

    const payload = { ...req.session.payload, accounts: accountIds };
    await setBankContext(req.session.options.bankCtxId, payload, req.session.refId);
    await putWebTokenContent(req.session.options.tokenId, req.session.refId, institution, accounts);
  } catch (e) {
    return next(e);
  }

  return res.status(200).render('success');
});

app.post('/api/plaid/accounts', validateTokenMiddleware, async (req, res, next) => {
  try {
    const { bankCtx } = req.body;
    const data = await getBankContext(bankCtx);
    const token = await client.exchangeToken({ refreshToken: data.refresh });
    client.token = token.access;

    const accountIds = data.accounts;
    let accounts = [];

    for (let i = 0; i < accountIds.length; i++) {
      accounts[i] = await nordigenAccountToPlaid(client, accountIds[i]);
    }

    return res.status(200).json({ status: 'ok', data: accounts });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/plaid/transactions', validateTokenMiddleware, async (req, res, next) => {
  try {
    const { bankCtx, startDate, endDate, acctId } = req.body;
    const data = await getBankContext(bankCtx);
    const token = await client.exchangeToken({ refreshToken: data.refresh });
    client.token = token.access;

    let accounts = [await nordigenAccountToPlaid(client, acctId)];

    const ignoreBeforeDate = new Date(startDate);
    // for some reason the date filter on nordigen does not work as expected, so we filter afterwards
    const txData = await client.account(acctId).getTransactions({ dateFrom: startDate, dateTo: endDate });
    const bookedTxs = txData.transactions?.booked ?? [];

    let transactions = [];
    for (let i = 0; i < bookedTxs.length; i++) {
      const nordigenTx = nordigenTransactionToPlaid(acctId, bookedTxs[i]);
      if (new Date(nordigenTx.date) < ignoreBeforeDate) {
        continue;
      }

      transactions[i] = nordigenTx;
    }

    return res.status(200).json({
      status: 'ok',
      data: {
        accounts: accounts,
        transactions: transactions,
        total_transactions: transactions.length,
      },
    });
  } catch (e) {
    return next(e);
  }
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  return res.json({
    errors: {
      status: 'error',
      reason: 'internal-error',
      debug: [process.env.NODE_ENV !== 'production' ? err.message + err.stack : null],
    },
  });
});

app.listen(port, () => {
  console.log(`Server is running at ${process.env.APP_URL}`);
});
