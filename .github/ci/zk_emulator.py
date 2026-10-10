#!/usr/bin/env python3
"""Minimal ZKTeco TCP device emulator (port 4370 protocol) used by CI to test the
bridge's TCP/IP connector. Follows the real wire format (TCP wrapper, 40-byte
attendance and 72-byte user records, comm-key auth); real devices remain the final test.

Usage: zk_emulator.py PORT [COMMKEY] [IDLE_CLOSE_SECONDS]
"""
import socket, struct, sys, threading, time, datetime

PORT = int(sys.argv[1])
COMMKEY = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] != '0' else 0
IDLE_CLOSE = float(sys.argv[3]) if len(sys.argv) > 3 else 0

CMD_CONNECT, CMD_EXIT, CMD_AUTH = 1000, 1001, 1102
CMD_ACK_OK, CMD_ACK_ERROR, CMD_ACK_UNAUTH = 2000, 2001, 2005
CMD_DATA, CMD_FREE_DATA, CMD_DATA_WRRQ = 1501, 1502, 1503
CMD_OPTIONS_RRQ, CMD_VERSION = 11, 1100
CMD_USER_WRQ, CMD_DELETE_USER, CMD_REFRESHDATA = 8, 18, 1013
USHRT_MAX = 65535
SESSION = 0x4D2

users = {  # uid -> dict
    1: dict(uid=1, priv=0, password='', name='Ayesha Rahman', card=0, user_id='1001'),
    2: dict(uid=2, priv=14, password='123', name='Tanvir Hasan', card=12345, user_id='1002'),
}
today = datetime.date.today()
attendance = [
    # (uid, user_id, verify, datetime, punch)
    (1, '1001', 1, datetime.datetime(today.year, today.month, today.day, 8, 52, 10), 0),
    (2, '1002', 15, datetime.datetime(today.year, today.month, today.day, 9, 31, 45), 0),
    (1, '1001', 1, datetime.datetime(today.year, today.month, today.day, 17, 5, 2), 1),
    (2, '1002', 3, datetime.datetime(2026, 1, 5, 9, 0, 0), 0),
]


def make_commkey(key, session_id, ticks=50):
    """Same as pyzk base.make_commkey — written independently of the bridge's JS."""
    key = int(key); session_id = int(session_id)
    k = 0
    for i in range(32):
        k = (k << 1 | 1) if (key & (1 << i)) else (k << 1)
    k += session_id
    k = struct.pack(b'I', k & 0xffffffff)
    k = struct.unpack(b'BBBB', k)
    k = struct.pack(b'BBBB', k[0] ^ ord('Z'), k[1] ^ ord('K'), k[2] ^ ord('S'), k[3] ^ ord('O'))
    k = struct.unpack(b'HH', k)
    k = struct.pack(b'HH', k[1], k[0])
    B = 0xff & ticks
    k = struct.unpack(b'BBBB', k)
    return struct.pack(b'BBBB', k[0] ^ B, k[1] ^ B, B, k[3] ^ B)


def checksum(buf):
    chk = 0
    for i in range(0, len(buf), 2):
        chk += buf[i] if i == len(buf) - 1 else struct.unpack('<H', buf[i:i + 2])[0]
        chk %= USHRT_MAX
    return USHRT_MAX - chk - 1


def packet(cmd, reply_id, data=b''):
    head = struct.pack('<HHHH', cmd, 0, SESSION, reply_id) + data
    head = struct.pack('<HHHH', cmd, checksum(head), SESSION, reply_id) + data
    return struct.pack('<HHI', 0x5050, 0x7d82, len(head)) + head


def encode_time(t):
    return (((t.year % 100) * 12 * 31 + (t.month - 1) * 31 + t.day - 1) * 86400
            + (t.hour * 60 + t.minute) * 60 + t.second)


def att_blob():
    recs = b''
    for uid, user_id, verify, t, punch in attendance:
        recs += struct.pack('<H24sBIB8s', uid, user_id.encode(), verify, encode_time(t), punch, b'')
    return struct.pack('<I', len(recs)) + recs


