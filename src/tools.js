//@ts-check

const path = require('path');
const util = require('util');
const os = require('os');
const exec = util.promisify(require('child_process').exec);

const pnToolsPath = 'pn-tools';
const pnDevRoleMask = 0x02;

class Tools {

    constructor() {
        this.pnToolsAvailable = null;
        this.ifaceCache = new Map();
    }

    async isPnToolsAvailable() {
        if (this.pnToolsAvailable === null) {
            try {
                await exec(`${pnToolsPath} version`);
                this.pnToolsAvailable = true;
            } catch (e) {
                this.pnToolsAvailable = false;
            }
        }

        return this.pnToolsAvailable;
    }

    getIfaces() {
        let ifaces = os.networkInterfaces();
        return Object.keys(ifaces).filter(v => {
            const addrList = ifaces[v];
            return addrList && addrList.length > 0 && addrList[0] && !addrList[0].internal;
        });
    }

    async listDevicesPN() {
        if (!await this.isPnToolsAvailable()) return [];

        let proms = [];
        for (const iface of this.getIfaces()) {
            proms.push(
                exec(`${pnToolsPath} discovery -o -i "${iface}"`)
                    .then(res => ({ iface, res }))
                    .catch(err => ({ 
                        iface, 
                        error: err.message || err.toString() 
                    }))
            );
        }

        let devs = [];
        let results = await Promise.all(proms);

        for (const elm of results) {
            if ('error' in elm) {
                console.error(`Discovery failed on interface ${elm.iface}: ${elm.error}`);
                continue;
            }
            
            if (!('res' in elm)) continue;
            
            let iface = elm.iface;
            let out = elm.res.stdout.trim().split('\n');
            if (out.length < 2) continue;

            let keys = out.shift().split('\t');
            for (const row of out) {
                let dev = {};
                let elms = row.split('\t');
                for (const i in elms) {
                    dev[keys[i]] = elms[i];
                }

                this.ifaceCache.set(dev['MAC Address'], iface);
                devs.push(dev);
            }
        }

        // filters out devices that don't have the "IO-Controller" (0x02) bit set
        return devs.filter(val => {
            const role = val['Device Role'];
            return role ? (parseInt(role) & pnDevRoleMask) : false;
        });
    }

    async flashLedPN(mac_addr, iface) {
        if (!await this.isPnToolsAvailable()) return;

        iface = iface || this.ifaceCache.get(mac_addr);
        if (!iface) {
            throw new Error(`Could not determine interface for [${mac_addr}]`);
        }

        await exec(`${pnToolsPath} flashled -i "${iface}" -t "${mac_addr}"`);
    }
}

module.exports = new Tools();
