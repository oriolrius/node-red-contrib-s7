# Minimal Siemens S7 PLC simulator for the E2E test (python-snap7 server).
# DB1: REAL0=21.5, REAL4=1.25, INT8=42, X12.0=true. Usage: s7-sim.py [port]
import sys, time, ctypes, snap7
from snap7.type import SrvArea
port = int(sys.argv[1]) if len(sys.argv) > 1 else 10102
srv = snap7.server.Server()
db1 = (ctypes.c_ubyte * 64)()
import struct
struct.pack_into('>f', db1, 0, 21.5)     # DB1,REAL0
struct.pack_into('>f', db1, 4, 1.25)     # DB1,REAL4
struct.pack_into('>h', db1, 8, 42)       # DB1,INT8
db1[12] = 0b00000001                      # DB1,X12.0 = true
srv.register_area(SrvArea.DB, 1, db1)
srv.start(tcp_port=port)
print('S7 sim on', port, flush=True)
while True: time.sleep(1)