def users_blob():
    recs = b''
    for u in users.values():
        recs += struct.pack('<HB8s24sIx7sx24s', u['uid'], u['priv'], u['password'].encode(),
                            u['name'].encode(), u['card'], b'1', u['user_id'].encode())
    return struct.pack('<I', len(recs)) + recs


def handle(conn, addr):
    authed = COMMKEY == 0
    conn.settimeout(IDLE_CLOSE or None)
    buf = b''
    try:
        while True:
            try:
                chunk = conn.recv(65536)
            except socket.timeout:
                print(f'[emu] idle {IDLE_CLOSE}s — closing connection', flush=True)
                break
            if not chunk:
                break
            buf += chunk
            while len(buf) >= 8:
                magic1, magic2, length = struct.unpack('<HHI', buf[:8])
                if (magic1, magic2) != (0x5050, 0x7d82):
                    print('[emu] packet WITHOUT TCP header -> ignored (real devices do the same)', flush=True)
                    buf = b''
                    break
                if len(buf) < 8 + length:
                    break
                body, buf = buf[8:8 + length], buf[8 + length:]
                cmd, chk, sess, reply_id = struct.unpack('<HHHH', body[:8])
                data = body[8:]
                reply = None
                if cmd == CMD_CONNECT:
                    reply = packet(CMD_ACK_UNAUTH if COMMKEY else CMD_ACK_OK, reply_id)
                elif cmd == CMD_AUTH:
                    ok = data[:4] == make_commkey(COMMKEY, SESSION)
                    authed = authed or ok
                    print(f'[emu] AUTH {"OK" if ok else "REJECTED"}', flush=True)
                    reply = packet(CMD_ACK_OK if ok else CMD_ACK_UNAUTH, reply_id)
                elif not authed:
                    reply = packet(CMD_ACK_UNAUTH, reply_id)
                elif cmd == CMD_EXIT:
                    conn.sendall(packet(CMD_ACK_OK, reply_id)); return
                elif cmd == CMD_DATA_WRRQ:
                    what = data[1] if len(data) > 1 else 0
                    blob = att_blob() if what == 0x0d else users_blob()
                    reply = packet(CMD_DATA, reply_id, blob)
                elif cmd == CMD_OPTIONS_RRQ:
                    key = data.split(b'\0')[0].decode()
                    val = {'~SerialNumber': 'EMU4370TCP01', '~DeviceName': 'K40 Emulator'}.get(key, '')
                    reply = packet(CMD_ACK_OK, reply_id, f'{key}={val}\0'.encode())
                elif cmd == CMD_VERSION:
                    reply = packet(CMD_ACK_OK, reply_id, b'Ver 6.60 Emu\0')
                elif cmd == CMD_USER_WRQ:
                    uid, priv, pw, name, card, grp, user_id = struct.unpack('<HB8s24sIx7sx24s', data[:72])
                    users[uid] = dict(uid=uid, priv=priv, password=pw.split(b'\0')[0].decode(),
                                      name=name.split(b'\0')[0].decode('utf8', 'replace'), card=card,
                                      user_id=user_id.split(b'\0')[0].decode())
                    print(f'[emu] USER_WRQ uid={uid} id={users[uid]["user_id"]} name={users[uid]["name"]!r} priv={priv}', flush=True)
                    reply = packet(CMD_ACK_OK, reply_id)
                elif cmd == CMD_DELETE_USER:
                    uid = struct.unpack('<H', data[:2])[0]
                    existed = users.pop(uid, None) is not None
                    print(f'[emu] DELETE_USER uid={uid} existed={existed}', flush=True)
                    reply = packet(CMD_ACK_OK if existed else CMD_ACK_ERROR, reply_id)
                else:  # FREE_DATA, REFRESHDATA, enable/disable, etc.
                    reply = packet(CMD_ACK_OK, reply_id)
                conn.sendall(reply)
    finally:
        conn.close()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('127.0.0.1', PORT)); srv.listen(5)
    print(f'[emu] listening on {PORT} commkey={COMMKEY or "none"} idle_close={IDLE_CLOSE or "never"}', flush=True)
    while True:
        conn, addr = srv.accept()
        threading.Thread(target=handle, args=(conn, addr), daemon=True).start()


if __name__ == '__main__':
    main()
