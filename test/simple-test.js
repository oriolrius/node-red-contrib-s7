#!/usr/bin/env node

/**
 * Simplified test to isolate the cyclic __proto__ value error
 */

const RED = require('node-red');
const path = require('path');

console.log('🚀 Starting Simple S7 Module Test\n');

// Minimal Node-RED settings
const settings = {
    userDir: path.join(__dirname, '.simple-test'),
    functionGlobalContext: {},
    logging: {
        console: {
            level: "error",
            metrics: false,
            audit: false
        }
    }
};

async function testModule() {
    try {
        console.log('Initializing Node-RED...');
        await RED.init(settings);
        console.log('✅ Node-RED initialized');
        
        console.log('Loading S7 module...');
        const s7ModulePath = path.join(__dirname, '..', 'red', 's7.js');
        
        // Test if the module can be required without errors
        console.log('Requiring module...');
        const s7Module = require(s7ModulePath);
        console.log('✅ Module required successfully');
        
        // Test if the module function can be called
        console.log('Calling module function...');
        if (typeof s7Module === 'function') {
            s7Module(RED);
            console.log('✅ Module function called successfully');
        } else {
            console.log('❌ Module is not a function:', typeof s7Module);
        }
        
        console.log('✅ Test passed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
    
    return true;
}

testModule().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
