export const nordigenAccountToPlaid = async (client, nordigenAcctId) => {
  const account = await client.account(nordigenAcctId);
  const meta = await account.getMetadata();
  const details = await account.getDetails();
  let balance = await account.getBalances();

  if (balance.balances === undefined || balance.balances.length === 0) {
    const msg = `Error accessing balances on account ${nordigenAcctId}: ${JSON.stringify(balance)}`;

    console.error(msg);
    throw Error(msg);
  }

  balance = balance.balances[0];

  return {
    id: meta.id,
    account_id: meta.id,
    mask: details.account.iban ? details.account.iban.slice(-4) : '0000',
    name: details.account.name ?? 'Unknown',
    official_name: details.account.name ?? 'Unknown',
    type: 'depository',
    subtype: 'checking',
    balances: {
      available: parseFloat(balance.balanceAmount?.amount ?? '0'),
      current: parseFloat(balance.balanceAmount?.amount ?? '0'),
      limit: null,
      iso_currency_code: balance.balanceAmount?.currency ?? 'EUR',
      unofficial_currency_code: null,
    },
  };
};

export const nordigenTransactionToPlaid = (acctId, nordigenTx) => {
  return {
    transaction_id: nordigenTx.transactionId,
    account_id: acctId,
    name: nordigenTx.creditorName ?? nordigenTx.debtorName,
    amount: parseFloat(nordigenTx.transactionAmount.amount) * -1,
    iso_currency_code: nordigenTx.transactionAmount.currency,
    date: nordigenTx.bookingDate,
    pending: false,
    merchant_name: null,
    check_number: null,
    original_description: null,
    transaction_type: 'unresolved', // deprecated
    payment_channel: 'other',
    pending_transaction_id: null,
    category_id: null,
    category: null,
    location: null,
    payment_meta: {},
  };
};
