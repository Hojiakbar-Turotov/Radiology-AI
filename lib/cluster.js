/**
 * Tibbiyot / MRT - Multi-Server High-Availability Klasteri (lib/cluster.js)
 * 5 tagacha serverni P2P mesh orqali birlashtiradi, ma'lumotlarni real-time
 * sinxronlaydi va 6-server ulanishiga yo'l qo'ymaydi.
 */

const dgram = require('dgram');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const UDP_PORT = 3001;
const HTTP_PORT = 3000;
const MAX_CLUSTER_NODES = 5;
const BEACON_INTERVAL_MS = 3000;
const PEER_TIMEOUT_MS = 9000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const NODE_ID_FILE = path.join(DATA_DIR, 'node_id.txt');

class ClusterManager {
  constructor() {
    this.nodeId = this.getOrCreateNodeId();
    this.computerName = os.hostname();
    this.localIp = this.detectLocalIP();
    this.peers = new Map(); // nodeId -> peerInfo
    this.seenTransactions = new Set(); // txId
    this.udpSocket = null;
    this.beaconTimer = null;
    this.cleanupTimer = null;
    this.db = null;
    this.wsHub = null;
    this.isEnforcingLimit = true;
    this.isTerminating = false;
  }

  getOrCreateNodeId() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(NODE_ID_FILE)) {
      try {
        const id = fs.readFileSync(NODE_ID_FILE, 'utf-8').trim();
        if (id) return id;
      } catch (e) {}
    }
    const newId = `node_${os.hostname().replace(/[^a-zA-Z0-9]/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(NODE_ID_FILE, newId, 'utf-8');
    } catch (e) {}
    return newId;
  }

  detectLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal) {
          return config.address;
        }
      }
    }
    return '127.0.0.1';
  }

  init(db, wsHub) {
    this.db = db;
    this.wsHub = wsHub;
    this.initUDPSocket();
  }

  initUDPSocket() {
    this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.udpSocket.on('error', (err) => {
      console.warn('[Cluster UDP Warn]:', err.message);
    });

    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        this.handlePeerBeacon(data, rinfo.address);
      } catch (e) {}
    });

    this.udpSocket.bind(UDP_PORT, () => {
      try {
        this.udpSocket.setBroadcast(true);
      } catch (e) {}

      // Heartbeat beacon yuborishni boshlash
      this.beaconTimer = setInterval(() => this.broadcastBeacon(), BEACON_INTERVAL_MS);
      this.broadcastBeacon();

      // Eski peerlarni tozalash
      this.cleanupTimer = setInterval(() => this.cleanupStalePeers(), 4000);

      // Boshlang'ich sinxronizatsiya
      setTimeout(() => this.syncStateFromPeers(), 1500);
    });
  }

  broadcastBeacon() {
    if (!this.udpSocket || this.isTerminating) return;

    const beacon = JSON.stringify({
      type: 'BEACON',
      nodeId: this.nodeId,
      computerName: this.computerName,
      ip: this.localIp,
      port: HTTP_PORT,
      queueCount: this.db ? this.db.getQueue().length : 0,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now()
    });

    const buf = Buffer.from(beacon);

    // 1. Broadcast address
    this.udpSocket.send(buf, 0, buf.length, UDP_PORT, '255.255.255.255', (err) => {
      // Ba'zi Windows tarmoqlarida sub-broadcast talab qilinishi mumkin
    });

    // 2. Subnet broadcast
    if (this.localIp && this.localIp !== '127.0.0.1') {
      const parts = this.localIp.split('.');
      if (parts.length === 4) {
        const subnetBroadcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`;
        this.udpSocket.send(buf, 0, buf.length, UDP_PORT, subnetBroadcast, () => {});
      }
    }
  }

  handlePeerBeacon(data, senderIp) {
    if (!data || data.type !== 'BEACON' || !data.nodeId) return;
    if (data.nodeId === this.nodeId) return; // O'zimizning xabarimiz

    const now = Date.now();
    const peerIp = data.ip || senderIp;

    const peerInfo = {
      nodeId: data.nodeId,
      computerName: data.computerName || 'Server',
      ip: peerIp,
      port: data.port || HTTP_PORT,
      queueCount: data.queueCount || 0,
      uptimeSeconds: data.uptimeSeconds || 0,
      lastSeen: now,
      status: 'active'
    };

    const isNew = !this.peers.has(data.nodeId);
    this.peers.set(data.nodeId, peerInfo);

    // 5 TA SERVER CHEKLOVI (STRICT CAP)
    const activePeersCount = this.getActivePeers().length;
    const totalClusterNodes = activePeersCount + 1; // + self

    if (totalClusterNodes > MAX_CLUSTER_NODES && !this.isTerminating) {
      console.error('\n================================================================');
      console.error('  ❌ [KLASTER XATOSI]: MAKSIMAL LIMIT (5 TA SERVER) TO\'LGAN!');
      console.error(`  Lokal tarmoqda allaqachon ${activePeersCount} ta faol server mavjud.`);
      console.error('  6-server sifatida ulanish qat\'iyan taqiqlandi!');
      console.error('================================================================\n');

      if (this.db) {
        this.db.addLog({
          ip: this.localIp,
          method: 'CLUSTER_ERROR',
          path: 'LIMIT_EXCEEDED',
          status: 403,
          details: `Klaster limiti (5 ta server) oshib ketdi. Tugun to'xtatiladi.`
        });
      }

      this.isTerminating = true;
      setTimeout(() => {
        process.exit(1);
      }, 1500);
      return;
    }

    if (isNew && this.db) {
      this.db.addLog({
        ip: peerIp,
        method: 'CLUSTER_PEER',
        path: '/cluster',
        status: 200,
        details: `Yangi klaster tuguni ulandi: ${peerInfo.computerName} (${peerIp})`
      });
      this.notifyDashboard();
    }
  }

  cleanupStalePeers() {
    const now = Date.now();
    let hasChanges = false;

    for (const [nodeId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(nodeId);
        hasChanges = true;
        if (this.db) {
          this.db.addLog({
            ip: peer.ip,
            method: 'CLUSTER_OFFLINE',
            path: '/cluster',
            status: 0,
            details: `Klaster tuguni uzildi (Offline): ${peer.computerName} (${peer.ip})`
          });
        }
      }
    }

    if (hasChanges) {
      this.notifyDashboard();
    }
  }

  getActivePeers() {
    const now = Date.now();
    const list = [];
    for (const peer of this.peers.values()) {
      if (now - peer.lastSeen <= PEER_TIMEOUT_MS) {
        list.push(peer);
      }
    }
    return list;
  }

  getAllClusterNodes() {
    const activePeers = this.getActivePeers();
    const selfNode = {
      nodeId: this.nodeId,
      computerName: `${this.computerName} (Ushbu kompyuter)`,
      ip: this.localIp,
      port: HTTP_PORT,
      isSelf: true,
      status: 'active',
      queueCount: this.db ? this.db.getQueue().length : 0,
      uptimeSeconds: Math.floor(process.uptime())
    };

    return [selfNode, ...activePeers];
  }

  // --- REPLIKATSIYA METODLARI ---

  /**
   * Ushbu serverda o'zgarish bo'lganda boshqa barcha serverlarga yetkazish
   */
  replicate(action, payload, existingTxId = null) {
    const txId = existingTxId || `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.seenTransactions.add(txId);

    // Xotira to'lib ketmasligi uchun oxirgi 2000 ta txId ni saqlash
    if (this.seenTransactions.size > 2000) {
      const iter = this.seenTransactions.values();
      this.seenTransactions.delete(iter.next().value);
    }

    const peers = this.getActivePeers();
    if (peers.length === 0) return;

    const data = JSON.stringify({
      txId: txId,
      fromNodeId: this.nodeId,
      action: action,
      payload: payload,
      timestamp: Date.now()
    });

    peers.forEach(peer => {
      const req = http.request({
        hostname: peer.ip,
        port: peer.port,
        path: '/api/cluster/replicate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 2000
      }, (res) => {});

      req.on('error', () => {});
      req.write(data);
      req.end();
    });
  }

  /**
   * Boshqa serverdan replikatsiya kelganda qabul qilish
   */
  handleIncomingReplication(txId, action, payload) {
    if (!txId || this.seenTransactions.has(txId)) {
      return { applied: false, reason: 'Already applied' };
    }

    this.seenTransactions.add(txId);

    // Amallarni bajarish
    if (action === 'patient_added') {
      const patient = payload.patient;
      // Agar bemor bazada bo'lmasa qo'shish
      const existing = this.db.getPatientById(patient.id);
      if (!existing) {
        this.db.queue.push(patient);
        this.db.saveQueue();
      }
    } else if (action === 'status_updated') {
      this.db.updatePatientStatus(payload.id, payload.status, payload.extraData || {});
    } else if (action === 'patient_called') {
      const p = this.db.updatePatientStatus(payload.id, 'calling');
      if (this.wsHub && p) {
        const dev = this.db.getDeviceById(p.deviceId);
        this.wsHub.broadcast('voice_announcement', {
          type: 'call_room',
          patient: p,
          room: dev ? dev.room : 'MRT Xonasi',
          ticketNumber: p.ticketNumber,
          patientName: p.patientName
        });
      }
    } else if (action === 'patient_prep') {
      const p = this.db.updatePatientStatus(payload.id, 'preparing');
      if (this.wsHub && p) {
        const dev = this.db.getDeviceById(p.deviceId);
        this.wsHub.broadcast('voice_announcement', {
          type: 'call_prep',
          patient: p,
          room: dev ? dev.room : 'MRT Xonasi',
          ticketNumber: p.ticketNumber,
          patientName: p.patientName,
          isContrast: p.isContrast
        });
      }
    } else if (action === 'queue_reset') {
      this.db.createManualBackup();
      this.db.queue = [];
      this.db.saveQueue();
    }

    // Mahalliy WebSocket orqali bu kompyuterga ulangan TV va panellarga xabar berish
    if (this.wsHub) {
      this.wsHub.broadcast('queue_updated', {
        action: action,
        payload: payload,
        queue: this.db.getQueue(),
        devices: this.db.getDevices()
      });
    }

    return { applied: true };
  }

  /**
   * Yangi qo'shilgan yoki qayta yoqilgan server eng to'liq ma'lumotni qo'shnidan tortib olishi
   */
  syncStateFromPeers() {
    const peers = this.getActivePeers();
    if (peers.length === 0) return;

    // Eng ko'p bemorga ega bo'lgan peer ni tanlash
    peers.sort((a, b) => b.queueCount - a.queueCount);
    const bestPeer = peers[0];

    http.get({
      hostname: bestPeer.ip,
      port: bestPeer.port,
      path: '/api/cluster/sync-state',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success && Array.isArray(data.queue)) {
            // Agar o'zidagi navbatdan ko'proq bo'lsa yoki yangiroq bo'lsa yangilash
            if (data.queue.length >= this.db.queue.length) {
              this.db.queue = data.queue;
              this.db.saveQueue();
              if (data.devices) {
                this.db.devices = data.devices;
                this.db.saveDevices();
              }
              console.log(`[Cluster Sync] Navbat ${bestPeer.computerName} (${bestPeer.ip}) dan muvaffaqiyatli sinxronlandi (${data.queue.length} ta bemor).`);
              if (this.wsHub) {
                this.wsHub.broadcast('queue_updated', {
                  action: 'cluster_sync',
                  queue: this.db.getQueue(),
                  devices: this.db.getDevices()
                });
              }
            }
          }
        } catch (e) {}
      });
    }).on('error', () => {});
  }

  notifyDashboard() {
    if (this.wsHub) {
      this.wsHub.broadcast('cluster_nodes_update', {
        nodes: this.getAllClusterNodes(),
        maxNodes: MAX_CLUSTER_NODES
      }, 'dashboard');
    }
  }

  destroy() {
    this.isTerminating = true;
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.udpSocket) {
      try { this.udpSocket.close(); } catch (e) {}
    }
  }
}

const clusterInstance = new ClusterManager();
module.exports = clusterInstance;
