#!/usr/bin/env node
/**
 * End-to-end test of S7 Control "setvartable" and S7 Out writes against a simulated S7 PLC
 * (python-snap7 server, started with uv) and an embedded Node-RED runtime.
 * Run from the project root: npm run test:e2e   (needs uv and tests/node_modules)
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
// NODE_RED_DIR selects the Node-RED install to test against (default: tests/node_modules/node-red)
const RED_DIR = process.env.NODE_RED_DIR || path.join(__dirname, '..', 'node_modules', 'node-red');
const RED = require(RED_DIR);

const PORT = 10102 + Math.floor(Math.random() * 500);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, what, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        const v = fn();
        if (v) return v;
        await sleep(100);
    }
    throw new Error(`Timed out waiting for ${what}`);
}

function startPlc() {
    const proc = spawn('uv', ['run', '--quiet', '--with', 'python-snap7', 'python', path.join(__dirname, 's7-sim.py'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
    return new Promise((resolve, reject) => {
        proc.stdout.on('data', d => { if (/S7 sim on/.test(d)) resolve(proc); });
        proc.on('exit', code => reject(new Error(`PLC simulator exited (${code})`)));
        setTimeout(() => reject(new Error('PLC simulator did not start')), 60000);
    });
}

async function main() {
    console.log(`Node-RED ${require(path.join(RED_DIR, 'package.json')).version}, S7 simulator on port ${PORT}`);
    const plc = await startPlc();
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 's7-e2e-'));
    const server = http.createServer();
    RED.init(server, { httpAdminRoot: false, httpNodeRoot: false, userDir, nodesDir: path.join(__dirname, '..', '..', 'red'), logging: { console: { level: process.env.E2E_LOG || 'off' } } });
    await new Promise(r => server.listen(0, r));
    // The runtime loads the (empty) stored flows after RED.start() resolves: deploying before
    // that first start finishes gets overwritten, so wait for it
    const firstStart = new Promise(r => RED.events.once('flows:started', r));
    await RED.start();
    await firstStart;
    let failed = 0;
    try {
        // Public runtime API (the internal RED.nodes.setFlows signature differs between Node-RED versions)
        await RED.runtime.flows.setFlows({ flows: { flows: [
            { id: 'tab', type: 'tab', label: 'e2e' },
            { id: 'ep', type: 's7 endpoint', transport: 'iso-on-tcp', address: '127.0.0.1', port: String(PORT), rack: '0', slot: '2', connmode: 'rack-slot', cycletime: 300, timeout: 2000, vartable: [{ name: 'temperature', addr: 'DB1,REAL0' }] },
            { id: 'in', type: 's7 in', z: 'tab', endpoint: 'ep', mode: 'all', diff: false, wires: [[]] },
            { id: 'ctl', type: 's7 control', z: 'tab', endpoint: 'ep', function: 'setvartable', wires: [[]] }
        ] }, deploymentType: 'full' });
        // Node-RED 3 only starts nodes that belong to a tab (z)
        const node = await waitFor(() => RED.nodes.getNode('ctl') && RED.nodes.getNode('in'), 'flow start');
        const ctl = RED.nodes.getNode('ctl');
        let last = null;
        const ctlOut = [];
        const warnings = [];
        node.send = msg => { last = msg.payload; };
        ctl.send = msg => { ctlOut.push(msg); };
        const warn = ctl.warn.bind(ctl);
        ctl.warn = m => { warnings.push(String(m)); warn(m); };

        // Control node reports errors through done(err) -> node.error(err, msg)
        const errors = [];
        const error = ctl.error.bind(ctl);
        ctl.error = (e, msg) => { errors.push(String(e && e.message || e)); return error(e, msg); };

        const readsExactly = async (expected, what) => {
            const got = await waitFor(() => last && JSON.stringify(Object.keys(last).sort()) === JSON.stringify(Object.keys(expected).sort()) && last, what);
            assert.deepStrictEqual(got, expected);
        };
        const run = async (name, fn) => {
            try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failed++; console.log(`  ❌ ${name}\n     ${err.message}`); }
        };

        await run('initial table from the endpoint config is read', () => readsExactly({ temperature: 21.5 }, 'initial read'));

        await run('array in msg.payload replaces the table; invalid entry warned', async () => {
            ctl.receive({ payload: [{ name: 'pressure', addr: 'DB1,REAL4' }, { name: 'counter', addr: 'DB1,INT8' }, { name: 'broken' }] });
            await readsExactly({ pressure: 1.25, counter: 42 }, 'payload-array table');
            assert.strictEqual(warnings.length, 1);
            assert.match(warnings[0], /ignored 1 invalid entry from msg\.payload/);
            assert.deepStrictEqual(ctlOut[0].payload, { vartable: [{ name: 'pressure', addr: 'DB1,REAL4' }, { name: 'counter', addr: 'DB1,INT8' }] });
            assert.deepStrictEqual(ctlOut[0].vartable, ctlOut[0].payload.vartable);
        });

        await run('text format still works', async () => {
            ctl.receive({ payload: 'DB1,X12.0;pump\r\nDB1,REAL0;temperature' });
            await readsExactly({ pump: true, temperature: 21.5 }, 'text table');
        });

        await run('output of a previous setvartable (msg.payload.vartable) can be fed back', async () => {
            ctl.receive({ payload: { vartable: ctlOut[0].payload.vartable } });
            await readsExactly({ pressure: 1.25, counter: 42 }, 'round-trip table');
        });

        await run('msg.vartable still works and wins over msg.payload', async () => {
            ctl.receive({ vartable: [{ name: 'temperature', addr: 'DB1,REAL0' }], payload: [{ name: 'counter', addr: 'DB1,INT8' }] });
            await readsExactly({ temperature: 21.5 }, 'msg.vartable table');
        });

        await run('all-invalid input is an error and keeps the current table', async () => {
            const before = ctlOut.length;
            ctl.receive({ vartable: [{ name: 'x' }] });
            await waitFor(() => errors.length, 'error');
            assert.match(errors[0], /No valid entry in msg\.vartable/);
            assert.strictEqual(ctlOut.length, before);
            last = null;
            await readsExactly({ temperature: 21.5 }, 'unchanged table');
        });

        // --- Writes (S7 Out): a multi-item request with odd-length items exercises the
        // fill bytes between data items (broken in @st-one-io/nodes7 1.1.2, fixed in @oriolrius/nodes7 1.1.3)
        await RED.runtime.flows.setFlows({ flows: { flows: [
            { id: 'tab', type: 'tab', label: 'e2e' },
            { id: 'ep', type: 's7 endpoint', transport: 'iso-on-tcp', address: '127.0.0.1', port: String(PORT), rack: '0', slot: '2', connmode: 'rack-slot', cycletime: 300, timeout: 2000,
                vartable: [{ name: 'pressure', addr: 'DB1,REAL4' }, { name: 'b1', addr: 'DB1,BYTE20' }, { name: 'b2', addr: 'DB1,BYTE21' }, { name: 'b3', addr: 'DB1,BYTE23' },
                    { name: 'flag', addr: 'DB1,X30.3' }, { name: 'counter2', addr: 'DB1,INT32' }] },
            { id: 'in', type: 's7 in', z: 'tab', endpoint: 'ep', mode: 'all', diff: false, wires: [[]] },
            { id: 'out', type: 's7 out', z: 'tab', endpoint: 'ep', variable: '', wires: [[]] }
        ] }, deploymentType: 'full' });
        const inNode = await waitFor(() => RED.nodes.getNode('out') && RED.nodes.getNode('in'), 'write flow start');
        const out = RED.nodes.getNode('out');
        let reads = null;
        const outMsgs = [];
        inNode.send = msg => { reads = msg.payload; };
        out.send = msg => { outMsgs.push(msg); };
        await waitFor(() => reads, 'first read of the write flow');
        const write = async (variable, payload) => {
            const before = outMsgs.length;
            out.receive({ variable, payload });
            return waitFor(() => outMsgs.length > before && outMsgs[outMsgs.length - 1], `write result for ${variable}`);
        };
        const readsInclude = (expected, what) => waitFor(() => reads && Object.entries(expected).every(([k, v]) => reads[k] === v) && reads, what);

        await run('S7 Out writes a single REAL and reads it back', async () => {
            const res = await write('pressure', 3.5);
            assert.strictEqual(res.payload.error, undefined, String(res.payload.error));
            assert.strictEqual(res.payload.bingo, true, JSON.stringify(res.payload.wrongValues));
            await readsInclude({ pressure: 3.5 }, 'pressure = 3.5');
        });

        await run('S7 Out multi-item write with odd-length items (BYTE, BYTE, BYTE, bit, INT) lands on the right addresses', async () => {
            const res = await write(['b1', 'b2', 'b3', 'flag', 'counter2'], [0x11, 0x22, 0x33, true, -1234]);
            assert.strictEqual(res.payload.error, undefined, String(res.payload.error));
            assert.strictEqual(res.payload.bingo, true, JSON.stringify(res.payload.wrongValues));
            await readsInclude({ b1: 0x11, b2: 0x22, b3: 0x33, flag: true, counter2: -1234 }, 'multi-item values');
            // untouched neighbours must keep their values (no shifted bytes)
            assert.strictEqual(reads.pressure, 3.5);
        });
    } finally {
        await RED.stop().catch(() => {});
        server.close();
        plc.kill();
        fs.rmSync(userDir, { recursive: true, force: true });
    }
    const version = require(path.join(RED_DIR, 'package.json')).version;
    console.log(failed ? `\n❌ Node-RED ${version}: ${failed} E2E test(s) failed` : `\n🎉 Node-RED ${version}: setvartable E2E all passed`);
    process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
