/**
 * Tibbiyot / MRT Navbat Tizimi - WebSocket Realtime Hub (lib/ws.js)
 * TV Tablo, Vrach/Laborant panellari va Server Dashboard o'rtasida 0.01s kechikishsiz aloqa.
 */

const { WebSocketServer, WebSocket } = require('ws');

class WebSocketHub {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> clientInfo
    this.db = null;
  }

  init(httpServer, db) {
    this.db = db;
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const cleanIp = clientIp.replace(/^.*:/, ''); // IPv6 to IPv4 cleanup

      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const clientInfo = {
        id: clientId,
        ip: cleanIp,
        userAgent: req.headers['user-agent'] || 'Unknown',
        role: 'guest', // 'tv', 'doctor', 'operator', 'dashboard'
        room: 'all',   // 'mrt1', 'mrt2', 'mskt1', 'all'
        connectedAt: new Date().toISOString(),
        timeFormatted: new Date().toLocaleTimeString('ru-RU'),
        latencyMs: 0,
        isAlive: true
      };

      this.clients.set(ws, clientInfo);

      // Audit log
      if (this.db) {
        this.db.addLog({
          ip: cleanIp,
          method: 'WS_CONNECT',
          path: '/ws',
          status: 101,
          action: 'CLIENT_CONNECTED',
          details: `Yangi mijoz ulandi: ${clientInfo.userAgent.substring(0, 40)}`
        });
      }

      // Xush kelibsiz xabari va joriy navbatni yuborish
      this.send(ws, 'connected', {
        clientId: clientId,
        ip: cleanIp,
        message: "Lokal MRT Realtime serveriga ulandingiz",
        timestamp: new Date().toISOString()
      });

      // Boshlang'ich navbatni yuborish
      if (this.db) {
        this.send(ws, 'queue_init', {
          queue: this.db.getQueue(),
          devices: this.db.getDevices(),
          settings: this.db.getSettings()
        });
      }

      // Mijozdan xabar kelganda
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (e) {
          console.error('[WS Message Parse Error]:', e.message);
        }
      });

      ws.on('pong', () => {
        const info = this.clients.get(ws);
        if (info) info.isAlive = true;
      });

      ws.on('close', () => {
        const info = this.clients.get(ws);
        if (info && this.db) {
          this.db.addLog({
            ip: info.ip,
            method: 'WS_DISCONNECT',
            path: '/ws',
            status: 0,
            action: 'CLIENT_DISCONNECTED',
            details: `Mijoz uzildi: ${info.role} (${info.ip})`
          });
        }
        this.clients.delete(ws);
        this.notifyDashboardClients();
      });

      ws.on('error', (err) => {
        console.error('[WS Socket Error]:', err.message);
      });

      this.notifyDashboardClients();
    });

    // Har 25 soniyada tiriklikni tekshirish (Heartbeat Ping)
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const info = this.clients.get(ws);
        if (!info) return;

        if (info.isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }

        info.isAlive = false;
        ws.ping();
      });
    }, 25000);
  }

  handleClientMessage(ws, data) {
    const info = this.clients.get(ws);
    if (!info) return;

    if (data.action === 'register') {
      info.role = data.role || info.role;
      info.room = data.room || info.room;
      if (data.deviceName) info.deviceName = data.deviceName;
      this.notifyDashboardClients();
    } else if (data.action === 'ping') {
      const now = Date.now();
      const sendTime = data.timestamp || now;
      info.latencyMs = Math.max(0, now - sendTime);
      this.send(ws, 'pong', { timestamp: now, latencyMs: info.latencyMs });
    }
  }

  send(ws, type, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }

  /**
   * Barcha ulangan mijozlarga yoki ma'lum roldagilarga voqeani tarqatish
   */
  broadcast(type, payload, targetRole = null) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });

    this.clients.forEach((info, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (!targetRole || info.role === targetRole || targetRole === 'all') {
          ws.send(message);
        }
      }
    });
  }

  /**
   * Server Dashboard-ga ulangan mijozlar ro'yxatini yangilash
   */
  notifyDashboardClients() {
    const clientsList = this.getClientsList();
    this.broadcast('dashboard_clients_update', { clients: clientsList }, 'dashboard');
  }

  getClientsList() {
    const list = [];
    this.clients.forEach((info) => {
      list.push({
        id: info.id,
        ip: info.ip,
        role: info.role,
        room: info.room,
        deviceName: info.deviceName || info.role,
        userAgent: info.userAgent,
        connectedAt: info.timeFormatted,
        latencyMs: info.latencyMs
      });
    });
    return list;
  }

  disconnectClient(clientId) {
    for (const [ws, info] of this.clients.entries()) {
      if (info.id === clientId) {
        ws.close(1000, "Server tomonidan uzildi");
        this.clients.delete(ws);
        this.notifyDashboardClients();
        return true;
      }
    }
    return false;
  }
}

const wsHubInstance = new WebSocketHub();
module.exports = wsHubInstance;
