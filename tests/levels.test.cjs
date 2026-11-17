// JavaScript / tests/levels.test.cjs / Node.js 18+ / Bloxzuh.
const test = require('node:test');
const assert = require('node:assert/strict');
const levels = require('../js/levels.js');
const sellerReview = (orderId, extra = {}) => ({orderId, type: 'ad', sellerUid: 'alice', buyerUid: 'bob', fromUid: 'bob', stars: 5, ...extra});

test('New accounts start at level 1 without fabricated XP', () => {
  const p = levels.progress(0);
  assert.equal(p.level, 1); assert.equal(p.rank, 'Quartzo'); assert.equal(p.xp, 0); assert.equal(p.remaining, 100);
});
test('Level boundaries and progress follow the published formula', () => {
  assert.equal(levels.progress(1).level, 2);
  assert.equal(levels.progress(3).level, 2);
  assert.equal(levels.progress(4).level, 3);
  assert.equal(levels.progress(9).level, 4);
  assert.equal(levels.progress(16).rank, 'Ametista');
  assert.equal(levels.progress(64).rank, 'Safira');
  assert.equal(levels.progress(144).rank, 'Esmeralda');
  assert.equal(levels.progress(256).rank, 'Rubi');
  assert.equal(levels.progress(361).level, 20);
  assert.equal(levels.progress(1000).percent, 100);
  assert.equal(levels.progress(1000).remaining, 0);
});
test('Count positive reviews as buyer and seller, once per order', () => {
  const reviews = [sellerReview('one'), sellerReview('one'), sellerReview('two', {type: 'buyer', buyerUid: 'alice', sellerUid: 'bob', fromUid: 'bob'})];
  assert.equal(levels.countReviews('alice', reviews), 2);
});
test('Ignore self trades, wrong recipients/authors, missing orders, invalid types, and 1–4 stars', () => {
  const rows = [sellerReview('a', {buyerUid: 'alice'}), sellerReview('b', {sellerUid: 'bob'}), sellerReview('c', {fromUid: 'alice'}), sellerReview(''), sellerReview('d', {type: 'fake'})];
  for (let stars = 1; stars <= 4; stars++) rows.push(sellerReview('star' + stars, {stars}));
  assert.equal(levels.countReviews('alice', rows), 0);
});
test('Invalid count cannot produce a negative level or XP', () => {
  assert.equal(levels.progress(-100).level, 1);
  assert.equal(levels.progress('invalid').xp, 0);
});
test('Read all review pages instead of limiting reputation to the latest 50', async () => {
  const rows = Array.from({length: 510}, (_, i) => sellerReview(String(i)));
  const old = global.firebase;
  let reads = 0;
  function query(field, uid, offset = 0) {
    return {orderBy() {return this;}, limit() {return this;}, startAfter(doc) {return query(field, uid, doc.index + 1);}, async get() {
      reads++;
      const matched = rows.filter(r => r[field] === uid);
      const docs = matched.slice(offset, offset + 250).map((r, i) => ({index: offset + i, data: () => r}));
      return {size: docs.length, docs, forEach: fn => docs.forEach(fn)};
    }};
  }
  function firestore() {return {collection: () => ({where: (field, op, uid) => query(field, uid)})};}
  firestore.FieldPath = {documentId: () => '__name__'};
  global.firebase = {firestore};
  try {
    const result = await levels.load('alice');
    assert.equal(result.positiveOrders, 510);
    assert.equal(reads, 4);
  } finally {global.firebase = old;}
});
test('Read errors are reported instead of displaying a false zero level', async () => {
  const old = global.firebase;
  function firestore() {return {collection: () => {throw Error('permission-denied');}};}
  firestore.FieldPath = {documentId: () => '__name__'};
  global.firebase = {firestore};
  try {await assert.rejects(levels.load('alice'), /permission-denied/);} finally {global.firebase = old;}
});
