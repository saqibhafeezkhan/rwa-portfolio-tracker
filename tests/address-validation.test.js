import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addressesMatch,
  isValidAddressForChain,
  isValidEvmAddress,
  isValidSolanaAddress,
} from '../lib/address-validation.js';

test('validates EVM addresses by 0x + 40 hex characters', () => {
  assert.equal(isValidEvmAddress('0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b'), true);
  assert.equal(isValidEvmAddress('0x136471a34f6ef19fe571effc1ca711fdbe8e49f2b'), false); // old 43-char bug
  assert.equal(isValidEvmAddress('136471a34f6ef19fe571effc1ca711fdbe8e49f2b'), false);
});

test('validates Base58 Solana addresses', () => {
  assert.equal(isValidSolanaAddress('7LWanZteUKtvFjv4MHYgKXXdAuCQYFPJysL9pxxdRQGn'), true);
  assert.equal(isValidSolanaAddress('not-a-solana-address'), false);
});

test('routes validation by chain id', () => {
  assert.equal(
    isValidAddressForChain('ethereum', '0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b'),
    true,
  );
  assert.equal(
    isValidAddressForChain('solana', '0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b'),
    false,
  );
});

test('Solana address matching is case-sensitive; EVM matching is not', () => {
  assert.equal(addressesMatch('solana', 'AbcDef', 'abcdef'), false);
  assert.equal(
    addressesMatch('ethereum', '0xAbC0000000000000000000000000000000000000', '0xabc0000000000000000000000000000000000000'),
    true,
  );
});
