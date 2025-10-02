#!/usr/bin/env node

const assert = require('assert');
const { parseVarTableInput } = require('../src/vartable');

function testPayloadArray() {
    const msg = {
        function: 'setvartable',
        payload: [
            { name: 'motor', addr: 'DB1,X0.0' },
            { name: 'temp', addr: 'DB1,REAL2' }
        ]
    };

    const { vartable, error } = parseVarTableInput(msg);
    assert.ok(!error, 'Expected no error when payload array is provided');
    assert.strictEqual(vartable.length, 2);
    assert.deepStrictEqual(vartable[0], { name: 'motor', addr: 'DB1,X0.0' });
}

function testVartableProperty() {
    const msg = {
        vartable: [
            { name: 'pressure', addr: 'DB1,REAL4' }
        ]
    };

    const { vartable, error } = parseVarTableInput(msg);
    assert.ok(!error, 'Expected no error when msg.vartable is provided');
    assert.strictEqual(vartable.length, 1);
    assert.deepStrictEqual(vartable[0], { name: 'pressure', addr: 'DB1,REAL4' });
}

function testTextPayload() {
    const msg = {
        payload: 'DB2,INT0;speed\r\nDB2,INT2;torque'
    };

    const { vartable, error } = parseVarTableInput(msg);
    assert.ok(!error, 'Expected no error when payload text is provided');
    assert.strictEqual(vartable.length, 2);
    assert.deepStrictEqual(vartable[1], { name: 'torque', addr: 'DB2,INT2' });
}

function testInvalidPayload() {
    const msg = { payload: 42 };
    const { vartable, error } = parseVarTableInput(msg);
    assert.strictEqual(vartable.length, 0);
    assert.ok(error && error.includes('vartable missing or invalid'));
}

function run() {
    testPayloadArray();
    testVartableProperty();
    testTextPayload();
    testInvalidPayload();
    console.log('✅ vartable parser tests passed');
}

run();
