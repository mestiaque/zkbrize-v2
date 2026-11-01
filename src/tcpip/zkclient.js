// ZKTeco binary protocol (port 4370) over TCP. Follows pyzk, the Python library
// that the standalone sync app uses with the same devices: CMD_AUTH only when the
// device answers "unauthorized", data read in chunks, and attendance / user
// records decoded by the record size the device reports (8/16/40 and 28/72 bytes).
const net = require('net');

const CMD = {
  CONNECT: 1000,
  EXIT: 1001,
  ENABLEDEVICE: 1002,
  DISABLEDEVICE: 1003,
  USER_WRQ: 8,
  USERTEMP_RRQ: 9,
  OPTIONS_RRQ: 11,
  ATTLOG_RRQ: 13,
  DELETE_USER: 18,
  GET_FREE_SIZES: 50,
  REG_EVENT: 500,
  REFRESHDATA: 1013,
  GET_VERSION: 1100,
  AUTH: 1102,
  PREPARE_DATA: 1500,
  DATA: 1501,
  FREE_DATA: 1502,
  PREPARE_BUFFER: 1503,
  READ_BUFFER: 1504,
  ACK_OK: 2000,
  ACK_ERROR: 2001,
  ACK_UNAUTH: 2005,
};

const USHRT_MAX = 65535;
const MAX_CHUNK = 0xffc0;
const FCT_USER = 5;
const MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);
const MAX_PACKET = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT = 10000;

// ── Packet helpers ─────────────────────────────────────────────────

function checksum(buf) {
  let sum = 0;
  let i = 0;
  for (; i + 1 < buf.length; i += 2) {
    sum += buf.readUInt16LE(i);
    if (sum > USHRT_MAX) sum -= USHRT_MAX;
  }
  if (i < buf.length) sum += buf[buf.length - 1];
  while (sum > USHRT_MAX) sum -= USHRT_MAX;
  sum = ~sum;
  while (sum < 0) sum += USHRT_MAX;
  return sum;
}

// TCP wrapper (magic + length) around command, checksum, session and reply ids
function buildPacket(command, data, sessionId, replyId) {
  const body = Buffer.alloc(8 + data.length);
  body.writeUInt16LE(command, 0);
  body.writeUInt16LE(sessionId, 4);
  body.writeUInt16LE(replyId, 6);
  data.copy(body, 8);
  body.writeUInt16LE(checksum(body), 2);
  body.writeUInt16LE((replyId + 1) % USHRT_MAX, 6);
  const top = Buffer.alloc(8);
  MAGIC.copy(top, 0);
  top.writeUInt32LE(body.length, 4);
  return Buffer.concat([top, body]);
}

// Comm key ("communication password") scrambled with the session id, as the
// device expects for CMD_AUTH (pyzk's make_commkey)
function makeCommKey(key, sessionId, ticks = 50) {
  key = parseInt(key, 10) >>> 0;
  let k = 0;
  for (let i = 0; i < 32; i++) k = ((key & (1 << i)) ? ((k << 1) | 1) : (k << 1)) >>> 0;
  k = (k + (sessionId >>> 0)) >>> 0;
  const b = Buffer.alloc(4);
  b.writeUInt32LE(k, 0);
  const x = Buffer.from([b[0] ^ 0x5a, b[1] ^ 0x4b, b[2] ^ 0x53, b[3] ^ 0x4f]); // 'Z' 'K' 'S' 'O'
  const swapped = Buffer.alloc(4);
  swapped.writeUInt16LE(x.readUInt16LE(2), 0);
  swapped.writeUInt16LE(x.readUInt16LE(0), 2);
  const t = ticks & 0xff;
  return Buffer.from([swapped[0] ^ t, swapped[1] ^ t, t, swapped[3] ^ t]);
}

// Text up to the first NUL byte
function cstr(buf, encoding = 'utf8') {
  const end = buf.indexOf(0);
  return buf.subarray(0, end < 0 ? buf.length : end).toString(encoding).trim();
}

