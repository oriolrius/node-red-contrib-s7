//@ts-check

/**
 * @typedef {{name: string, addr: string}} VarTableEntry
 */

/**
 * Normalize a potential vartable entry into a consistent object.
 * Returns null when the entry is invalid.
 * @param {any} entry
 * @returns {VarTableEntry|null}
 */
function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const name = entry.name != null ? String(entry.name).trim() : '';
    const addr = entry.addr != null ? String(entry.addr).trim() : '';

    if (!name || !addr) {
        return null;
    }

    return { name, addr };
}

/**
 * Normalize an array of vartable entries.
 * Invalid entries are ignored.
 * @param {any[]} items
 * @returns {VarTableEntry[]}
 */
function normalizeArray(items) {
    return items.reduce((acc, item) => {
        const normalized = normalizeEntry(item);
        if (normalized) {
            acc.push(normalized);
        }
        return acc;
    }, /** @type {VarTableEntry[]} */([]));
}

/**
 * Parse vartable information from a text block.
 * @param {string} text
 * @returns {VarTableEntry[]}
 */
function parseText(text) {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
            const separatorIndex = line.indexOf(';');
            if (separatorIndex === -1) {
                return acc;
            }

            const addr = line.slice(0, separatorIndex).trim();
            const name = line.slice(separatorIndex + 1).trim();

            if (addr && name) {
                acc.push({ name, addr });
            }

            return acc;
        }, /** @type {VarTableEntry[]} */([]));
}

/**
 * Extract a vartable array from the incoming message.
 * Accepts msg.vartable, msg.payload (array), msg.payload.vartable, or msg.payload text.
 * @param {any} msg
 * @returns {{ vartable: VarTableEntry[], error?: string }}
 */
function parseVarTableInput(msg) {
    const candidates = [];

    if (msg && Array.isArray(msg.vartable)) {
        candidates.push({ source: 'msg.vartable', value: msg.vartable });
    }

    if (msg && Array.isArray(msg.payload)) {
        candidates.push({ source: 'msg.payload', value: msg.payload });
    }

    if (msg && msg.payload && typeof msg.payload === 'object' && !Array.isArray(msg.payload) && Array.isArray(msg.payload.vartable)) {
        candidates.push({ source: 'msg.payload.vartable', value: msg.payload.vartable });
    }

    for (const candidate of candidates) {
        const normalized = normalizeArray(candidate.value);
        if (normalized.length) {
            return { vartable: normalized };
        }
    }

    if (msg && typeof msg.payload === 'string' && msg.payload.trim()) {
        const parsed = parseText(msg.payload.trim());
        if (parsed.length) {
            return { vartable: parsed };
        }
    }

    return {
        vartable: [],
        error: 'vartable missing or invalid. Provide msg.vartable array, msg.payload array, msg.payload.vartable array, or msg.payload text in the format "address;name" per line.'
    };
}

module.exports = {
    parseVarTableInput,
    // Exported for testing
    _private: {
        normalizeEntry,
        normalizeArray,
        parseText
    }
};
