// invAIse card #391: GA4 cookie parsing in assets/invaise-checkout.js. Run: node --test tests/
// The plugin file exports its pure functions when loaded by Node (no browser, no WordPress).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ga = require('../assets/invaise-checkout.js');

test('client id from _ga', () => {
  assert.equal(ga.parseGaClientId('GA1.1.1234567890.1730000000'), '1234567890.1730000000');
  assert.equal(ga.parseGaClientId('GA1.2.987.654'), '987.654'); // domain depth 2
  for (const bad of [undefined, null, '', 'GA1.1.123', 'GA1.1.123.456.789', 'GA1.1.abc.456', '1234.5678', 'GA1.1.123.456 ', 'GA1.1.' + '1'.repeat(21) + '.1'])
    assert.equal(ga.parseGaClientId(bad), null, String(bad));
});

test('session id from _ga_<container>, GS1 and GS2', () => {
  assert.equal(ga.parseGaSessionId('GS1.1.1730000000.3.1.1730000100.0.0.0'), '1730000000');
  assert.equal(ga.parseGaSessionId('GS2.1.s1730000000$o3$g1$t1730000100$j60$l0$h0'), '1730000000');
  assert.equal(ga.parseGaSessionId('GS2.1.s1730000000'), '1730000000');
  for (const bad of [undefined, null, '', 'GS1.1.abc.3', 'GS1.1.1730000000', 'GS2.1.1730000000$o3', 'GS2.1.sx$o3',
    'GS3.1.1730000000.1', 'GS2.1.s1730000000x$o3', 'GA1.1.123.456'])
    assert.equal(ga.parseGaSessionId(bad), null, String(bad));
});

test('session cookie name from the measurement id', () => {
  assert.equal(ga.sessionCookieName('G-CR6B2G0ML2'), '_ga_CR6B2G0ML2');
  for (const bad of ['', null, 'CR6B2G0ML2', 'UA-1-1', 'g-cr6b2g0ml2']) assert.equal(ga.sessionCookieName(bad), null, String(bad));
});

test('ids from a cookie string', () => {
  const cookies = 'foo=bar; _ga=GA1.1.1234567890.1730000000; _ga_CR6B2G0ML2=GS2.1.s1730000000$o3$g1$t1730000100; x=y';
  assert.deepEqual(ga.gaIdsFromCookies(cookies, 'G-CR6B2G0ML2'), { ga_client_id: '1234567890.1730000000', ga_session_id: '1730000000' });
  // No (valid) measurement id: client id only.
  assert.deepEqual(ga.gaIdsFromCookies(cookies, ''), { ga_client_id: '1234567890.1730000000' });
  // Session cookie of another property is not used.
  assert.deepEqual(ga.gaIdsFromCookies(cookies, 'G-OTHER123'), { ga_client_id: '1234567890.1730000000' });
  // Garbage session cookie: client id only, never a guessed session.
  assert.deepEqual(ga.gaIdsFromCookies('_ga=GA1.1.1.2; _ga_CR6B2G0ML2=garbage', 'G-CR6B2G0ML2'), { ga_client_id: '1.2' });
  // No or garbage _ga: nothing at all, also no session id.
  assert.deepEqual(ga.gaIdsFromCookies('_ga_CR6B2G0ML2=GS1.1.1730000000.1.1', 'G-CR6B2G0ML2'), {});
  assert.deepEqual(ga.gaIdsFromCookies('_ga=nonsense', 'G-CR6B2G0ML2'), {});
  assert.deepEqual(ga.gaIdsFromCookies('', 'G-CR6B2G0ML2'), {});
  assert.deepEqual(ga.gaIdsFromCookies(undefined, 'G-CR6B2G0ML2'), {});
  // A cookie whose name only ends in _ga does not count.
  assert.deepEqual(ga.gaIdsFromCookies('my_ga=GA1.1.1.2', ''), {});
  // Undecodable value: ignored.
  assert.deepEqual(ga.gaIdsFromCookies('_ga=%E0%A4%A', ''), {});
});