// Device time (seconds packed as in pyzk's __decode_time) -> "YYYY-MM-DD HH:MM:SS"
const pad = n => String(n).padStart(2, '0');
function decodeTime(t) {
  const second = t % 60; t = Math.floor(t / 60);
  const minute = t % 60; t = Math.floor(t / 60);
  const hour = t % 24; t = Math.floor(t / 24);
  const day = t % 31 + 1; t = Math.floor(t / 31);
  const month = t % 12 + 1; t = Math.floor(t / 12);
  const year = t + 2000;
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

// 72-byte user record: uid(2) privilege(1) password(8) name(24) card(4) pad(1)
// group(7) pad(1) user_id(24)
function userRecord(emp) {
  const uid = parseInt(emp.uid, 10);
  if (!(uid >= 1 && uid <= 65535)) throw new Error(`UID must be 1-65535 (got ${emp.uid})`);
  const buf = Buffer.alloc(72);
  buf.writeUInt16LE(uid, 0);
  buf.writeUInt8(parseInt(emp.privilege, 10) || 0, 2);
  buf.write(String(emp.password || '').slice(0, 8), 3, 8, 'ascii');
  buf.write(String(emp.name || '').slice(0, 24), 11, 24, 'utf8');
  buf.writeUInt32LE((parseInt(emp.card_no, 10) || 0) >>> 0, 35);
  buf.write('1', 40, 7, 'ascii');
  buf.write(String(emp.employee_id || emp.employeeId || uid).slice(0, 24), 48, 24, 'ascii');
  return buf;
}

// 28-byte user record (older firmware): uid(2) privilege(1) password(5) name(8)
// card(4) pad(1) group(1) timezone(2) user_id(4, numeric)
function userRecord28(emp) {
  const uid = parseInt(emp.uid, 10);
  if (!(uid >= 1 && uid <= 65535)) throw new Error(`UID must be 1-65535 (got ${emp.uid})`);
  const userId = parseInt(emp.employee_id || emp.employeeId || uid, 10);
  if (!(userId >= 0)) throw new Error(`This device only stores numeric employee IDs (got ${emp.employee_id})`);
  const buf = Buffer.alloc(28);
  buf.writeUInt16LE(uid, 0);
  buf.writeUInt8(parseInt(emp.privilege, 10) || 0, 2);
  buf.write(String(emp.password || '').slice(0, 5), 3, 5, 'ascii');
  buf.write(String(emp.name || '').slice(0, 8), 8, 8, 'utf8');
  buf.writeUInt32LE((parseInt(emp.card_no, 10) || 0) >>> 0, 16);
  buf.writeUInt8(1, 21);
  buf.writeUInt32LE(userId >>> 0, 24);
  return buf;
}

// ── Client ─────────────────────────────────────────────────────────

class ZKClient {
  constructor({ ip, port = 4370, password = 0, timeout = DEFAULT_TIMEOUT }) {
    this.ip = ip;
    this.port = port;
    this.password = password;
    this.timeout = timeout;
    this.socket = null;
    this.sessionId = 0;
    this.replyId = 0;
    this.buffer = Buffer.alloc(0);
    this.packets = [];
    this.waiter = null;
    this.closeError = null;
    this.userPacketSize = 72;
  }

  open() {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: this.ip, port: this.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection to ${this.ip}:${this.port} timed out`));
      }, this.timeout);
      socket.setNoDelay(true);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.on('data', chunk => this.onData(chunk));
      socket.on('error', err => {
        clearTimeout(timer);
        this.closeError = err;
        reject(err);
      });
      socket.on('close', () => {
        this.socket = null;
        this.failWaiter(this.closeError || new Error('Device closed the connection'));
      });
      this.socket = socket;
      this.buffer = Buffer.alloc(0);
      this.packets = [];
      this.closeError = null;
    });
  }

  // Splits the byte stream into whole packets; TCP may deliver them split or joined
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const start = this.buffer.indexOf(MAGIC);
      if (start < 0) {
        this.buffer = this.buffer.subarray(Math.max(0, this.buffer.length - 3));
        break;
      }
      if (start > 0) this.buffer = this.buffer.subarray(start);
      if (this.buffer.length < 8) break;
      const length = this.buffer.readUInt32LE(4);
      if (length < 8 || length > MAX_PACKET) {
        this.buffer = this.buffer.subarray(4);
        continue;
      }
      if (this.buffer.length < 8 + length) break;
      const body = this.buffer.subarray(8, 8 + length);
      this.buffer = this.buffer.subarray(8 + length);
      const code = body.readUInt16LE(0);
      if (code === CMD.REG_EVENT) continue; // live punch event, not a reply
      this.packets.push({
        code,
        sessionId: body.readUInt16LE(4),
        replyId: body.readUInt16LE(6),
        data: Buffer.from(body.subarray(8)),
      });
    }
    if (this.waiter && this.packets.length) {
      const { resolve } = this.waiter;
      this.waiter = null;
      resolve(this.packets.shift());
    }
  }

  failWaiter(err) {
    if (!this.waiter) return;
    const { reject } = this.waiter;
    this.waiter = null;
    reject(err);
  }

  nextPacket() {
    if (this.packets.length) return Promise.resolve(this.packets.shift());
    if (!this.socket) return Promise.reject(this.closeError || new Error('Not connected to the device'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error(`Device did not answer within ${Math.round(this.timeout / 1000)}s`));
      }, this.timeout);
      this.waiter = {
        resolve: p => { clearTimeout(timer); resolve(p); },
        reject: e => { clearTimeout(timer); reject(e); },
      };
    });
  }

  async command(command, data = Buffer.alloc(0)) {
    if (!this.socket) throw this.closeError || new Error('Not connected to the device');
    if (typeof data === 'string') data = Buffer.from(data, 'ascii');
    this.packets = []; // drop late replies to an earlier request
    this.socket.write(buildPacket(command, data, this.sessionId, this.replyId));
    const reply = await this.nextPacket();
    this.replyId = reply.replyId;
    return {
      ...reply,
      ok: reply.code === CMD.ACK_OK || reply.code === CMD.PREPARE_DATA || reply.code === CMD.DATA,
    };
  }

  async connect() {
    await this.open();
    this.sessionId = 0;
    this.replyId = USHRT_MAX - 1;
    let reply = await this.command(CMD.CONNECT);
    this.sessionId = reply.sessionId;
    if (reply.code === CMD.ACK_UNAUTH) {
      reply = await this.command(CMD.AUTH, makeCommKey(this.password || 0, this.sessionId));
    }
    if (!reply.ok) {
      this.close();
      throw new Error(reply.code === CMD.ACK_UNAUTH
        ? 'Device rejected the comm key (password)'
        : `Device refused the connection (reply ${reply.code})`);
    }
  }

  async disconnect() {
    if (!this.socket) return;
    try { await this.command(CMD.EXIT); } catch {}
    this.close();
  }

  close() {
    if (this.socket) this.socket.destroy();
    this.socket = null;
  }

  async expectOk(command, data, what) {
    const reply = await this.command(command, data);
    if (!reply.ok) throw new Error(`Device refused to ${what} (reply ${reply.code})`);
    return reply;
  }

  disableDevice() { return this.expectOk(CMD.DISABLEDEVICE, undefined, 'disable itself'); }
  enableDevice() { return this.expectOk(CMD.ENABLEDEVICE, undefined, 'enable itself'); }
  refreshData() { return this.expectOk(CMD.REFRESHDATA, undefined, 'refresh its data'); }
  freeData() { return this.expectOk(CMD.FREE_DATA, undefined, 'free its buffer'); }

  async getOption(name) {
    const reply = await this.expectOk(CMD.OPTIONS_RRQ, `${name}\0`, `read ${name}`);
    const text = cstr(reply.data);
    const eq = text.indexOf('=');
    return eq < 0 ? text : text.slice(eq + 1).trim();
  }

  getSerialNumber() { return this.getOption('~SerialNumber'); }
  getDeviceName() { return this.getOption('~DeviceName'); }

  async getFirmware() {
    const reply = await this.expectOk(CMD.GET_VERSION, undefined, 'report its firmware');
    return cstr(reply.data);
  }

  // Number of users and attendance records; null when the device does not say
  async readSizes() {
    const reply = await this.command(CMD.GET_FREE_SIZES);
    if (!reply.ok || reply.data.length < 80) return { users: null, records: null };
    return { users: reply.data.readInt32LE(16), records: reply.data.readInt32LE(32) };
  }

  async readWithBuffer(command, fct = 0, ext = 0) {
    const req = Buffer.alloc(11);
    req.writeInt8(1, 0);
    req.writeInt16LE(command, 1);
    req.writeInt32LE(fct, 3);
    req.writeInt32LE(ext, 7);
    const reply = await this.command(CMD.PREPARE_BUFFER, req);
    if (!reply.ok) throw new Error(`Device refused the data request (reply ${reply.code})`);
    if (reply.code === CMD.DATA) return reply.data; // small data comes back at once

    const size = reply.data.readUInt32LE(1);
    const parts = [];
    for (let start = 0; start < size; start += MAX_CHUNK) {
      parts.push(await this.readChunk(start, Math.min(MAX_CHUNK, size - start)));
    }
    await this.freeData();
    return Buffer.concat(parts);
  }

  async readChunk(start, size) {
    const req = Buffer.alloc(8);
    req.writeInt32LE(start, 0);
    req.writeInt32LE(size, 4);
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reply = await this.command(CMD.READ_BUFFER, req);
        if (reply.code === CMD.DATA) return reply.data;
        if (reply.code === CMD.PREPARE_DATA) {
          // CMD_PREPARE_DATA (size), one or more CMD_DATA, then CMD_ACK_OK
          const total = reply.data.readUInt32LE(0);
          const parts = [];
          let received = 0;
          let packet;
          while ((packet = await this.nextPacket()).code === CMD.DATA) {
            parts.push(packet.data);
            received += packet.data.length;
          }
          if (packet.code === CMD.ACK_OK && received >= total) return Buffer.concat(parts).subarray(0, total);
          lastError = new Error(`Incomplete data from device (${received}/${total} bytes)`);
        } else {
          lastError = new Error(`Device refused to send data (reply ${reply.code})`);
        }
      } catch (err) {
        if (!this.socket) throw err;
        lastError = err;
      }
    }
    throw lastError;
  }

  async getUsers() {
    const { users: count } = await this.readSizes();
    if (count === 0) return [];
    const raw = await this.readWithBuffer(CMD.USERTEMP_RRQ, FCT_USER);
    if (raw.length <= 4) return [];
    const total = raw.readUInt32LE(0);
    let data = raw.subarray(4);
    if (count) this.userPacketSize = total / count === 28 ? 28 : 72;

    const users = [];
    if (this.userPacketSize === 28) {
      for (; data.length >= 28; data = data.subarray(28)) {
        users.push({
          uid: data.readUInt16LE(0),
          privilege: data[2],
          password: cstr(data.subarray(3, 8), 'latin1'),
          name: cstr(data.subarray(8, 16)),
          card: data.readUInt32LE(16),
          groupId: String(data[21]),
          userId: String(data.readUInt32LE(24)),
        });
      }
    } else {
      for (; data.length >= 72; data = data.subarray(72)) {
        users.push({
          uid: data.readUInt16LE(0),
          privilege: data[2],
          password: cstr(data.subarray(3, 11), 'latin1'),
          name: cstr(data.subarray(11, 35)),
          card: data.readUInt32LE(35),
          groupId: cstr(data.subarray(40, 47)),
          userId: cstr(data.subarray(48, 72)),
        });
      }
    }
    return users;
  }

  // Attendance as { uid, userId, time, status (verify method), punch (in/out state) }
  async getAttendance() {
    const { records: count } = await this.readSizes();
    if (count === 0) return [];
    const raw = await this.readWithBuffer(CMD.ATTLOG_RRQ);
    if (raw.length < 4) return [];
    const total = raw.readUInt32LE(0);
    let data = raw.subarray(4);
    const recordSize = count ? total / count : 40;

    const records = [];
    if (recordSize === 8 || recordSize === 16) {
      // Short records carry the internal uid or a numeric id; map it through the user list
      const users = await this.getUsers();
      const byUid = new Map(users.map(u => [u.uid, u]));
      const byUserId = new Map(users.map(u => [u.userId, u]));
      if (recordSize === 8) {
        for (; data.length >= 8; data = data.subarray(8)) {
          const uid = data.readUInt16LE(0);
          records.push({
            uid,
            userId: byUid.get(uid)?.userId || String(uid),
            status: data[2],
            time: decodeTime(data.readUInt32LE(3)),
            punch: data[7],
          });
        }
      } else {
        for (; data.length >= 16; data = data.subarray(16)) {
          const userId = String(data.readUInt32LE(0));
          const user = byUserId.get(userId) || byUid.get(Number(userId));
          records.push({
            uid: user ? user.uid : Number(userId),
            userId: user ? user.userId : userId,
            time: decodeTime(data.readUInt32LE(4)),
            status: data[8],
            punch: data[9],
          });
        }
      }
    } else {
      const step = Number.isInteger(recordSize) && recordSize >= 40 ? recordSize : 40;
      for (; data.length >= 40; data = data.subarray(step)) {
        records.push({
          uid: data.readUInt16LE(0),
          userId: cstr(data.subarray(2, 26)),
          status: data[26],
          time: decodeTime(data.readUInt32LE(27)),
          punch: data[31],
        });
      }
    }
    return records;
  }

  async setUser(emp) {
    const record = this.userPacketSize === 28 ? userRecord28(emp) : userRecord(emp);
    const reply = await this.command(CMD.USER_WRQ, record);
    if (!reply.ok) throw new Error(`Device refused user ${emp.uid}`);
  }

  async deleteUser(uid) {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(parseInt(uid, 10), 0);
    const reply = await this.command(CMD.DELETE_USER, buf);
    if (!reply.ok) throw new Error(`Device refused to delete user ${uid}`);
  }
}

module.exports = { ZKClient, CMD, makeCommKey, userRecord, userRecord28, decodeTime };
