const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let reqUrl = decodeURI(req.url.split('?')[0]);
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/app1-registratura/index.html';
  }

  let filePath = path.join(ROOT_DIR, reqUrl);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - Sahifa topilmadi</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server xatosi: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('====================================================');
  console.log('  UTT TIBBIY NAVBAT TIZIMI - LOKAL SERVER ISHLAMOQDA');
  console.log('====================================================');
  console.log('\n[1] Ushbu kompyuterda:');
  console.log('   - Asosiy Portal: http://localhost:' + PORT + '/index.html');
  console.log('   - Registratura:  http://localhost:' + PORT + '/app1-registratura/');
  console.log('   - Vrach Xonasi:  http://localhost:' + PORT + '/app2-vrach/');
  console.log('   - TV Tablo:      http://localhost:' + PORT + '/app3-android-tv/');
  console.log('   - Admin Paneli:  http://localhost:' + PORT + '/app4-admin/');
  console.log('   - Hisobchi:      http://localhost:' + PORT + '/app6-hisobchi/');
  console.log('\n[2] Klinika tarmogidagi boshqa kompyuter va televizorlar uchun:');
  console.log('   - Registratura:  http://' + ip + ':' + PORT + '/app1-registratura/');
  console.log('   - Vrach Xonasi:  http://' + ip + ':' + PORT + '/app2-vrach/');
  console.log('   - TV Tablo:      http://' + ip + ':' + PORT + '/app3-android-tv/');
  console.log('   - Hisobchi:      http://' + ip + ':' + PORT + '/app6-hisobchi/');
  console.log('\n====================================================');
});
