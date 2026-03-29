# Xiaolan-CDN-Web

Gitee：https://gitee.com/Xiaolan23333/Xiaolan-CDN-Web

GitHub：https://github.com/Xiaolan2333/Xiaolan-CDN-Web

此仓库为`Xiaolan-CDN`系统的面板，不包含系统本体

## 食用方法

## 请一定要手动修改`本程序目录/server.js`中的第`14`行和第`16`行的变量项！！（`JWT 签名密钥`和`密码`）
## 请一定要手动修改`本程序目录/server.js`中的第`14`行和第`16`行的变量项！！（`JWT 签名密钥`和`密码`）
## 请一定要手动修改`本程序目录/server.js`中的第`14`行和第`16`行的变量项！！（`JWT 签名密钥`和`密码`）
* 当然最好把用户名也改了

#### 支持的操作系统
主控：

一键安装脚本仅支持`Deb`系

理论上支持所有可以运行Node.js的Linux系统
#### 环境要求

* Nginx或者其它建站环境
* Node.js（经测试24LTS可正常运行，其余版本未知）

#### 半自动安装
在安装此面板之前，请先安装Xiaolan-CDN主控！

本教程使用宝塔面板作为演示

* 我懒得在安装脚本里集成Nginx的安装和nginx.conf的设置了，凑合着用吧（

首先，安装宝塔面板：`www.bt.cn`。进入面板后安装Nginx（默认版本就行）

在SSH里执行脚本
```Bash
wget https://raw.githubusercontent.com/Xiaolan2333/Xiaolan-CDN-Web/refs/heads/main/install-web.sh && chmod 777 install-web.sh && ./install-web.sh
```
脚本会自动安装`Node.js 24 LTS`并将面板安装到`/opt/xiaolan-cdn-web`

修改`/opt/xiaolan-cdn-web/index.html`中的第`266`行为自己的接口地址：
```HTML
const API_BASE = 'http://你的服务器IP:3000/api'; 
```

在宝塔面板里--左侧边栏--网站--右侧PHP项目--中间添加站点新建一个站点：

```宝塔面板
传统项目
域名：如果有域名填域名:端口最好，如果没有就填服务器IP:端口（因为80 443容易被扫所以换一个不常用的）
备注：瞎写
根目录：/opt/xiaolan-cdn-web
FTP：不管它
数据库：不管它
PHP版本：纯静态
网站分类：不管它
```

在宝塔面板里--左侧边栏--网站--安全--添加端口规则添加以下两个规则：
```宝塔面板
协议：TCP
端口：3000
其它默认
点确定
```
```宝塔面板
协议：TCP
端口：上面项目里设置的IP:端口/域名:端口的冒号后面的那个端口
其它默认
点确定
```

然后访问IP:端口/域名:端口就可以快乐地玩耍了

* 需先安装Xiaolan-CDN主控
* 虽然前端为纯静态单HTML文件，但是HTML站点功能太少了看着不顺心
* 由于新版浏览器防降级攻击机制，如果面板启用了HTTPS则后端也需要启用HTTPS才可以正常通信


#### 手动安装

1.新建一个文件夹并进入：
```Bash
mkdir 文件夹名 && cd 文件夹名
```

2.下载主控文件：
```Bash
wget https://github.com/Xiaolan2333/Xiaolan-CDN/releases/latest/download/Xiaolan-CDN-Web.zip
```

3.解压：
```Bash
unzip Xiaolan-System-Web.zip
```

4.复制Systemd进程守护文件：（需自行修改路径）
```Bash
cp ./systemd/xiaolan-cdn-web.service /etc/systemd/system
```

5.运行后端
```Bash
systemctl daemon-reload && systemctl enable xiaolan-cdn-web.service --now
```

6.找个Nginx之类的，设置一个站点，目录就是你新建的文件夹的那个目录

* 当然你也可以和半自动安装一样使用`宝塔面板`

7.打开你设置的监听地址，开始愉快地玩耍

#### 如果安装Xiaolan-CDN主控时没有使用自动安装怎么使用`Xiaolan-CDN-Web`

修改`server.js`中的第17、20、21、22行为自己安装的路径