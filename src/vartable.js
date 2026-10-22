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
 * Invalid entries are left out and reported in `ignored`.
 * @param {any[]} items
 * @returns {{ entries: VarTableEntry[], ignored: string[] }}
 */
function normalizeArray(items) {
    const entries = [];
    const ignored = [];
    items.forEach((item, index) => {
        const normalized = normalizeEntry(item);
        if (normalized) {
            entries.push(normalized);
        } else {
            ignored.push(`[${index}] ${JSON.stringify(item)}`);
        }
    });
    return { entries, ignored };
}

/**
 * Parse vartable information from a text block: one "address;name" per line.
 * The name is everything after the first ';'. Lines without both parts are reported in `ignored`.
 * @param {string} text
 * @returns {{ entries: VarTableEntry[], ignored: string[] }}
 */
function parseText(text) {
    const entries = [];
    const ignored = [];
    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line) {
            return;
        }
        const separatorIndex = line.indexOf(';');
        const addr = separatorIndex === -1 ? '' : line.slice(0, separatorIndex).trim();
        const name = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim();
        if (addr && name) {
            entries.push({ name, addr });
        } else {
            ignored.push(`line ${index + 1}: ${JSON.stringify(line)}`);
        }
    });
    return { entries, ignored };
}

const ERROR = 'vartable missing or invalid. Provide msg.vartable (array), msg.payload (array of {name, addr}), ' +
    'msg.payload.vartable (array, as output by setvartable) or msg.payload text with one "address;name" per line.';

/**
 * Extract the variable table from an incoming message. The first source present is used:
 * msg.vartable (array), msg.payload (array), msg.payload.vartable (array), msg.payload (text).
 * A present but invalid source is an error; it does not fall through to the next one.
 * @param {any} msg
 * @returns {{ vartable: VarTableEntry[], ignored: string[], source?: string, error?: string }}
 */
function parseVarTableInput(msg) {
    let source;
    let result;
    if (msg && Array.isArray(msg.vartable)) {
        source = 'msg.vartable';
        result = normalizeArray(msg.vartable);
    } else if (msg && Array.isArray(msg.payload)) {
        source = 'msg.payload';
        result = normalizeArray(msg.payload);
    } else if (msg && msg.payload && typeof msg.payload === 'object' && Array.isArray(msg.payload.vartable)) {
        source = 'msg.payload.vartable';
        result = normalizeArray(msg.payload.vartable);
    } else if (msg && typeof msg.payload === 'string' && msg.payload.trim()) {
        source = 'msg.payload (text)';
        result = parseText(msg.payload.trim());
    } else {
        return { vartable: [], ignored: [], error: ERROR };
    }

    if (!result.entries.length) {
        return { vartable: [], ignored: result.ignored, source, error: `${ERROR} No valid entry in ${source}.` };
    }
    return { vartable: result.entries, ignored: result.ignored, source };
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
