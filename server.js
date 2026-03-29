const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');
const jwt = require('jsonwebtoken'); 

const app = express();
app.use(cors());
app.use(express.json());

// ========================= 配置变量 =========================

const JWT_SECRET = 'Welcome-to-Xiaolan-CDN-Web'; // JWT 签名密钥（建议随便打一串复杂的乱码）
const ADMIN_USER = 'Admin'; // 用户名
const ADMIN_PASSWORD = 'Admin@Pssword'; // 密码
const CONFIG_DIR = '/opt/xiaolan-cdn-system/node-config'; // node-config文件夹所在路径
const NGINX_CONF_PATH = path.join(CONFIG_DIR, 'nginx.conf'); // 这个不要改
const UI_CONFIG_PATH = path.join(__dirname, 'cdn-config.json'); // 这个也不要改
const NODE_CONF_PATH = '/opt/xiaolan-cdn-system/node.conf'; // node.conf路径
const LOGS_DIR = '/opt/xiaolan-cdn-system/node-access-logs'; // node-access-logs路径
const CMD_DIR = '/opt/xiaolan-cdn-system'; // CDN主程序路径

// ============================================================


// 确保目录存在
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// 身份验证中间件
const authMiddleware = (req, res, next) => {
    // 获取请求头中的 Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: '未授权，请先登录' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token 已失效或错误' });
        req.user = user;
        next();
    });
};

// 登录接口
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // 简单校验
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ user: ADMIN_USER }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }

    res.status(401).json({ success: false, message: '用户名或密码不正确' });
});

// nginx.conf配置

app.get('/api/nginx', authMiddleware, (req, res) => {
    if (fs.existsSync(UI_CONFIG_PATH)) {
        const data = fs.readFileSync(UI_CONFIG_PATH, 'utf-8');
        return res.json(JSON.parse(data));
    }
    res.json({ sites: [] });
});

app.post('/api/nginx', authMiddleware, (req, res) => {
    const { sites } = req.body;
    fs.writeFileSync(UI_CONFIG_PATH, JSON.stringify({ sites }, null, 4));
    let nginxConf = `worker_processes auto;
worker_rlimit_nofile 1048576;
pid /opt/xiaolan-cdn/logs/nginx.pid;

events {
    use epoll;
    worker_connections 65535;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    access_log /opt/xiaolan-cdn/logs/access.log;
    error_log /dev/null;
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 30;
    keepalive_requests 10000;

    gzip on;
    gzip_comp_level 6;
    gzip_min_length 1k;
    gzip_types text/plain text/css application/json application/javascript application/xml text/javascript;
    gzip_vary on;

    proxy_max_temp_file_size 0;
    proxy_cache_path /opt/xiaolan-cdn/cache levels=1:2 keys_zone=xiaolan-cdn-cache:200m inactive=7d max_size=5g;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }
`;

    // 生成server块
    sites.forEach(site => {
        const domainsStr = site.domains.join(' ');
        
        nginxConf += `
    server {
        listen 80;   
        listen 443 quic;
        listen 443 ssl;
        listen [::]:80;   
        listen [::]:443 quic;
        listen [::]:443 ssl ;   
        http2 on;
        server_name ${domainsStr};
`;

        // 域名重定向
        if (site.redirects && site.redirects.length > 0) {
            site.redirects.forEach(r => {
                nginxConf += `        if ($host = ${r.from}) {
            return 301 https://${r.to}$request_uri;
        }
`;
            });
        }

        // HTTP跳转HTTPS
        nginxConf += `        if ($scheme = http) {
            return 301 https://$host$request_uri;
        }
`;

        // 证书配置
        const certName = site.sslCertName || 'default';
        nginxConf += `        ssl_certificate /opt/xiaolan-cdn/conf/${certName}.pem;
        ssl_certificate_key /opt/xiaolan-cdn/conf/${certName}.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES256-SHA:ECDHE-RSA-AES256-SHA;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        add_header Strict-Transport-Security "max-age=31536000";
        add_header Alt-Svc 'h3=":443"; ma=86400';
        
        gzip on;
        gzip_min_length 1k;
        gzip_buffers 4 16k;
        gzip_http_version 1.1;
        gzip_comp_level 6;
        gzip_types text/plain application/javascript application/x-javascript text/javascript text/css application/xml application/json image/jpeg image/gif image/png font/ttf font/otf image/svg+xml application/xml+rss text/x-js;
        gzip_vary on;
        gzip_proxied expired no-cache no-store private auth; 

        proxy_cache_key $host$uri$is_args$args;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;

        location ~ .*\\.(${site.cacheExts || 'css|jpeg|jpg|gif|png|webp|woff|eot|ttf|svg|ico'})$ {
            proxy_cache xiaolan-cdn-cache;
            expires 14d;
        }

        location ^~ / {
            proxy_pass ${site.origin || 'http://127.0.0.1:80'};
            proxy_ssl_server_name on;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Real-Port $remote_port;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_set_header REMOTE-HOST $remote_addr;
            proxy_hide_header Strict-Transport-Security;
            proxy_connect_timeout 60s;
            proxy_send_timeout 600s;
            proxy_read_timeout 600s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;  
        }
    }
`;
    });

    nginxConf += `}\n`;
    fs.writeFileSync(NGINX_CONF_PATH, nginxConf);
    res.json({ success: true, message: 'Nginx 配置已生成并写入！' });
});

