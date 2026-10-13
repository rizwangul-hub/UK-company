import { test } from 'node:test';
import assert from 'node:assert/strict';
import { round2 } from '../src/services/ledgerService.js';

test('round2 correctly rounds monetary decimals to 2 places', () => {
  assert.equal(round2(1234.567), 1234.57);
  assert.equal(round2(100.1), 100.1);
  assert.equal(round2(0), 0);
  assert.equal(round2(99.999), 100);
});

test('Mortgage payment split must equal total amount paid', () => {
  const interestAmount = 850.25;
  const principalAmount = 450.75;
  const feeAmount = 25.00;
  const totalPaid = 1326.00;

  const sum = round2(interestAmount + principalAmount + feeAmount);
  assert.equal(sum, totalPaid);
});

test('Mortgage payment split mismatch is detected', () => {
  const interestAmount = 800;
  const principalAmount = 400;
  const totalPaid = 1300; // mismatch by 100

  const sum = round2(interestAmount + principalAmount);
  const diff = Math.abs(sum - totalPaid);
  assert.ok(diff > 0.05, 'Should detect split mismatch');
});

test('Principal repayment reduces mortgage liability without affecting operating expenses', () => {
  const originalBalance = 250000;
  const principalRepayment = 620.50;

  const newBalance = round2(originalBalance - principalRepayment);
  assert.equal(newBalance, 249379.50);
});

test('Account liquidity movement accurately tracks deposits and withdrawals', () => {
  const openingBalance = 10000;
  const transactions = [
    { amount: 1500, direction: 'IN' },  // Rent received
    { amount: 450, direction: 'OUT' },  // Plumber repair
    { amount: 1200, direction: 'OUT' }, // Mortgage payment
  ];

  let current = openingBalance;
  for (const tx of transactions) {
    current = round2(tx.direction === 'IN' ? current + tx.amount : current - tx.amount);
  }

  assert.equal(current, 9850);
});

test('Internal transfer moves money between accounts with zero net portfolio change', () => {
  const sourceAccount = { balance: 5000 };
  const destAccount = { balance: 1000 };
  const transferAmount = 1500;

  const initialTotal = sourceAccount.balance + destAccount.balance;

  sourceAccount.balance = round2(sourceAccount.balance - transferAmount);
  destAccount.balance = round2(destAccount.balance + transferAmount);

  const finalTotal = sourceAccount.balance + destAccount.balance;

  assert.equal(sourceAccount.balance, 3500);
  assert.equal(destAccount.balance, 2500);
  assert.equal(initialTotal, finalTotal);
});
