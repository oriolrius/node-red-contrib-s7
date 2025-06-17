//@ts-check

function nrInputShim(node, fn) {
    node.on('input', function (msg, send, done) {
        send = send || node.send;
        done = done || (err => err && node.error(err, msg));
        fn(msg, send, done);
    });
}

/**
 * Compares two values for equality, includes special handling for arrays. Fixes #33
 * @param {number|string|Array|Date} a
 * @param {number|string|Array|Date} b 
 */
function equals(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length != b.length) return false;

        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    return false;
}

var MIN_CYCLE_TIME = 50;

var tools = require('../src/tools.js');

module.exports = function (RED) {
    "use strict";

    var { S7Endpoint: S7EndpointClass, S7ItemGroup } = require('@st-one-io/nodes7');
    var EventEmitter = require('events').EventEmitter;

    // ---------- Discovery Endpoints ----------

    RED.httpAdmin.get('/__node-red-contrib-s7/discover/available/iso-on-tcp', RED.auth.needsPermission('s7.discover'), function (req, res) {
        tools.isPnToolsAvailable().then(function (available) {
            res.json(available).end();
        }).catch(() => {
            res.status(500).end();
        });
    });

    RED.httpAdmin.get('/__node-red-contrib-s7/discover/iso-on-tcp', RED.auth.needsPermission('s7.discover'), function (req, res) {
        tools.listDevicesPN().then(function (devices) {
            res.json(devices).end();
        }).catch(() => {
            res.status(500).end();
        });
    });

    RED.httpAdmin.get('/__node-red-contrib-s7/flashled/iso-on-tcp/:mac', RED.auth.needsPermission('s7.discover'), function (req, res) {
        let mac_addr = (req.params.mac || '').replace(/-/g, ':');
        if (!/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac_addr)) {
            res.status(400).end();
            return;
        }

        tools.flashLedPN(mac_addr).then(function () {
            res.status(204).end();
        }).catch(() => {
            res.status(500).end();
        });
    });

    // ---------- S7 Endpoint ----------

    function createTranslationTable(vars) {
        var res = {};

        vars.forEach(function (elm) {
            if (!elm.name || !elm.addr) {
                //skip incomplete entries
                return;
            }
            res[elm.name] = elm.addr;
        });

        return res;
    }

    function generateStatus(status, val) {
        var obj;

        if (typeof val != 'string' && typeof val != 'number' && typeof val != 'boolean') {
            val = RED._("s7.endpoint.status.online");
        }

        switch (status) {
            case 'online':
                obj = {
                    fill: 'green',
                    shape: 'dot',
                    text: val.toString()
                };
                break;
            case 'badvalues':
                obj = {
                    fill: 'yellow',
                    shape: 'dot',
                    text: RED._("s7.endpoint.status.badvalues")
                };
                break;
            case 'offline':
                obj = {
                    fill: 'red',
                    shape: 'dot',
                    text: RED._("s7.endpoint.status.offline")
                };
                break;
            case 'connecting':
                obj = {
                    fill: 'yellow',
                    shape: 'dot',
                    text: RED._("s7.endpoint.status.connecting")
                };
                break;
            default:
                obj = {
                    fill: 'grey',
                    shape: 'dot',
                    text: RED._("s7.endpoint.status.unknown")
                };
        }
        return obj;
    }

    function validateTSAP(num) {
        num = num.toString();
        if (num.length != 2) return false;
        if (!(/^[0-9a-fA-F]+$/.test(num))) return false;
        var i = parseInt(num, 16);
        if (isNaN(i) || i < 0 || i > 0xff) return false;
        return true;
    }

    function S7Endpoint(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        var oldValues = {};
        var status;
        var readInProgress = false;
        var readDeferred = 0;
        var connected = false;
        var currentCycleTime = config.cycletime;
        var transport = config.transport || 'iso-on-tcp';

        //avoids warnings when we have a lot of S7In nodes
        this.setMaxListeners(0);

        node.endpoint = null;
        let connOpts;
        let itemGroup;
        let s7ConnOpts = { timeout: parseInt(config.timeout) }

        if (transport === 'mpi-s7') {

            node.adapter = RED.nodes.getNode(config.adapter);
            if (!node.adapter) {
                return node.error(RED._("s7.error.missingconfig"));
            }

            s7ConnOpts.maxJobs = 1;

            connOpts = {
                customTransport: async () => node.adapter.getStream(config.busaddr),
                s7ConnOpts
            }

        } else if (transport === 'iso-on-tcp') {

            switch (config.connmode) {
                case "rack-slot":
                    connOpts = {
                        host: config.address,
                        port: Number(config.port),
                        rack: Number(config.rack),
                        slot: Number(config.slot),
                        s7ConnOpts: s7ConnOpts
                    }
                    break;
                case "tsap":
                    if (!validateTSAP(config.localtsaphi) ||
                        !validateTSAP(config.localtsaplo) ||
                        !validateTSAP(config.remotetsaphi) ||
                        !validateTSAP(config.remotetsaplo)) {
                        node.error(RED._("s7.error.invalidtsap", config));
                        return;
                    }

                    let localTSAP = parseInt(config.localtsaphi, 16) << 8;
                    localTSAP += parseInt(config.localtsaplo, 16);
                    let remoteTSAP = parseInt(config.remotetsaphi, 16) << 8;
                    remoteTSAP += parseInt(config.remotetsaplo, 16);

                    connOpts = {
                        host: config.address,
                        port: config.port,
                        srcTSAP: localTSAP,
                        dstTSAP: remoteTSAP,
                        s7ConnOpts: s7ConnOpts
                    }
                    break;
                default:
                    node.error(RED._("s7.error.invalidconntype", config));
                    return;
            }
        } else {
            node.error(RED._("s7.error.invalidconntype", config));
            return;
        }

        node._vars = createTranslationTable(config.vartable);

        // ORC
        node.setVars = function(newVarTable) {
            itemGroup = new S7ItemGroup(node.endpoint);
            node._vars = createTranslationTable(newVarTable);
            
            // Use a simple function to prevent circular references
            itemGroup.setTranslationCB(key => node._vars[key]);
            
            let varKeys = Object.keys(node._vars)
            if (varKeys && varKeys.length) {
                itemGroup.addItems(varKeys);
            }
            node.itemGroup = itemGroup;
            // Notify variable changes
            node.emit('__VARS_CHANGED__', varKeys);
        };


        node.getStatus = function getStatus() {
            return status;
        };

        node.writeVar = function writeVar(obj) {
            itemGroup.writeItems(obj.name, obj.val)
                .then(() => obj.done())
                .catch(e => obj.done(e))
        };

        /**
         * updates the current cycle time on the fly. A value of 0
         * disables the cyclic reading of variables, and for positive values
         * a minimum of 50 ms is enforced
         * 
         * @param {number} interval the cycle time interval, in ms
         * @returns {string|undefined} an string with the error if any, or undefined
         */
        node.updateCycleTime = function updateCycleTime(interval) {
            let time = parseInt(interval);

            if (isNaN(time) || time < 0) {
                return RED._("s7.error.invalidtimeinterval", { interval: interval });
            }

            clearInterval(node._td);

            // don't set a new timer if value is zero
            if (!time) return;

            if (time < MIN_CYCLE_TIME) {
                node.warn(RED._("s7.info.cycletimetooshort", { min: MIN_CYCLE_TIME }), {});
                time = MIN_CYCLE_TIME;
            }

            currentCycleTime = time;
            node._td = setInterval(doCycle, time);
        }

        function manageStatus(newStatus) {
            if (status == newStatus) return;

            status = newStatus;
            node.emit('__STATUS__', {
                status: status
            });
        }

        function cycleCallback(values) {
            readInProgress = false;

            if (readDeferred && connected) {
                doCycle();
                readDeferred = 0;
            }

            manageStatus('online');

            var changed = false;
            node.emit('__ALL__', values);
            Object.keys(values).forEach(function (key) {
                if (!equals(oldValues[key], values[key])) {
                    changed = true;
                    node.emit(key, values[key]);
                    node.emit('__CHANGED__', {
                        key: key,
                        value: values[key]
                    });
                    oldValues[key] = values[key];
                }
            });
            if (changed) node.emit('__ALL_CHANGED__', values);
        }

        function doCycle() {
            if (!readInProgress && connected) {
                itemGroup.readAllItems().then(cycleCallback).catch(e => {
                    node.error(e, {});
                    readInProgress = false;
                });
                readInProgress = true;
            } else {
                readDeferred++;
            }
        }
        node.doCycle = doCycle;

        function onConnect() {
            readInProgress = false;
            readDeferred = 0;
            connected = true;

            manageStatus('online');

            node.updateCycleTime(currentCycleTime);
        }

        function onDisconnect() {
            manageStatus('offline');
            connected = false;
        }

        node.on('close', done => {
            manageStatus('offline');
            if (!node.endpoint) done();

            node.endpoint.disconnect().then(done).catch(e => {
                node.error(e);
            });
        });

        manageStatus('offline');

        node.endpoint = new S7EndpointClass(connOpts);
        node.endpoint.on('connecting', () => manageStatus('connecting'));
        node.endpoint.on('connect', onConnect);
        node.endpoint.on('disconnect', onDisconnect);
        node.endpoint.on('error', (e => {
            manageStatus('offline');
            node.error(e && e.toString(), {});
        }));

        itemGroup = new S7ItemGroup(node.endpoint);
        
        // Safely handle variable translation using a simple function to prevent circular references
        itemGroup.setTranslationCB(key => node._vars[key]);

        let varKeys = Object.keys(node._vars)
        if (!varKeys || !varKeys.length) {
            node.warn(RED._("s7.info.novars"), {});
            return;
        } else {
            itemGroup.addItems(varKeys);
        }

        // Add fields to s7 endpoint node object
        node.itemGroup = itemGroup;
        node.rewritetimes = parseInt(config.rewritetimes);
        node.rewriteinterval = parseInt(config.rewriteinterval);
    }
    // Create a clean constructor function to avoid prototype issues
    function S7EndpointClean(config) {
        return S7Endpoint.call(this, config);
    }
    RED.nodes.registerType("s7 endpoint", S7EndpointClean);

    // ---------- S7 In ----------

    function S7In(config) {
        var node = this;
        var statusVal;
        RED.nodes.createNode(this, config);

        node.endpoint = RED.nodes.getNode(config.endpoint);
        if (!node.endpoint) {
            return node.error(RED._("s7.error.missingconfig"));
        }

        function sendMsg(data, key, status) {
            if (key === undefined) key = '';
            if (data instanceof Date) data = data.getTime();
            
            // Safely handle data that might contain circular references
            var safeData = tools.safeCloneData(data);
            
            var msg = {
                topic: key,
                payload: safeData,
                _s7: {
                    plc: node.endpoint.name,
                    ip: node.endpoint.endpoint && node.endpoint.endpoint._connOptsTcp ? node.endpoint.endpoint._connOptsTcp.host : 'unknown',
                    status: node.endpoint.getStatus() === 'online' ? 'online' : 'offline',
                    time: new Date(),
                }
            };
            statusVal = status !== undefined ? status : safeData;
            node.send(msg);
            node.status(generateStatus(node.endpoint.getStatus(), statusVal));
        }

        function onChanged(variable) {
            sendMsg(variable.value, variable.key, null);
        }

        function onDataSplit(data) {
            Object.keys(data).forEach(function (key) {
                // Use the utility function to safely handle each data value
                sendMsg(data[key], key, null);
            });
        }

        function onData(data) {
            sendMsg(data, config.mode == 'single' ? config.variable : '');
        }

        function onDataSelect(data) {
            onData(data[config.variable]);
        }

        function onEndpointStatus(s) {
            node.status(generateStatus(s.status, statusVal));

            // Only trigger ['online', 'offline'] events
            // if (!['online', 'offline'].includes(node.endpoint.getStatus())) return;
            var msg = {
                topic: '',
                payload: {},
                _s7: {
                    plc: node.endpoint.name,
                    ip: node.endpoint.endpoint && node.endpoint.endpoint._connOptsTcp ? node.endpoint.endpoint._connOptsTcp.host : 'unknown',
                    status: node.endpoint.getStatus() === 'online' ? 'online' : 'offline',
                    time: new Date(),
                }
            };
            node.send(msg);
        }

        // 🟢 Guarda les funcions d’escolta per poder-les treure després
        node._listeners = [];

        function updateVariableListeners(varKeys) {
            // Elimina escoltes anteriors
            node._listeners.forEach(({event, fn}) => node.endpoint.removeListener(event, fn));
            node._listeners = [];

            // Torna a afegir escoltes per les noves variables segons el mode
            if (config.diff) {
                switch (config.mode) {
                    case 'all-split':
                        node.endpoint.on('__CHANGED__', onChanged);
                        node._listeners.push({event: '__CHANGED__', fn: onChanged});
                        break;
                    case 'single':
                        node.endpoint.on(config.variable, onData);
                        node._listeners.push({event: config.variable, fn: onData});
                        break;
                    case 'all':
                    default:
                        node.endpoint.on('__ALL_CHANGED__', onData);
                        node._listeners.push({event: '__ALL_CHANGED__', fn: onData});
                }
            } else {
                switch (config.mode) {
                    case 'all-split':
                        node.endpoint.on('__ALL__', onDataSplit);
                        node._listeners.push({event: '__ALL__', fn: onDataSplit});
                        break;
                    case 'single':
                        node.endpoint.on('__ALL__', onDataSelect);
                        node._listeners.push({event: '__ALL__', fn: onDataSelect});
                        break;
                    case 'all':
                    default:
                        node.endpoint.on('__ALL__', onData);
                        node._listeners.push({event: '__ALL__', fn: onData});
                }
            }
        }

        // Listen for variable changes
        function onVarsChanged(varKeys) {
            updateVariableListeners(varKeys);
        }
        node.endpoint.on('__VARS_CHANGED__', onVarsChanged);
        node._listeners.push({event: '__VARS_CHANGED__', fn: onVarsChanged});

        // Initialize listeners with current variables
        updateVariableListeners(Object.keys(node.endpoint._vars || {}));

        node.status(generateStatus(node.endpoint.getStatus(), statusVal));
        node.endpoint.on('__STATUS__', onEndpointStatus);
        node._listeners.push({event: '__STATUS__', fn: onEndpointStatus});

        node.on('close', function (done) {
            node._listeners.forEach(({event, fn}) => node.endpoint.removeListener(event, fn));
            done();
        });
    }
    RED.nodes.registerType("s7 in", S7In);

    // ---------- S7 Out ----------

    function S7Out(config) {
        var node = this;
        var statusVal;
        RED.nodes.createNode(this, config);

        node.endpoint = RED.nodes.getNode(config.endpoint);
        if (!node.endpoint) {
            return node.error(RED._("s7.error.missingconfig"));
        }

        function onEndpointStatus(s) {
            node.status(generateStatus(s.status, statusVal));
        }

        function onNewMsg(msg, send, done) {
            var writeObj = {
                name: config.variable || msg.variable,
                val: msg.payload,
                done: (error) => {

                    /**
                     * This function is called after the first data write
                     */

                    // Written key
                    const variable = config.variable || msg.variable
                    // Written value
                    const payload = msg.payload
                    // Written keys (array)
                    const variables = Array.isArray(variable) ? variable : [variable]
                    // Written values (array)
                    const payloads = Array.isArray(payload) ? payload : [payload]

                    // Written key-value pairs
                    const values = {}
                    variables.forEach((key, index) => {
                        values[key] = tools.safeCloneData(payloads[index])
                    })

                    // Output message after calling s7-out
                    msg._s7 = {
                        plc: node.endpoint.name,
                        ip: node.endpoint.endpoint && node.endpoint.endpoint._connOptsTcp ? node.endpoint.endpoint._connOptsTcp.host : 'unknown',
                        status: node.endpoint.getStatus() === 'online' ? 'online' : 'offline',
                        time: new Date(),
                    }
                    msg.payload = {
                        variable: variable, // Written key
                        payload: tools.safeCloneData(payload),   // Written value (safely handled)
                        values: values,     // Written key-value pairs
                        newValues: {},      // Latest PLC key-value pairs
                        wrongValues: {},    // Key-value pairs inconsistent with written values
                        bingo: false,       // Whether PLC latest values match written values
                        error: error,       // Error
                        rewriteCount: 0,    // Number of rewrites performed
                    }

                    // Handle errors - done(e) doesn't work; need to use node.error(e)
                    // https://nodered.org/docs/creating-nodes/node-js#handling-errors
                    if (error) {
                        node.error(error)
                        node.send(msg)
                        return
                    }

                    // Read latest values to determine if data needs to be rewritten
                    async function rewrite() {
                        // Delayed reading of latest values
                        if (node.endpoint.rewritetimes && node.endpoint.rewriteinterval) await new Promise(resolve => setTimeout(resolve, node.endpoint.rewriteinterval))
                        try {

                            // Clear previously recorded data
                            msg.payload.newValues = {}
                            msg.payload.wrongValues = {}

                            // Read latest values
                            const newValues = await node.endpoint.itemGroup.readAllItems()
                            for (const key in newValues) {
                                // Only match variables written this time
                                if (variables.includes(key)) {
                                    // Latest PLC key-value pairs
                                    msg.payload.newValues[key] = newValues[key]
                                    // Key-value pairs inconsistent with written values
                                    if (newValues[key] !== values[key]) msg.payload.wrongValues[key] = newValues[key]
                                }
                            }
                            // Determine if data was completely written successfully
                            const v1 = Object.keys(msg.payload.values).length
                            const v2 = Object.keys(msg.payload.newValues).length
                            const v3 = Object.keys(msg.payload.wrongValues).length
                            msg.payload.bingo = v1 === v2 && v3 === 0
                        } catch (e) {
                            // node.error(e)
                        }
                        // Determine if data needs to be rewritten
                        if (!msg.payload.bingo && node.endpoint.rewritetimes > msg.payload.rewriteCount) {

                            // Increment rewrite count
                            msg.payload.rewriteCount++

                            // Uncomment this line to view rewrite records
                            // console.log(`[${new Date().toLocaleString()}] Rewrite:`, msg.payload.rewriteCount, msg.payload.wrongValues, msg.payload.newValues, msg.payload.values)

                            try {
                                await node.endpoint.itemGroup.writeItems(writeObj.name, writeObj.val)
                            }
                            catch (e) {
                                // node.error(e)
                            }
                            // Read latest values to determine if data needs to be rewritten
                            await rewrite()
                            return
                        }

                        // Output message
                        node.send(msg)
                    }

                    // Read latest values to determine if data needs to be rewritten
                    rewrite()
                }
            };

            // Test for the case we're writing multiple vars
            if (Array.isArray(writeObj.name)) {

                if (!Array.isArray(writeObj.val) || writeObj.val.length !== writeObj.name.length) {
                    node.error(RED._("s7.error.valmismatch"));
                    node.status(generateStatus('badvalues', statusVal));
                    return;
                }

                for (const elm of writeObj.name) {
                    if (!node.endpoint._vars[elm]) {
                        node.error(RED._("s7.error.varunknown", { var: elm }));
                        node.status(generateStatus('badvalues', statusVal));
                        return;
                    }
                }

            } else if (!node.endpoint._vars[writeObj.name]) {
                node.error(RED._("s7.error.varunknown", { var: writeObj.name }));
                node.status(generateStatus('badvalues', statusVal));
                return;
            }

            statusVal = writeObj.val;
            node.endpoint.writeVar(writeObj);
            node.status(generateStatus(node.endpoint.getStatus(), statusVal));
        }

        nrInputShim(node, onNewMsg);

        node.status(generateStatus(node.endpoint.getStatus(), statusVal));
        node.endpoint.on('__STATUS__', onEndpointStatus);

        node.on('close', function (done) {
            node.endpoint.removeListener('__STATUS__', onEndpointStatus);
            done();
        });

    }
    RED.nodes.registerType("s7 out", S7Out);


    // ---------- S7 Control ----------

    function S7Control(config) {
        var node = this;
        var statusVal;
        RED.nodes.createNode(this, config);

        node.endpoint = RED.nodes.getNode(config.endpoint);
        if (!node.endpoint) {
            return node.error(RED._("s7.error.missingconfig"));
        }

        function onEndpointStatus(s) {
            node.status(generateStatus(s.status, statusVal));
        }

        function onMessage(msg, send, done) {
            var res;
            let func = config.function || msg.function;
            switch (func) {
                case 'setvartable':
                    var vartable = [];
                    
                    // Check if we have a vartable array (legacy mode)
                    if (Array.isArray(msg.vartable) && msg.vartable.length) {
                        vartable = msg.vartable;
                    } 
                    // Check for text parsing mode (new feature)
                    else if (typeof msg.payload === 'string' && msg.payload.trim()) {
                        // Parse text format: "address;name" per line
                        var lines = msg.payload.trim().split('\n');
                        lines.forEach(function(line) {
                            if (line.trim()) {
                                var parts = line.split(';');
                                if (parts.length === 2) {
                                    var addr = parts[0].trim();
                                    var name = parts[1].trim();
                                    if (addr && name) {
                                        vartable.push({
                                            name: name,
                                            addr: addr
                                        });
                                    }
                                }
                            }
                        });
                    }
                    
                    // Validate we have variables to set
                    if (!Array.isArray(vartable) || !vartable.length) {
                        done('vartable missing or invalid. Expected either msg.vartable array or msg.payload text format "address;name" per line');
                        return;
                    }
                    
                    node.endpoint.setVars(vartable);
                    // Return the new list for output
                    msg.payload = {vartable: vartable};
                    send(msg);
                    done();
                    break;
                case 'cycletime':
                    res = node.endpoint.updateCycleTime(msg.payload);
                    if (res) {
                        done(res);
                    } else {
                        send(msg);
                        done();
                    }
                    break;
                case 'trigger':
                    node.endpoint.doCycle();
                    send(msg);
                    done();
                    break;

                case 'ssl':
                    node.endpoint.endpoint
                        .getSSL(Number(msg && msg.payload && msg.payload.id || 0), Number(msg && msg.payload && msg.payload.index || 0)).then(res => {
                            msg.payload = res;
                            send(msg);
                            done();
                        }).catch(e => {
                            done(e);
                        })
                    break;

                case 'list-blocks':
                    node.endpoint.endpoint
                        .listAllBlocks().then(res => {
                            msg.payload = res;
                            send(msg);
                            done();
                        }).catch(e => {
                            done(e);
                        })
                    break;

                case 'upload-block':
                    node.endpoint.endpoint
                        .uploadBlock(msg && msg.payload && msg.payload.type, Number(msg && msg.payload && msg.payload.number)).then(res => {
                            msg.payload = res;
                            send(msg);
                            done();
                        }).catch(e => {
                            done(e);
                        })
                    break;

                case 'upload-all-blocks':
                    node.endpoint.endpoint
                        .uploadAllBlocks().then(res => {
                            msg.payload = res;
                            send(msg);
                            done();
                        }).catch(e => {
                            done(e);
                        })
                    break;

                case 'all-block-info':
                    node.endpoint.endpoint
                        .getAllBlockInfo().then(res => {
                            msg.payload = res;
                            send(msg);
                            done();
                        }).catch(e => {
                            done(e);
                        })
                    break;

                default:
                    node.error(RED._("s7.error.invalidcontrolfunction", { function: config.function }), msg);
            }
        }

        node.status(generateStatus(node.endpoint.getStatus(), statusVal));

        nrInputShim(node, onMessage);
        node.endpoint.on('__STATUS__', onEndpointStatus);

        node.on('close', function (done) {
            node.endpoint.removeListener('__STATUS__', onEndpointStatus);
            done();
        });

    }
    RED.nodes.registerType("s7 control", S7Control);
};
