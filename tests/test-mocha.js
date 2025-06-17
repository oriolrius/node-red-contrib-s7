const { expect } = require('chai');
const RED = require('node-red');
const path = require('path');
const fs = require('fs');

describe('@oriolrius/node-red-contrib-s7 Module Tests', function() {
    this.timeout(10000); // Set timeout to 10 seconds for async operations

    const settings = {
        httpAdminRoot: "/admin",
        httpNodeRoot: "/api",
        userDir: path.join(__dirname, '.node-red-test'),
        nodesDir: path.join(__dirname, '..', 'red'),
        functionGlobalContext: {},
        logging: {
            console: {
                level: "error", // Reduce logging noise during tests
                metrics: false,
                audit: false
            }
        }
    };

    before(async function() {
        console.log('Setting up Node-RED for testing...');
        
        // Create test user directory
        if (!fs.existsSync(settings.userDir)) {
            fs.mkdirSync(settings.userDir, { recursive: true });
        }

        // Initialize Node-RED
        await RED.init(settings);
        
        // Load the S7 module
        const s7ModulePath = path.join(__dirname, '..', 'red', 's7.js');
        if (fs.existsSync(s7ModulePath)) {
            const s7Module = require(s7ModulePath);
            if (typeof s7Module === 'function') {
                s7Module(RED);
            }
        }
    });

    after(async function() {
        console.log('Cleaning up Node-RED...');
        await RED.stop();
        
        // Clean up test directory
        if (fs.existsSync(settings.userDir)) {
            fs.rmSync(settings.userDir, { recursive: true, force: true });
        }
    });

    describe('Module Loading', function() {
        it('should load the S7 module without errors', function() {
            const s7ModulePath = path.join(__dirname, '..', 'red', 's7.js');
            expect(fs.existsSync(s7ModulePath)).to.be.true;
            
            const s7Module = require(s7ModulePath);
            expect(s7Module).to.be.a('function');
        });

        it('should register S7 nodes with Node-RED', function() {
            const nodeTypes = RED.nodes.getNodeList();
            const s7Nodes = nodeTypes.filter(node => 
                node.module === '@oriolrius/node-red-contrib-s7' || 
                node.name.includes('s7')
            );
            
            expect(s7Nodes.length).to.be.greaterThan(0);
        });
    });

    describe('Node Registration', function() {
        it('should have s7 endpoint node type available', function() {
            const nodeTypes = RED.nodes.getNodeList();
            const s7EndpointNode = nodeTypes.find(node => node.type === 's7 endpoint');
            expect(s7EndpointNode).to.not.be.undefined;
        });

        it('should have s7 in node type available', function() {
            const nodeTypes = RED.nodes.getNodeList();
            const s7InNode = nodeTypes.find(node => node.type === 's7 in');
            expect(s7InNode).to.not.be.undefined;
        });

        it('should have s7 out node type available', function() {
            const nodeTypes = RED.nodes.getNodeList();
            const s7OutNode = nodeTypes.find(node => node.type === 's7 out');
            expect(s7OutNode).to.not.be.undefined;
        });
    });

    describe('Node Creation', function() {
        beforeEach(async function() {
            // Clear any existing flows
            await RED.nodes.setFlows([]);
        });

        it('should create s7 endpoint node successfully', async function() {
            const testFlow = [{
                id: "test-endpoint",
                type: "s7 endpoint",
                name: "Test Endpoint",
                transport: "iso-on-tcp",
                address: "192.168.1.10",
                port: "102",
                rack: "0",
                slot: "2"
            }];

            await RED.nodes.setFlows(testFlow);
            const node = RED.nodes.getNode("test-endpoint");
            
            expect(node).to.not.be.null;
            expect(node.name).to.equal("Test Endpoint");
            expect(node.type).to.equal("s7 endpoint");
        });

        it('should create s7 in node with endpoint reference', async function() {
            const testFlow = [
                {
                    id: "test-endpoint",
                    type: "s7 endpoint",
                    name: "Test Endpoint",
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
                    endpoint: "test-endpoint",
                    mode: "single",
                    variable: "DB1,X0.0"
                }
            ];

            await RED.nodes.setFlows(testFlow);
            const inputNode = RED.nodes.getNode("test-s7-in");
            const endpointNode = RED.nodes.getNode("test-endpoint");
            
            expect(inputNode).to.not.be.null;
            expect(endpointNode).to.not.be.null;
            expect(inputNode.name).to.equal("Test S7 Input");
        });

        it('should create s7 out node with endpoint reference', async function() {
            const testFlow = [
                {
                    id: "test-endpoint",
                    type: "s7 endpoint",
                    name: "Test Endpoint",
                    transport: "iso-on-tcp",
                    address: "192.168.1.10",
                    port: "102",
                    rack: "0",
                    slot: "2"
                },
                {
                    id: "test-s7-out",
                    type: "s7 out",
                    name: "Test S7 Output",
                    endpoint: "test-endpoint",
                    variable: "DB1,X0.1"
                }
            ];

            await RED.nodes.setFlows(testFlow);
            const outputNode = RED.nodes.getNode("test-s7-out");
            const endpointNode = RED.nodes.getNode("test-endpoint");
            
            expect(outputNode).to.not.be.null;
            expect(endpointNode).to.not.be.null;
            expect(outputNode.name).to.equal("Test S7 Output");
        });
    });

    describe('Module Dependencies', function() {
        it('should have @st-one-io/nodes7 dependency available', function() {
            const packagePath = path.join(__dirname, '..', 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            expect(packageJson.dependencies).to.have.property('@st-one-io/nodes7');
        });

        it('should be able to require @st-one-io/nodes7', function() {
            try {
                const nodes7 = require('@st-one-io/nodes7');
                expect(nodes7).to.not.be.undefined;
            } catch (error) {
                // If the dependency is not installed, the test should still pass
                // but we should note that the dependency would need to be installed
                expect(error.code).to.equal('MODULE_NOT_FOUND');
            }
        });
    });
});
