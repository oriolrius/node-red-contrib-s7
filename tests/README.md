# Test Suite for @oriolrius/node-red-contrib-s7

This directory contains test scripts for the Node-RED S7 module.

## Files

- `test-module.js` - Standalone test script that loads Node-RED and the S7 module
- `test-mocha.js` - Structured test suite using Mocha and Chai
- `package.json` - Test dependencies and scripts

## Setup

Before running the tests, install the test dependencies:

```bash
cd test
npm install
```

## Running Tests

### Standalone Test Script

Run the basic test script:

```bash
npm test
# or
node test-module.js
```

For verbose output:

```bash
npm run test:verbose
```

### Mocha Test Suite

Run the structured test suite:

```bash
npx mocha test-mocha.js
```

For detailed output:

```bash
npx mocha test-mocha.js --reporter spec
```

## What the Tests Do

### Basic Test Script (`test-module.js`)

1. Initializes Node-RED with custom settings
2. Loads the S7 module from the parent directory  
3. Registers the module with Node-RED
4. Verifies that S7 node types are available
5. Creates test nodes and validates they work
6. Cleans up resources

### Mocha Test Suite (`test-mocha.js`)

Provides structured testing with:

1. **Module Loading Tests**
   - Verifies the S7 module file exists and loads correctly
   - Confirms S7 nodes are registered with Node-RED

2. **Node Registration Tests**  
   - Checks that all expected node types are available
   - Validates s7 endpoint, s7 in, and s7 out node types

3. **Node Creation Tests**
   - Tests creating S7 endpoint nodes
   - Tests creating S7 input nodes with endpoint references
   - Tests creating S7 output nodes with endpoint references

4. **Dependency Tests**
   - Verifies required dependencies are declared
   - Checks that core dependencies can be loaded

## Requirements

- Node.js 14+
- node-red package
- Parent directory should contain the S7 module files

## Notes

- Tests create temporary `.node-red` and `.node-red-test` directories
- These are cleaned up automatically after tests complete
- No actual PLC connections are made - only module loading and node creation are tested
- For integration testing with real PLCs, additional test scripts would be needed
