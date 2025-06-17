# S7 PLC Node Usage Example

This document provides a complete example of how to use the @oriolrius/node-red-contrib-s7 nodes to communicate with a Siemens S7 PLC.

## Prerequisites

1. **Node-RED Installation**: Ensure you have Node-RED installed
2. **S7 PLC**: A Siemens S7 PLC accessible via Ethernet
3. **Network Access**: Node-RED must be able to reach the PLC's IP address
4. **PLC Configuration**: The PLC must allow GET/PUT access (typically enabled by default)

## Installation

Install the node package in Node-RED:

```bash
npm install @oriolrius/node-red-contrib-s7
```

Or use the Node-RED palette manager to install `@oriolrius/node-red-contrib-s7`.

## Sample Flow Import

1. Copy the contents of `example-flow.json` from this repository
2. In Node-RED, go to Menu → Import → Clipboard
3. Paste the JSON and click Import
4. Deploy the flow

## Configuration

### 1. S7 Endpoint Node Configuration

The S7 Endpoint node defines the connection to your PLC:

```javascript
{
    "name": "My S7 PLC",
    "address": "192.168.1.10",  // Change to your PLC's IP
    "port": "102",              // Standard S7 port
    "rack": "0",                // Usually 0
    "slot": "2",                // CPU slot (usually 2)
    "cycletime": "1000",        // Read cycle in ms
    "timeout": "8000"           // Connection timeout
}
```

### 2. Variable Table

Define the PLC variables you want to access:

| Variable Name | Address | Data Type | Description |
|---------------|---------|-----------|-------------|
| motor_running | DB1,X0.0 | BOOL | Motor status bit |
| temperature | DB1,INT2 | INT | Temperature value |
| speed_setpoint | DB1,REAL4 | REAL | Speed setpoint |
| alarm_active | DB1,X0.1 | BOOL | Alarm status |
| production_count | DB1,INT8 | INT | Production counter |

## Address Format

The S7 nodes use a specific address format:

- **Data Blocks**: `DB{number},{type}{offset}` (e.g., `DB1,INT4`)
- **Inputs**: `I{byte}.{bit}` (e.g., `I0.0`)
- **Outputs**: `Q{byte}.{bit}` (e.g., `Q0.1`)
- **Memory**: `M{byte}.{bit}` (e.g., `M10.0`)

### Data Types

- **X**: Boolean (bit) - `DB1,X0.0`
- **B**: Byte - `DB1,B0`
- **W**: Word (16-bit) - `DB1,W0`
- **DW**: Double Word (32-bit) - `DB1,DW0`
- **INT**: Integer (16-bit signed) - `DB1,INT2`
- **DINT**: Double Integer (32-bit signed) - `DB1,DINT4`
- **REAL**: Float (32-bit) - `DB1,REAL8`
- **S**: String - `DB1,S12.10` (12=offset, 10=length)

## Node Usage Examples

### 1. Reading Data (S7 In Node)

```javascript
// Configuration
{
    "mode": "all-split",  // Send each variable as separate message
    "diff": true,         // Only send when values change
    "variable": ""        // Leave empty for all variables
}

// Output message format
{
    "topic": "temperature",
    "payload": 42,
    "_s7": {
        "plc": "My S7 PLC",
        "ip": "192.168.1.10",
        "status": "online",
        "time": "2025-06-17T16:59:20.123Z"
    }
}
```

### 2. Writing Data (S7 Out Node)

**Option A: Configure variable in node**
```javascript
// Node configuration
{
    "variable": "motor_running"
}

// Input message
{
    "payload": true  // Value to write
}
```

**Option B: Specify variable in message**
```javascript
// Input message
{
    "payload": 75.5,
    "variable": "speed_setpoint"
}
```

### 3. Control Functions (S7 Control Node)

**Change Cycle Time**
```javascript
// Input message
{
    "payload": 500  // New cycle time in ms
}
```

**Trigger Manual Read**
```javascript
// Configuration
{
    "function": "trigger"
}
```

**Dynamic Variable Table**
```javascript
// Input message
{
    "function": "setvartable",
    "vartable": [
        {"name": "new_var1", "addr": "DB2,INT0"},
        {"name": "new_var2", "addr": "DB2,REAL4"}
    ]
}
```

## Flow Description

The example flow demonstrates:

1. **Continuous Reading**: The S7 In node reads all variables every second
2. **Manual Writing**: Inject nodes to start/stop motor and set speed
3. **Data Filtering**: Switch node filters temperature data
4. **Visualization**: UI gauge shows temperature (requires node-red-dashboard)
5. **Dynamic Control**: Change read cycle time on the fly

## Troubleshooting

### Common Issues

1. **"Class constructor S7Endpoint cannot be invoked without 'new'"**
   - Fixed in version 4.0.11
   - Ensure you're using the latest version

2. **Connection timeout**
   - Verify PLC IP address and network connectivity
   - Check firewall settings
   - Ensure PLC allows GET/PUT access

3. **Variable not found**
   - Verify the address format matches your PLC memory layout
   - Check data block existence in PLC
   - Ensure correct data type

4. **Read/Write errors**
   - Check PLC CPU type compatibility
   - Verify rack and slot numbers
   - Ensure sufficient PLC resources

### Debug Tips

1. **Enable Debug Nodes**: Use debug nodes to monitor data flow
2. **Check Status**: Monitor node status indicators
3. **Console Logs**: Check Node-RED logs for detailed error messages
4. **PLC Diagnostics**: Use PLC programming software to verify variable access

## PLC Setup Requirements

### TIA Portal (S7-1200/1500)
1. Set "Optimized block access" to OFF for data blocks
2. Enable "Permit access with PUT/GET communication"
3. Configure Ethernet interface with static IP

### STEP 7 Classic (S7-300/400)
1. Data blocks should be non-optimized
2. Enable communication in hardware configuration
3. Set up Ethernet communication processor

## Security Considerations

- Use dedicated VLAN for PLC communication
- Implement firewall rules to restrict access
- Consider using VPN for remote access
- Regularly update Node-RED and S7 nodes
- Monitor PLC access logs

## Performance Tips

- Adjust cycle time based on your application needs
- Use "diff: true" to reduce unnecessary messages
- Group related variables in the same data block
- Limit the number of variables for better performance

## Support

For issues and questions:
- GitHub Issues: https://github.com/oriolrius/node-red-contrib-s7/issues
- Documentation: Check README.md for latest updates