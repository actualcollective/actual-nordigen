import axios from 'axios';
import { decrypt, encrypt } from '../util/crypto.js';
import dotenv from "dotenv";

dotenv.config();

export const setBankContext = async (bankCtxId, payload, externalId) => {
  const ctx = {
    token: process.env.ACTUAL_SECRET,
    contextId: bankCtxId,
    externalId: externalId,
    payload: encrypt(JSON.stringify(payload)),
  };

  await axios.post(process.env.ACTUAL_URL + '/integrations/set-context', ctx).catch((err) => console.log(err));
};

export const getBankContext = async (bankCtxId) => {
  const res = await axios.post(process.env.ACTUAL_URL + '/integrations/get-context', {
    token: process.env.ACTUAL_SECRET,
    contextId: bankCtxId,
  });

  return JSON.parse(decrypt(res.data.data));
};

export const putWebTokenContent = async (token, refId, institution, accounts) => {
  await axios.post(process.env.ACTUAL_URL + '/plaid/put-web-token-contents', {
    token: token,
    data: {
      publicToken: refId,
      metadata: {
        institution: institution,
        accounts: accounts,
      },
    },
  });
};
