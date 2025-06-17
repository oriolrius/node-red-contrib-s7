#!/usr/bin/env node

/**
 * Test script for @oriolrius/node-red-contrib-s7
 * This script loads Node-RED and the S7 module for testing
 */

const RED = require('node-red');
const path = require('path');
const fs = require('fs');

// Configuration for Node-RED
const settings = {
    httpAdminRoot: "/admin",
    httpNodeRoot: "/api",
    userDir: path.join(__dirname, '.node-red'),
    nodesDir: path.join(__dirname, '..', 'red'),
    functionGlobalContext: {},
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },
    // Disable editor for testing
    httpAdminAuth: {
        type: "credentials",
        users: [{
            username: "admin",
            password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.",
            permissions: "*"
        }]
    }
};

async function initializeNodeRED() {
    console.log('Initializing Node-RED...');
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(settings.userDir)) {
        fs.mkdirSync(settings.userDir, { recursive: true });
    }

    try {
        // Initialize Node-RED
        await RED.init(settings);
        console.log('✅ Node-RED initialized successfully');
        
        // Load the S7 module
        console.log('Loading S7 module...');
        const s7ModulePath = path.join(__dirname, '..', 'red', 's7.js');
        
        if (fs.existsSync(s7ModulePath)) {
            try {
                console.log('Loading S7 module from:', s7ModulePath);
                // Load the module
                const s7Module = require(s7ModulePath);
                console.log('S7 module loaded, type:', typeof s7Module);
                
                // Register the module with Node-RED
                if (typeof s7Module === 'function') {
                    console.log('Calling s7Module function with RED...');
                    s7Module(RED);
                    console.log('✅ S7 module loaded and registered successfully');
                } else {
                    console.log('⚠️  S7 module loaded but may not be properly structured');
                }
            } catch (loadError) {
                console.error('❌ Error loading S7 module:', loadError.message);
                console.error('Stack trace:', loadError.stack);
                return false;
            }
        } else {
            console.error('❌ S7 module file not found at:', s7ModulePath);
            return false;
        }

        // Test module registration
        console.log('\nTesting module registration...');
        const nodeTypes = RED.nodes.getNodeList();
        console.log('All registered nodes:', nodeTypes.map(n => `${n.name} (${n.type})`));
        
        const s7Nodes = nodeTypes.filter(node => 
            (node.module && node.module.includes('s7')) || 
            (node.name && node.name.includes('s7')) ||
            (node.type && node.type.includes('s7'))
        );
        
        if (s7Nodes.length > 0) {
            console.log('✅ S7 nodes found in registry:');
            s7Nodes.forEach(node => {
                console.log(`  - ${node.name} (${node.type}) from module: ${node.module}`);
            });
        } else {
            console.log('⚠️  No S7 nodes found in registry');
        }

        return true;
    } catch (error) {
        console.error('❌ Error initializing Node-RED or loading S7 module:', error.message);
        return false;
    }
}

async function testS7NodeCreation() {
    console.log('\nTesting S7 node creation...');
    
    try {
        // Create a test flow with S7 nodes
        const testFlow = [
            {
                id: "test-s7-endpoint",
                type: "s7 endpoint",
                name: "Test S7 Endpoint",
                transport: "iso-on-tcp",
                address: "192.168.1.10",
                port: "102",
                rack: "0",
                slot: "2"
            },
            {
                id: "test-s7-in",
                type: "s7 in",
                name: "Test S7 Input",
                endpoint: "test-s7-endpoint",
                mode: "single",
                variable: "DB1,X0.0"
            }
        ];

        // Deploy the test flow
        if (RED.nodes.setFlows) {
            await RED.nodes.setFlows(testFlow);
        } else {
            console.log('⚠️  RED.nodes.setFlows not available, skipping flow deployment');
            return;
        }
        console.log('✅ Test flow deployed successfully');
        
        // Get the created nodes
        const endpointNode = RED.nodes.getNode("test-s7-endpoint");
        const inputNode = RED.nodes.getNode("test-s7-in");
        
        if (endpointNode && inputNode) {
            console.log('✅ S7 nodes created successfully');
            console.log(`  - Endpoint node: ${endpointNode.name}`);
            console.log(`  - Input node: ${inputNode.name}`);
        } else {
            console.log('⚠️  Could not retrieve created nodes');
        }

    } catch (error) {
        console.error('❌ Error testing S7 node creation:', error.message);
    }
}

async function cleanup() {
    console.log('\nCleaning up...');
    try {
        await RED.stop();
        console.log('✅ Node-RED stopped successfully');
    } catch (error) {
        console.error('❌ Error stopping Node-RED:', error.message);
    }
}

// Main test execution
async function runTests() {
    console.log('🚀 Starting Node-RED S7 Module Test\n');
    
    const initialized = await initializeNodeRED();
    
    if (initialized) {
        await testS7NodeCreation();
        
        // Keep the test running for a short time to allow for any async operations
        console.log('\nWaiting for operations to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await cleanup();
    
    console.log('\n🎯 Test completed!');
    process.exit(initialized ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n⏹️  Received SIGINT, cleaning up...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Received SIGTERM, cleaning up...');
    await cleanup();
    process.exit(0);
});

// Run the tests
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = {
    runTests,
    initializeNodeRED,
    testS7NodeCreation,
    cleanup
};
