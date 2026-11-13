// A minimal mDNS responder: answers queries for "<name>.local" with this machine's IPv4 address,
// so a phone can open http://codriver.local whatever IP the PC got on the current network.
// A records only; no dependencies.
//
// Works on iPhone/iPad, macOS, Windows 10+ and Linux with Avahi. Android resolves .local names
// depending on version and vendor – which is why we always show the IP address and a QR code too.
import dgram from 'node:dgram';
import os from 'node:os';

const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const TYPE_A = 1;
const TYPE_ANY = 255;
const TTL = 120;

/** IPv4 addresses on the local network, with netmasks. */
export function lanInterfaces() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ address: a.address, netmask: a.netmask });
  }
  return out;
}

const toInt = (ip) => ip.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
const sameSubnet = (a, b, mask) => ((toInt(a) & toInt(mask)) >>> 0) === ((toInt(b) & toInt(mask)) >>> 0);

function readName(buf, off) {
  const labels = [];
  let jumped = false;
  let next = off;
  for (let guard = 0; guard < 64; guard++) {
    const len = buf[off];
    if (len === undefined) throw new Error('truncated packet');
    if (len === 0) { if (!jumped) next = off + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) next = off + 2;
      off = ((len & 0x3f) << 8) | buf[off + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.toString('utf8', off + 1, off + 1 + len));
    off += 1 + len;
  }
  return { name: labels.join('.').toLowerCase(), next };
}

function encodeName(name) {
  const parts = name.split('.').map((l) => { const b = Buffer.from(l); return Buffer.concat([Buffer.from([b.length]), b]); });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

/** Questions in an mDNS packet (queries only; answers from other hosts are ignored). */
export function parseQuestions(buf) {
  if (buf.length < 12 || (buf.readUInt16BE(2) & 0x8000)) return [];
  const qd = buf.readUInt16BE(4);
  const out = [];
  let off = 12;
  for (let i = 0; i < qd; i++) {
    const { name, next } = readName(buf, off);
    const type = buf.readUInt16BE(next);
    const cls = buf.readUInt16BE(next + 2);
    out.push({ name, type, unicast: (cls & 0x8000) !== 0 });
    off = next + 4;
  }
  return out;
}

/** An answer with an A record. `id` and the question are included only for legacy queries (not from port 5353). */
export function buildAnswer(name, ip, { id = 0, question = false } = {}) {
  const n = encodeName(name);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x8400, 2);              // response, authoritative
  header.writeUInt16BE(question ? 1 : 0, 4);
  header.writeUInt16BE(1, 6);
  const q = question ? Buffer.concat([n, Buffer.from([0, TYPE_A, 0, 1])]) : Buffer.alloc(0);
  const rr = Buffer.alloc(10);
  rr.writeUInt16BE(TYPE_A, 0);
  rr.writeUInt16BE(question ? 0x0001 : 0x8001, 2); // class IN, cache-flush bit for multicast
  rr.writeUInt32BE(TTL, 4);
  rr.writeUInt16BE(4, 8);
  return Buffer.concat([header, q, n, rr, Buffer.from(ip.split('.').map(Number))]);
}

/**
 * Starts the responder. Errors (e.g. port 5353 busy) don't stop the app – `ok` is false then.
 * @returns {Promise<{ ok: boolean, hostname: string, close(): void }>}
 */
export function startMdns(hostname = 'codriver.local') {
  const name = hostname.toLowerCase();
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  const pickIp = (from) => {
    const ifs = lanInterfaces();
    return (ifs.find((i) => from && sameSubnet(i.address, from, i.netmask)) ?? ifs[0])?.address;
  };

  sock.on('message', (msg, rinfo) => {
    let questions;
    try { questions = parseQuestions(msg); } catch { return; }
    const asked = questions.find((q) => q.name === name && (q.type === TYPE_A || q.type === TYPE_ANY));
    if (!asked) return;
    const ip = pickIp(rinfo.address);
    if (!ip) return;
    if (rinfo.port !== MDNS_PORT) {
      // legacy unicast query (a plain resolver): reply to the sender's address, with its ID
      sock.send(buildAnswer(name, ip, { id: msg.readUInt16BE(0), question: true }), rinfo.port, rinfo.address);
    } else {
      sock.send(buildAnswer(name, ip), MDNS_PORT, asked.unicast ? rinfo.address : MDNS_ADDR);
    }
  });

  return new Promise((resolve) => {
    const fail = () => resolve({ ok: false, hostname: name, close() { try { sock.close(); } catch { /* already closed */ } } });
    sock.once('error', fail);
    sock.bind(MDNS_PORT, () => {
      try {
        for (const i of lanInterfaces()) {
          try { sock.addMembership(MDNS_ADDR, i.address); } catch { /* interface without multicast */ }
        }
        sock.setMulticastTTL(255);
        // announce at startup (twice, as RFC 6762 recommends)
        const announce = () => { const ip = pickIp(); if (ip) sock.send(buildAnswer(name, ip), MDNS_PORT, MDNS_ADDR); };
        announce();
        setTimeout(announce, 1000).unref();
        sock.removeListener('error', fail);
        sock.on('error', () => { /* a lost packet doesn't stop the server */ });
        resolve({ ok: true, hostname: name, close() { sock.close(); } });
      } catch {
        fail();
      }
    });
  });
}
