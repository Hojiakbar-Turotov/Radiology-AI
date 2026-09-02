/**
 * Tibbiyot / MRT - Multi-Server Avtomatik Failover Moduli (shared/failover.js)
 * Agar joriy server o'chib qolsa, tarmoqdagi boshqa zaxira serverga uzluksiz o'tkazadi.
 */

(function(window) {
  class ClusterFailoverManager {
    constructor() {
      this.knownNodes = this.loadNodes();
      this.currentNodeIndex = 0;
      this.currentHost = window.location.host;
      this.pollNodesList();
      setInterval(() => this.pollNodesList(), 10000);
    }

    loadNodes() {
      try {
        const raw = localStorage.getItem("cluster_known_nodes");
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    saveNodes(nodes) {
      this.knownNodes = nodes;
      try {
        localStorage.setItem("cluster_known_nodes", JSON.stringify(nodes));
      } catch (e) {}
    }

    async pollNodesList() {
      try {
        const res = await fetch("/api/cluster/nodes");
        const data = await res.json();
        if (data.success && Array.isArray(data.nodes)) {
          this.saveNodes(data.nodes);
        }
      } catch (e) {}
    }

    /**
     * Agar joriy server uzilsa, zaxira serverlar orqali so'rov yuborish
     */
    async fetchWithFailover(path, options = {}) {
      // 1. Dastlab joriy serverga urinish
      try {
        const res = await fetch(path, options);
        return res;
      } catch (err) {
        console.warn(`[Failover] Joriy server (${this.currentHost}) javob bermadi. Zaxira serverlar tekshirilmoqda...`);
      }

      // 2. Klasterdagi boshqa serverlar orqali urinish
      const candidateNodes = this.knownNodes.filter(n => `${n.ip}:${n.port}` !== this.currentHost);

      for (const node of candidateNodes) {
        const targetBase = `http://${node.ip}:${node.port}`;
        const targetUrl = targetBase + path;
        try {
          const res = await fetch(targetUrl, { ...options, timeout: 2500 });
          if (res) {
            console.log(`[Failover Success] Zaxira serverga muvaffaqiyatli ulandi: ${targetBase}`);
            this.currentHost = `${node.ip}:${node.port}`;
            window.dispatchEvent(new CustomEvent("cluster_switched", { detail: { newHost: this.currentHost } }));
            return res;
          }
        } catch (peerErr) {}
      }

      throw new Error("Tarmoqdagi barcha serverlar o'chirilgan yoki tarmoq uzilgan.");
    }

    /**
     * WebSocket ulanishini zaxira serverlar orqali qayta ochish
     */
    connectWebSocketWithFailover(role, onMessageCallback, onOpenCallback) {
      let activeWs = null;
      let nodeIdx = 0;

      const tryConnect = () => {
        const nodesList = this.knownNodes.length > 0 ? this.knownNodes : [{ ip: window.location.hostname, port: 3000 }];
        const node = nodesList[nodeIdx % nodesList.length];
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${node.ip || window.location.hostname}:${node.port || 3000}`;

        try {
          activeWs = new WebSocket(wsUrl);

          activeWs.onopen = () => {
            nodeIdx = 0; // muvaffaqiyatli
            activeWs.send(JSON.stringify({ action: "register", role: role }));
            if (onOpenCallback) onOpenCallback(activeWs, wsUrl);
          };

          activeWs.onmessage = (evt) => {
            if (onMessageCallback) onMessageCallback(evt);
          };

          activeWs.onclose = () => {
            nodeIdx++; // Keyingi zaxira serverga o'tish
            setTimeout(tryConnect, 2000);
          };

          activeWs.onerror = () => {
            activeWs.close();
          };
        } catch (e) {
          nodeIdx++;
          setTimeout(tryConnect, 2000);
        }
      };

      tryConnect();
      return {
        getWs: () => activeWs
      };
    }
  }

  window.ClusterFailover = new ClusterFailoverManager();
})(window);
