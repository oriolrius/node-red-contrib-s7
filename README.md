# @oriolrius/node-red-contrib-s7

A Node-RED node to interact with Siemens S7 PLCs, providing comprehensive read/write capabilities and dynamic variable management.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Update Log](#update-log)
- [Node Types](#node-types)
  - [S7 Endpoint (Configuration Node)](#s7-endpoint-configuration-node)
  - [S7 In Node](#s7-in-node)
  - [S7 Out Node](#s7-out-node)
  - [S7 Control Node](#s7-control-node)
- [Dynamic Variable Table Management](#dynamic-variable-table-management)
- [Usage Guide](#usage-guide)
- [Variable Addressing](#variable-addressing)
- [Notes on S7-1200/1500](#notes-on-s7-12001500)
- [Notes on Logo! 8](#notes-on-logo-8)
- [Troubleshooting](#troubleshooting)
- [Example Flows](#example-flows)
- [Acknowledgments](#acknowledgments)
- [Support and Contributing](#support-and-contributing)
- [License](#license)

## Features

- **Multiple PLC Support**: Connect to S7-300, S7-400, S7-1200, S7-1500, and Logo! 8 PLCs
- **Dynamic Variable Management**: Runtime reconfiguration of monitored variables without flow restart
- **Flexible Data Types**: Support for all standard S7 data types including REAL, INT, DINT, BOOL, STRING, and timestamps
- **Multiple Connection Modes**: ISO-on-TCP with Rack/Slot or TSAP addressing
- **Advanced Control Functions**: SSL certificate access, block upload/download, and diagnostic functions
- **Internationalization**: Support for English, German, and Simplified Chinese
- **Automatic Retry Logic**: Configurable failure rewrite with interval-based retry mechanisms

## Installation

Install directly from the Node-RED palette manager or run the following command in your Node-RED user directory:

```bash
npm install @oriolrius/node-red-contrib-s7
```

**Requirements:**
- Node.js version 10 or greater
- Node-RED version 1.0 or greater

## Quick Start

1. **Add an S7 Endpoint**: Configure your PLC connection details (IP, rack/slot, variables)
2. **Add S7 In nodes**: Monitor PLC variables with configurable update modes
3. **Add S7 Out nodes**: Write data to PLC variables with automatic verification
4. **Add S7 Control nodes**: Perform advanced operations like dynamic variable management

## Update Log

For detailed version history and changes, see [CHANGELOG.md](docs/CHANGELOG.md).

## Node Types

This package provides four main node types for comprehensive S7 PLC integration:

### S7 Endpoint (Configuration Node)

The **S7 Endpoint** is a configuration node that defines the connection to your PLC. Each endpoint represents one PLC connection and can be shared among multiple S7 nodes.

**Configuration Options:**
- **Transport**: ISO-on-TCP or MPI-S7 (requires separate adapter)
- **Connection Mode**: Rack/Slot or TSAP addressing
- **Address**: PLC IP address and port
- **Variable Table**: Define all variables to monitor/write
- **Cycle Time**: Automatic reading interval (minimum 50ms)
- **Timeout**: Connection timeout in milliseconds
- **Retry Settings**: Failure rewrite count and interval

### S7 In Node

The **S7 In** node reads data from the PLC and outputs messages when values change or on each cycle.

**Operating Modes:**
- **Single Variable**: Monitor one specific variable
- **All Variables**: Output all variables as a single object
- **All Variables, One Per Message**: Output each variable as a separate message

**Configuration:**
- **Endpoint**: Select the S7 Endpoint configuration
- **Mode**: Choose the operating mode
- **Variable**: Select specific variable (single mode only)
- **Diff**: Only output when values change (recommended)

**Output Message Structure:**
```json
{
  "topic": "variable_name",
  "payload": "variable_value",
  "_s7": {
    "plc": "PLC_Name",
    "ip": "192.168.1.100",
    "status": "online",
    "time": "2024-07-26T02:15:38.128Z"
  }
}
```

### S7 Out Node

The **S7 Out** node writes data to PLC variables with automatic verification and retry capabilities.

**Features:**
- **Single/Multiple Variable Writing**: Write to one or multiple variables simultaneously
- **Automatic Verification**: Reads back written values to confirm success
- **Retry Logic**: Configurable retry attempts with intervals
- **Detailed Feedback**: Comprehensive write result reporting

**Input Message:**
```json
{
  "payload": "value_to_write",
  "variable": "variable_name"  // Optional if configured in node
}
```

**Output Message Structure:**
```json
{
  "payload": {
    "variable": ["var1", "var2"],
    "payload": [value1, value2],
    "values": {"var1": value1, "var2": value2},
    "newValues": {"var1": actual_value1, "var2": actual_value2},
    "wrongValues": {},
    "bingo": true,
    "error": null,
    "rewriteCount": 0
  },
  "_s7": {
    "plc": "PLC_Name",
    "ip": "192.168.1.100",
    "status": "online",
    "time": "2024-07-26T02:15:38.128Z"
  }
}
```

### S7 Control Node

The **S7 Control** node provides advanced control and diagnostic functions for S7 PLCs.

**Supported Functions:**

#### `cycletime`
Updates the PLC polling interval
```json
{"function": "cycletime", "payload": 200}
```

#### `trigger`
Manually triggers an immediate PLC read cycle
```json
{"function": "trigger"}
```

#### `setvartable`
Dynamically updates the variable table during runtime. Supports both array and text formats.

**Array Format (msg.vartable or msg.payload):**
```json
{
  "function": "setvartable",
  "payload": [
    {"name": "temperature", "addr": "DB1,REAL0"},
    {"name": "pressure", "addr": "DB1,REAL4"}
  ]
}
```

> 💡 Prefer `msg.payload` for new flows. `msg.vartable` remains supported for backward compatibility.

**Text Format (New in v4.2.0):**
```json
{
  "function": "setvartable",
  "payload": "DB1,REAL0;temperature\nDB1,REAL4;pressure"
}
```

**Text Format Details:**
- Format: `address;name` (one variable per line)
- Separator: Semicolon (`;`) between address and name
- Line breaks: Use `\n` or actual newlines
- Whitespace: Automatically trimmed
- Empty lines: Ignored
- Works alongside array input on `msg.payload` or `msg.vartable`
- Perfect for copy-paste from Excel/CSV files

#### `ssl`
Retrieves SSL certificate information
```json
{"function": "ssl", "payload": {"id": 0, "index": 0}}
```

#### `list-blocks`
Lists all program blocks in the PLC
```json
{"function": "list-blocks"}
```

#### `upload-block`
Uploads a specific program block
```json
{"function": "upload-block", "payload": {"type": "DB", "number": 1}}
```

#### `upload-all-blocks`
Uploads all program blocks from the PLC
```json
{"function": "upload-all-blocks"}
```

#### `all-block-info`
Retrieves metadata for all PLC blocks
```json
{"function": "all-block-info"}
```

## Dynamic Variable Table Management

The `setvartable` function provides powerful runtime reconfiguration capabilities for S7 endpoint variable tables. This feature allows you to dynamically update which PLC variables are being monitored without needing to restart Node-RED or reconfigure endpoint nodes.

### How It Works

1. **Variable Table Update**: The S7 Control node accepts a new variable table via `msg.payload` (array or text) or `msg.vartable` (array)
2. **Automatic Propagation**: All S7 In nodes connected to the same endpoint automatically adapt to the new variables
3. **Event-Driven Synchronization**: Uses the internal `__VARS_CHANGED__` event system to notify all nodes
4. **Seamless Operation**: No interruption to existing flows or data processing

### Usage Workflow

1. **Prepare Variable Configuration**: Create either an array of variable objects (`msg.vartable`) or text format (`msg.payload`)
2. **Send to S7 Control Node**: Use a function node, inject node, or direct text input to send the new configuration
3. **Verify Operation**: S7 In nodes will immediately start monitoring the new variables
4. **Monitor Changes**: Existing S7 In nodes automatically update their listeners

### Practical Examples

#### Example 1: Recipe-Based Variable Switching

```javascript
// Function node to switch between different recipe configurations
var recipes = {
    "chocolate": [
        {"name": "temp_mixer", "addr": "DB10,REAL0"},
        {"name": "speed_mixer", "addr": "DB10,INT4"},
        {"name": "time_mixing", "addr": "DB10,INT6"}
    ],
    "vanilla": [
        {"name": "temp_mixer", "addr": "DB11,REAL0"},
        {"name": "speed_mixer", "addr": "DB11,INT4"},
        {"name": "time_mixing", "addr": "DB11,INT6"}
    ]
};

var recipe = msg.payload.recipe || "chocolate";
msg.function = "setvartable";
msg.vartable = recipes[recipe];
return msg;
```

#### Example 2: Conditional Monitoring Based on Production Line

```javascript
// Dynamic variable table based on active production line
var productionLine = msg.payload.line;
var variables = [];

switch(productionLine) {
    case "line1":
        variables = [
            {"name": "conveyor_speed", "addr": "DB1,REAL0"},
            {"name": "part_count", "addr": "DB1,DINT4"},
            {"name": "quality_ok", "addr": "DB1,X8.0"}
        ];
        break;
    case "line2":
        variables = [
            {"name": "conveyor_speed", "addr": "DB2,REAL0"},
            {"name": "part_count", "addr": "DB2,DINT4"},
            {"name": "temperature", "addr": "DB2,REAL8"}
        ];
        break;
}

msg.function = "setvartable";
msg.vartable = variables;
return msg;
```

#### Example 3: Time-Based Variable Configuration

```javascript
// Switch monitoring variables based on shift schedule
var currentHour = new Date().getHours();
var variables;

if (currentHour >= 6 && currentHour < 14) {
    // Day shift variables
    variables = [
        {"name": "operator_count", "addr": "DB100,INT0"},
        {"name": "productivity", "addr": "DB100,REAL2"},
        {"name": "energy_usage", "addr": "DB100,REAL6"}
    ];
} else if (currentHour >= 14 && currentHour < 22) {
    // Evening shift variables
    variables = [
        {"name": "operator_count", "addr": "DB101,INT0"},
        {"name": "productivity", "addr": "DB101,REAL2"},
        {"name": "maintenance_mode", "addr": "DB101,X6.0"}
    ];
} else {
    // Night shift variables (maintenance focus)
    variables = [
        {"name": "maintenance_active", "addr": "DB102,X0.0"},
        {"name": "system_diagnostics", "addr": "DB102,DWORD2"},
        {"name": "backup_systems", "addr": "DB102,X6.0"}
    ];
}

msg.function = "setvartable";
msg.vartable = variables;
return msg;
```

#### Example 4: Text Format for Easy Variable Management

**Excel/CSV Copy-Paste Example:**
```javascript
// Copy variable list directly from Excel/CSV
// Format: address;name (one per line)
var variableList = `
DB1,REAL0;temperature_tank1
DB1,REAL4;pressure_line1
DB1,X0.0;pump_running
DB1,INT8;production_count
DB2,REAL0;temperature_tank2
DB2,REAL4;pressure_line2
DB2,X0.0;valve_open
DB2,INT8;quality_count
`;

msg.function = "setvartable";
msg.payload = variableList.trim();
return msg;
```

**Direct Inject Node Example:**
```json
{
  "function": "setvartable",
  "payload": "DB1,REAL0;temperature\nDB1,REAL4;pressure\nDB1,X0.0;pump_status\nDB1,INT8;counter"
}
```

**Benefits of Text Format:**
- No function node required for simple variable lists
- Easy copy-paste from Excel/CSV files
- Human-readable format
- Automatic whitespace trimming
- Supports both `\n` and actual line breaks

### Important Considerations

- **Variable Addresses**: All addresses must follow the standard S7 addressing scheme documented in the Variable Addressing section
- **Complete Replacement**: The `setvartable` function completely replaces the existing variable table, not just adding to it
- **S7 In Node Adaptation**: Existing S7 In nodes automatically adapt to new variables, but nodes configured for specific variables that no longer exist will stop receiving data
- **Performance**: Variable table updates are immediate, but the first read cycle with new variables may take slightly longer
- **Error Handling**: Invalid addresses or malformed variable objects will cause the operation to fail and return an error
- **Text Format Validation**: Text format requires `address;name` per line with exactly one semicolon separator
- **Backward Compatibility**: Both array format (`msg.vartable`) and text format (`msg.payload`) are supported

### Best Practices

1. **Validate Addresses**: Always validate S7 addresses before sending to avoid runtime errors
2. **Graceful Transitions**: Consider overlapping some variables between configurations for smooth transitions
3. **Logging**: Log variable table changes for debugging and audit purposes
4. **Error Recovery**: Implement fallback variable configurations in case of errors
5. **Testing**: Test variable configurations in development before deploying to production systems

This dynamic capability makes the S7 nodes extremely flexible for applications requiring runtime reconfiguration, such as multi-product manufacturing lines, recipe-based processes, or systems with changing monitoring requirements.

## Usage Guide

### Basic Setup

1. **Create an S7 Endpoint Configuration**
   - Add an S7 Endpoint configuration node
   - Configure connection details (IP address, rack/slot or TSAP)
   - Define your variable table with names and addresses
   - Set cycle time and timeout values

2. **Add S7 Nodes to Your Flow**
   - **S7 In**: For reading PLC data
   - **S7 Out**: For writing data to PLC
   - **S7 Control**: For advanced operations

### S7 In Node Modes

The **S7 In** node offers three operating modes:

#### Single Variable Mode
- Monitors one specific variable from the endpoint's variable table
- `msg.payload` contains the variable's value
- `msg.topic` contains the variable's name
- Use `diff` option to only send messages when the value changes

#### All Variables Mode
- `msg.payload` contains an object with all configured variables and their values
- Single message per cycle containing all data
- Use `diff` option to only send when any variable changes
- Most efficient for monitoring multiple variables

#### All Variables, One Per Message Mode
- Sends separate messages for each variable
- Like single variable mode but for all variables
- **Caution**: Can generate many messages per second
- Consider message rate impact on your flow performance

### Writing Data with S7 Out

The S7 Out node supports both single and multiple variable writing:

#### Single Variable Writing
```javascript
msg.payload = 42;           // Value to write
msg.variable = "temp_sp";   // Variable name (optional if configured in node)
```

#### Multiple Variable Writing
```javascript
msg.payload = [42, true, 100];              // Array of values
msg.variable = ["temp_sp", "pump_on", "speed"];  // Array of variable names
```

### Advanced Control Operations

Use the S7 Control node for advanced operations:

#### Dynamic Variable Management

**Array Format:**
```javascript
// Switch to different monitoring configuration
msg.function = "setvartable";
msg.vartable = [
    {"name": "new_temp", "addr": "DB2,REAL0"},
    {"name": "new_pressure", "addr": "DB2,REAL4"}
];
```

**Text Format (Easy copy-paste from spreadsheets):**
```javascript
// Same configuration using text format
msg.function = "setvartable";
msg.payload = "DB2,REAL0;new_temp\nDB2,REAL4;new_pressure";
```

or

```javascript
// Same configuration using text format
msg.function = "setvartable";
msg.payload = `
DB2,REAL0;new_temp
DB2,REAL4;new_pressure
`;
```

#### Cycle Time Control
```javascript
// Change polling frequency
msg.function = "cycletime";
msg.payload = 500;  // New cycle time in milliseconds
```

#### Manual Trigger
```javascript
// Force immediate read
msg.function = "trigger";
```

## Variable addressing

The variables and their addresses configured on the **S7 Endpoint** follow a slightly different scheme than used on Step 7 or TIA Portal. Here are some examples that may guide you on addressing your variables:

| Address                       | Step7 equivalent      | JS Data type  | Description |
| ----------------------------- | --------------------- | ------------- | ----------- |
| `DB5,X0.1`                    | `DB5.DBX0.1`          | Boolean       | Bit 1 of byte 0 of DB 5 |
| `DB23,B1` or `DB23,BYTE1`     | `DB23.DBB1`           | Number        | Byte 1 (0-255) of DB 23 |
| `DB100,C2` or `DB100,CHAR2`   | `DB100.DBB2`          | String        | Byte 2 of DB 100 as a Char |
| `DB42,I3` or `DB42,INT3`      | `DB42.DBW3`           | Number        | Signed 16-bit number at byte 3 of DB 42 |
| `DB57,WORD4`                  | `DB57.DBW4`           | Number        | Unsigned 16-bit number at byte 4 of DB 57 |
| `DB13,DI5` or `DB13,DINT5`    | `DB13.DBD5`           | Number        | Signed 32-bit number at byte 5 of DB 13 |
| `DB19,DW6` or `DB19,DWORD6`   | `DB19.DBD6`           | Number        | Unsigned 32-bit number at byte 6 of DB 19 |
| `DB21,R7` or `DB21,REAL7`     | `DB21.DBD7`           | Number        | Floating point 32-bit number at byte 7 of DB 21 |
| `DB2,S7.10`*                  | -                     | String        | String of length 10 starting at byte 7 of DB 2 |
| `I1.0` or `E1.0`              | `I1.0` or `E1.0`      | Boolean       | Bit 0 of byte 1 of input area |
| `Q2.1` or `A2.1`              | `Q2.1` or `A2.1`      | Boolean       | Bit 1 of byte 2 of output area |
| `M3.2`                        | `M3.2`                | Boolean       | Bit 2 of byte 3 of memory area |
| `IB4` or `EB4`                | `IB4` or `EB4`        | Number        | Byte 4 (0 -255) of input area |
| `QB5` or `AB5`                | `QB5` or `AB5`        | Number        | Byte 5 (0 -255) of output area |
| `MB6`                         | `MB6`                 | Number        | Byte 6 (0 -255) of memory area |
| `IC7` or `EC7`                | `IB7` or `EB7`        | String        | Byte 7 of input area as a Char |
| `QC8` or `AC8`                | `QB8` or `AB8`        | String        | Byte 8 of output area as a Char |
| `MC9`                         | `MB9`                 | String        | Byte 9 of memory area as a Char |
| `II10` or `EI10`              | `IW10` or `EW10`      | Number        | Signed 16-bit number at byte 10 of input area |
| `QI12` or `AI12`              | `QW12` or `AW12`      | Number        | Signed 16-bit number at byte 12 of output area |
| `MI14`                        | `MW14`                | Number        | Signed 16-bit number at byte 14 of memory area |
| `IW16` or `EW16`              | `IW16` or `EW16`      | Number        | Unsigned 16-bit number at byte 16 of input area |
| `QW18` or `AW18`              | `QW18` or `AW18`      | Number        | Unsigned 16-bit number at byte 18 of output area |
| `MW20`                        | `MW20`                | Number        | Unsigned 16-bit number at byte 20 of memory area |
| `IDI22` or `EDI22`            | `ID22` or `ED22`      | Number        | Signed 32-bit number at byte 22 of input area |
| `QDI24` or `ADI24`            | `QD24` or `AD24`      | Number        | Signed 32-bit number at byte 24 of output area |
| `MDI26`                       | `MD26`                | Number        | Signed 32-bit number at byte 26 of memory area |
| `ID28` or `ED28`              | `ID28` or `ED28`      | Number        | Unsigned 32-bit number at byte 28 of input area |
| `QD30` or `AD30`              | `QD30` or `AD30`      | Number        | Unsigned 32-bit number at byte 30 of output area |
| `MD32`                        | `MD32`                | Number        | Unsigned 32-bit number at byte 32 of memory area |
| `IR34` or `ER34`              | `IR34` or `ER34`      | Number        | Floating point 32-bit number at byte 34 of input area |
| `QR36` or `AR36`              | `QR36` or `AR36`      | Number        | Floating point 32-bit number at byte 36 of output area |
| `MR38`                        | `MR38`                | Number        | Floating point 32-bit number at byte 38 of memory area |
| `DB1,DT0`                     | -                     | Date**        | A timestamp in the DATE_AND_TIME format |
| `DB1,DTZ10`                   | -                     | Date**        | A timestamp in the DATE_AND_TIME format, in UTC |
| `DB2,DTL2`                    | -                     | Date**        | A timestamp in the DTL format |
| `DB2,DTLZ12`                  | -                     | Date**        | A timestamp in the DTL format, in UTC |
| `DB57,RWORD4`                 | `DB57.DBW4`           | Number        | Unsigned 16-bit number at byte 4 of DB 57, interpreted as Little-Endian |
| `DB13,RDI5` or `DB13,RDINT5`  | `DB13.DBD5`           | Number        | Signed 32-bit number at byte 5 of DB 13, interpreted as Little-Endian |
| `MRW20`                       | `MW20`                | Number        | Unsigned 16-bit number at byte 20 of memory area, interpreted as Little-Endian |


- *) Note that strings on the PLC uses 2 extra bytes at start for size/length of the string
- **) Note that javascript's `Date` are _always_ represented in UTC. Please use other nodes like [node-red-contrib-moment](https://flows.nodered.org/node/node-red-contrib-moment) to properly handle type conversions

### Notes on S7-1200/1500

These newer PLCs offer an "extended" version of the S7 Protocol, while we have only a "basic" version of it.

Therefore, some additional configuration steps on the PLC are necessary:

- "Optimized block access" must be disabled for the DBs we want to access ([image](http://snap7.sourceforge.net/snap7_client_file/db_1500.bmp))
- In the "Protection" section of the CPU Properties, enable the "Permit access with PUT/GET" checkbox ([image](http://snap7.sourceforge.net/snap7_client_file/cpu_1500.bmp))

### Notes on Logo! 8

On the newest Logo! 8.FS4 (and possibly 0BA8) Logic modules there is no need to set the Mode to TSAP any more, instead the default Rack/Slot value of 0/2 works just fine.

The following table shows memory areas accessible without additional settings in the controller program:

*Note: These memory areas seem to be read-only from outside the controller, as they are directly used by the function blocks listed in "Logo Block" of the table*

| Logo Block | Logo VM Range | example Node-RED address                          | Description |
|------------|---------------|---------------------------------------------------|-------------|
| `I`        | `1024 - 1031` | `DB1,BYTE1024` or `DB1,X1024.5` or `DB1,WORD1024` | Reads input terminals 1...8 or 6 or 1...16 |
| `AI`       | `1032 - 1063` | `DB1,WORD1032`                                    | Reads analog input terminal 1. Always word sized. |
| `Q`        | `1064 - 1071` | `DB1,BYTE1064` or `DB1,X1064.5` or `DB1,WORD1064` | Reads output terminals 1...8 or 6 or 1...16 |
| `AQ`       | `1072 - 1103` | `DB1,WORD1072`                                    | Reads analog output terminal 1. Always word sized. |
| `M`        | `1104 - 1117` | `DB1,BYTE1104` or `DB1,X1104.5` or `DB1,WORD1104` | Reads bit flags M1...M8 or M6 or M1...16 |
| `AM`       | `1118 - 1245` | `DB1,WORD1118`                                    | Reads analog flag 1. Always word sized. |
| `NI`       | `1246 - 1061` | `DB1,BYTE1246` or `DB1,X1246.5` or `DB1,WORD1246` | Reads network input 1...8 or 6 or 1...16 |
| `NAI`      | `1262 - 1389` | `DB1,WORD1262`                                    | Reads analog network input 1. Always word sized. |
| `NQ`       | `1390 - 1405` | `DB1,BYTE1390` or `DB1,X1390.5` or `DB1,WORD1390` | Reads network output 1...8 or 6 or 1...16 |
| `NAQ`      | `1406 - 1469` | `DB1,WORD1406`                                    | Reads network output 1. Always word sized. |

On the other hand, Logo memory areas VM 0-849 are mutable from outside the controller, but they need to be mapped into the Logo program. Without mapping, data written into these addresses will have no effect on program execution. Used VM addresses in the range mentioned above can be read/written from/into in the Logo program using the "Network" function blocks (in the function block setup use the *"Local variable memory (VM)"* option to map VMs to the function block).

Some addressing examples:

| Logo VM | Example Node-RED address | Description |
|---------|--------------------------|-------------|
| `0`     | `DB1,BYTE0`              | R/W access  |
| `1`     | `DB1,X1.3`               | R/W access Note: use booleans |
| `2..3`  | `DB1,WORD2`              | R/W access  |

## Troubleshooting

### Common Connection Issues

#### "Not connected" Error
- **Check IP Address**: Verify the PLC IP address is correct and reachable
- **Check Port**: Default S7 port is 102, ensure it's not blocked by firewall
- **Check Rack/Slot**: Verify rack and slot numbers match your PLC configuration
- **Network Connectivity**: Test with ping to ensure network connectivity

#### "Timeout" Errors
- **Increase Timeout**: Try increasing the timeout value in the endpoint configuration
- **Network Latency**: Check for network congestion or high latency
- **PLC Load**: High PLC CPU usage can cause timeouts

#### S7-1200/1500 Connection Issues
- **Disable Optimized Block Access**: Must be disabled for accessible DBs
- **Enable PUT/GET**: Check "Permit access with PUT/GET" in CPU properties
- **DB Access Rights**: Ensure DBs are not write-protected

### Variable Addressing Issues

#### "Variable Unknown" Error
- **Check Address Format**: Ensure addresses follow the correct S7 format
- **Case Sensitivity**: Variable names are case-sensitive
- **Address Validation**: Use the variable addressing table as reference

#### Data Type Mismatches
- **String Lengths**: Remember strings use 2 extra bytes for length information
- **Bit Addressing**: Use X notation for bit access (e.g., `DB1,X0.0`)
- **Endianness**: Use R-prefixed types for little-endian interpretation

### Performance Issues

#### High CPU Usage
- **Increase Cycle Time**: Reduce polling frequency if not critical
- **Optimize Variable Count**: Monitor only necessary variables
- **Use Diff Mode**: Enable diff to reduce message frequency

#### Memory Issues
- **Large Variable Tables**: Consider splitting into multiple endpoints
- **Message Queuing**: Monitor Node-RED message queue depth

### Dynamic Variable Management Issues

#### Variables Not Updating After `setvartable`
- **Check Address Format**: Ensure new addresses are correctly formatted
- **Verify S7 In Node Mode**: Some modes may not adapt immediately
- **Check Error Messages**: Look for validation errors in Node-RED logs

### Getting Help

1. **Enable Debug Logging**: Set Node-RED logging to debug level
2. **Check Node-RED Logs**: Look for detailed error messages
3. **Test with Simple Configuration**: Start with basic setup and add complexity
4. **Community Support**: Use Node-RED forum or GitHub issues

## Example Flows

### Basic Monitoring Flow
```json
[
  {
    "id": "basic_endpoint",
    "type": "s7 endpoint",
    "name": "My PLC",
    "address": "192.168.1.100",
    "port": "102",
    "rack": "0",
    "slot": "1",
    "cycletime": "1000",
    "vartable": [
      {"name": "temperature", "addr": "DB1,REAL0"},
      {"name": "pressure", "addr": "DB1,REAL4"}
    ]
  }
]
```

### Complete Example with All Node Types

See the included [example flow](examples/example-flow.json:1) for a comprehensive demonstration of dynamic variable management.

## Acknowledgments

This project builds upon the excellent work of several open source projects:

- **ST-One Ltda.** and **Guilherme Francescon Cittolin** for the original [node-red-contrib-s7](https://github.com/st-one-io/node-red-contrib-s7) implementation
- **Ali-Pay** for their [enhanced version](https://github.com/ali-pay/node-red-contrib-s7) with additional features like dynamic variable table management
- The **nodes7** library developers for providing the core S7 communication functionality
- The **Node-RED** community for creating an amazing platform for IoT development

## Support and Contributing

### Getting Help
- **Node-RED Forum**: Share your experiences on the [Node-RED forum](https://discourse.nodered.org/)
- **GitHub Issues**: Report bugs or request features on [GitHub](https://github.com/oriolrius/node-red-contrib-s7/issues)
- **Documentation**: Check this README and the example flows for guidance

### Contributing
Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

### Reporting Issues
When reporting issues, please include:
- Node-RED version
- Node.js version
- PLC model and firmware version
- Complete error messages
- Minimal flow to reproduce the issue

## License

GNU General Public License v3.0+ (see [LICENSE](LICENSE) or https://www.gnu.org/licenses/gpl-3.0.txt)
