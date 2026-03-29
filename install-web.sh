#!/bin/bash
echo "Xiaolan-CDN-Web安装脚本"
echo "安装所需运行库"
apt install unzip -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
\. "$HOME/.nvm/nvm.sh"
nvm install 24
echo "安装完成"
echo "创建目录"
mkdir /opt/xiaolan-cdn-web
echo "创建目录完成"
echo "下载压缩包"
wget -P /opt/xiaolan-cdn-web https://github.com/Xiaolan2333/Xiaolan-CDN/releases/latest/download/Xiaolan-CDN-Web.zip
echo "压缩包下载完成"
echo "解压压缩包"
unzip /opt/xiaolan-cdn/Xiaolan-CDN-Web.zip -d /opt/xiaolan-cdn-web
chmod -R 777 /opt/xiaolan-cdn-web
echo "解压完成"
echo "安装依赖"
cd /opt/xiaolan-cdn-web && npm install
echo "依赖安装完成"
echo "设置Systemd配置文件"
cat > /etc/systemd/system/xiaolan-cdn-web.service << 'EOF'
[Unit]
Description=Xiaolan-CDN-Web
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/opt/xiaolan-cdn-web
ExecStart=node server.js

[Install]
WantedBy=multi-user.target
EOF
echo "设置Systemd配置文件成功"
echo "启动后端程序"
systemctl daemon-reload
systemctl enable xiaolan-cdn-web --now
echo "节点安装完成"