// 证书管理

app.get('/api/ssl', authMiddleware, (req, res) => {
    const files = fs.readdirSync(CONFIG_DIR);
    const pems = files.filter(f => f.endsWith('.pem')).map(f => f.replace('.pem', ''));
    res.json({ ssls: pems });
});

app.get('/api/ssl/:name', authMiddleware, (req, res) => {
    const { name } = req.params;
    const pemPath = path.join(CONFIG_DIR, `${name}.pem`);
    const keyPath = path.join(CONFIG_DIR, `${name}.key`);
    
    if (!fs.existsSync(pemPath) || !fs.existsSync(keyPath)) {
        return res.status(404).json({ success: false, message: '证书文件不存在' });
    }
    
    const pem = fs.readFileSync(pemPath, 'utf-8');
    const key = fs.readFileSync(keyPath, 'utf-8');
    res.json({ success: true, name, pem, key });
});

app.post('/api/ssl', authMiddleware, (req, res) => {
    const { name, pem, key } = req.body;
    if (!name || !pem || !key) return res.status(400).json({ success: false, message: '参数不完整' });
    
    fs.writeFileSync(path.join(CONFIG_DIR, `${name}.pem`), pem);
    fs.writeFileSync(path.join(CONFIG_DIR, `${name}.key`), key);
    res.json({ success: true, message: '证书保存成功！' });
});

app.delete('/api/ssl/:name', authMiddleware, (req, res) => {
    const { name } = req.params;
    const pemPath = path.join(CONFIG_DIR, `${name}.pem`);
    const keyPath = path.join(CONFIG_DIR, `${name}.key`);
    try {
        if (fs.existsSync(pemPath)) fs.unlinkSync(pemPath);
        if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
        res.json({ success: true, message: `证书 [${name}] 已成功删除！` });
    } catch (error) {
        res.status(500).json({ success: false, message: '删除证书失败' });
    }
});

// 节点管理

app.get('/api/nodes', authMiddleware, (req, res) => {
    if (!fs.existsSync(NODE_CONF_PATH)) return res.json({ nodes: [] });
    
    const content = fs.readFileSync(NODE_CONF_PATH, 'utf-8');
    const blocks = content.split(/\r?\n\r?\n/); 
    const nodes = blocks.filter(b => b.trim() !== '').map(block => {
        const lines = block.split(/\r?\n/).map(l => l.trim());
        return {
            name: lines[0] || '',
            ip: lines[1] || '',
            port: lines[2] || '22',
            username: lines[3] || 'root',
            password: lines[4] || ''
        };
    });
    res.json({ nodes });
});

app.post('/api/nodes', authMiddleware, (req, res) => {
    const { nodes } = req.body;
    const content = nodes.map(n => 
        `${n.name}\n${n.ip}\n${n.port}\n${n.username}\n${n.password}`
    ).join('\n\n');
    fs.writeFileSync(NODE_CONF_PATH, content + '\n');
    res.json({ success: true, message: '节点配置已成功保存！' });
});

// 系统控制

const runCommand = (cmd, res) => {
    exec(cmd, { cwd: CMD_DIR, maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
        let output = stdout + stderr;
        if (error) output += `\n【系统错误】: ${error.message}`;
        res.json({ success: !error, output: output });
    });
};

app.post('/api/sync', authMiddleware, (req, res) => runCommand('./main', res));
app.post('/api/update', authMiddleware, (req, res) => runCommand('./update', res));

// 日志查看

app.get('/api/logs', authMiddleware, (req, res) => {
    if (!fs.existsSync(LOGS_DIR)) return res.json({ files: [] });
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
    res.json({ files });
});

app.get('/api/logs/:filename', authMiddleware, (req, res) => {
    const filePath = path.join(LOGS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: '文件不存在' });
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
});

app.listen(3000, () => console.log('后端在 http://localhost:3000 运行'));