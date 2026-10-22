#!/usr/bin/env node
// Unit tests for the S7 Control setvartable input parser (src/vartable.js)
const assert = require('assert');
const { parseVarTableInput } = require('../src/vartable');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('array in msg.payload', () => {
    const r = parseVarTableInput({ payload: [{ name: 'motor', addr: 'DB1,X0.0' }, { name: 'temp', addr: 'DB1,REAL2' }] });
    assert.ok(!r.error);
    assert.strictEqual(r.source, 'msg.payload');
    assert.deepStrictEqual(r.vartable, [{ name: 'motor', addr: 'DB1,X0.0' }, { name: 'temp', addr: 'DB1,REAL2' }]);
});

test('array in msg.vartable (unchanged behaviour)', () => {
    const r = parseVarTableInput({ vartable: [{ name: 'pressure', addr: 'DB1,REAL4' }] });
    assert.ok(!r.error);
    assert.strictEqual(r.source, 'msg.vartable');
    assert.deepStrictEqual(r.vartable, [{ name: 'pressure', addr: 'DB1,REAL4' }]);
});

test('msg.payload.vartable: the output of a previous setvartable round-trips', () => {
    const first = parseVarTableInput({ payload: 'DB1,REAL0;a\nDB1,INT4;b' });
    const output = { payload: { vartable: first.vartable } }; // what the node sends
    const again = parseVarTableInput(output);
    assert.strictEqual(again.source, 'msg.payload.vartable');
    assert.deepStrictEqual(again.vartable, first.vartable);
});

test('text payload with CRLF, blank lines and spaces', () => {
    const r = parseVarTableInput({ payload: ' DB2,INT0 ; speed \r\n\r\nDB2,INT2;torque\r\n' });
    assert.ok(!r.error);
    assert.deepStrictEqual(r.vartable, [{ name: 'speed', addr: 'DB2,INT0' }, { name: 'torque', addr: 'DB2,INT2' }]);
    assert.deepStrictEqual(r.ignored, []);
});

test('text: name is everything after the first ";"', () => {
    const r = parseVarTableInput({ payload: 'DB1,REAL0;tank;level' });
    assert.deepStrictEqual(r.vartable, [{ name: 'tank;level', addr: 'DB1,REAL0' }]);
});

test('msg.vartable takes precedence over msg.payload', () => {
    const r = parseVarTableInput({ vartable: [{ name: 'a', addr: 'DB1,X0.0' }], payload: [{ name: 'b', addr: 'DB1,X0.1' }] });
    assert.strictEqual(r.source, 'msg.vartable');
    assert.deepStrictEqual(r.vartable, [{ name: 'a', addr: 'DB1,X0.0' }]);
});

test('invalid entries are reported, valid ones kept and trimmed', () => {
    const r = parseVarTableInput({ payload: [{ name: ' ok ', addr: ' DB1,X0.0 ' }, { name: 'noaddr' }, null, 'x', { addr: 'DB1,X0.1' }] });
    assert.ok(!r.error);
    assert.deepStrictEqual(r.vartable, [{ name: 'ok', addr: 'DB1,X0.0' }]);
    assert.strictEqual(r.ignored.length, 4);
    assert.match(r.ignored[0], /^\[1\] /);
});

test('invalid text lines are reported', () => {
    const r = parseVarTableInput({ payload: 'DB1,REAL0;good\nno-separator\n;nameonly\nDB1,REAL4;' });
    assert.deepStrictEqual(r.vartable, [{ name: 'good', addr: 'DB1,REAL0' }]);
    assert.deepStrictEqual(r.ignored.map(i => i.split(':')[0]), ['line 2', 'line 3', 'line 4']);
});

test('a present but fully invalid source is an error (no fall-through, table untouched)', () => {
    const r = parseVarTableInput({ vartable: [{ name: 'x' }], payload: [{ name: 'b', addr: 'DB1,X0.1' }] });
    assert.deepStrictEqual(r.vartable, []);
    assert.match(r.error, /No valid entry in msg\.vartable/);
    assert.strictEqual(r.ignored.length, 1);
});

test('empty arrays are errors', () => {
    assert.match(parseVarTableInput({ vartable: [] }).error, /vartable missing or invalid/);
    assert.match(parseVarTableInput({ payload: [] }).error, /vartable missing or invalid/);
});

test('missing or unsupported input is an error', () => {
    for (const msg of [{}, { payload: 42 }, { payload: '   ' }, { payload: { other: 1 } }, null, undefined]) {
        const r = parseVarTableInput(msg);
        assert.deepStrictEqual(r.vartable, []);
        assert.match(r.error, /vartable missing or invalid/);
    }
});

let failed = 0;
for (const [name, fn] of tests) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}\n     ${err.message}`);
    }
}
console.log(`\nvartable parser: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
