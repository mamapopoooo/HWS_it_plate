# 服务器部署与权限（墨境 / hw-platform）

> 目标：让任何一位 Agent（尤其 Codex）**不改本机环境也能直接把站点更新上线**。
> 本文只写流程与命令；密钥以加密形式存放，见 §3。

---

## 1. 线上环境

| 项 | 值 |
|---|---|
| 域名 | `http://sherryworkspace.cn`（= `110.40.142.247`） |
| 前端站点 | `http://sherryworkspace.cn/pet-garden/` |
| 后端 API | `http://sherryworkspace.cn/api/` → 反代 `127.0.0.1:3002` |
| 前端目录 | `/var/www/hw-platform/pet-garden`（nginx root `/var/www/hw-platform`） |
| 后端目录 | `/opt/pet-garden-server`（`node index.js`，SQLite `pet-garden.db`） |
| 入口页 | `/var/www/hw-platform/pet.html`、`assets/js/config.js` |
| 管理员账号 | `admin`（口令由用户保管，不在仓库记录） |
| nginx 配置 | `/etc/nginx/sites-available/hw-platform` |

### 权限模型（2026-11-26 起）

| 账号 | 权限 | 用途 |
|---|---|---|
| `ubuntu` + `hw_server_key` | **全权 sudo** | 运维：后端、数据库、nginx、系统服务（DSH 持有） |
| `site-deploy` + `site-deploy-20261126` | **仅前端目录可写**（`www-data` 组成员 + 目录 setgid），**无 sudo** | 日常前端发布（Codex 可用） |

`site-deploy` 只能改 `/var/www/hw-platform/pet-garden/` 里的静态文件，
**不能**碰后端、数据库、nginx、其他站点目录。密钥泄露的最坏后果是"网站被改版"，不是"服务器被接管"。

---

## 2. 发布前端（标准流程）

### 2.1 Linux / macOS / WSL / Codex 环境

```bash
# 1) 解密私钥（口令单独保管，见 §3）
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in deploy/keys/site-deploy-20261126.key.enc \
  -out ~/.ssh/site_deploy_20261126 -pass pass:<口令>
chmod 600 ~/.ssh/site_deploy_20261126

# 2) 构建 + 发布（自动备份 + 校验）
bash deploy/deploy-web.sh

# 只发布已构建好的 dist：
bash deploy/deploy-web.sh --no-build
```

### 2.2 Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1
```

### 2.3 脚本做了什么

1. `node node_modules/vite/bin/vite.js build`（可跳过）
2. 删除 `dist/art-review`（候选图不进正式包）
3. 打包 → `scp` 到服务器 `/tmp`
4. 服务器侧：`tar -czf ~/backups/web-<时间戳>.tgz` 备份当前站点
5. 清理 `assets/` 后解包新构建（`index.html` 为 no-cache，不会白屏）
6. 线上校验：`index.html` 200、引用的 assets 全部 200

### 2.4 回滚

```bash
ssh -i ~/.ssh/site_deploy_20261126 site-deploy@110.40.142.247 \
  "ls ~/backups"                        # 找到要回滚的包
ssh -i ~/.ssh/site_deploy_20261126 site-deploy@110.40.142.247 \
  "tar -xzf ~/backups/web-<时间戳>.tgz -C /var/www/hw-platform && echo 已回滚"
```

> 前端目录内有 `pet-garden.old`（上一次切换前的整站副本），由 DSH 的运维账号维护。

---

## 3. 密钥（加密存放，禁止明文入库）

仓库是 **public**，所以私钥只以 AES-256 加密形式提交：

| 文件 | 说明 |
|---|---|
| `deploy/keys/site-deploy-20261126.pub` | 公钥，可公开 |
| `deploy/keys/site-deploy-20261126.key.enc` | 私钥密文（openssl AES-256-CBC + PBKDF2 20 万轮） |

- **口令不写在仓库里**，由用户单独保管并转交需要部署的 Agent
- 解密命令见 §2.1
- 若密文或口令外泄：在服务器上删掉 `site-deploy` 的 `authorized_keys` 行即可立即失效，
  然后重新生成密钥对（`ssh-keygen -t ed25519 -f new_key`），把公钥追加到
  `/home/site-deploy/.ssh/authorized_keys`

---

## 4. 后端发布（仅 DSH 运维账号）

后端需要 sudo，`site-deploy` 无权执行。流程：

```bash
# 备份代码与数据库
sudo tar -czf /opt/backup-$(date +%Y%m%d-%H%M%S)/server-code.tgz -C /opt pet-garden-server --exclude=node_modules
sudo cp /opt/pet-garden-server/pet-garden.db /opt/backup-.../pet-garden.db

# 覆盖代码（保留 node_modules 与 db）
sudo cp -r /tmp/server/. /opt/pet-garden-server/

# 重启（当前为 nohup 方式）
sudo pkill -f '/opt/pet-garden-server/index.js'
cd /opt/pet-garden-server && sudo -u ubuntu nohup node index.js > server.log 2>&1 &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/api/health
```

> 后端启动会自动跑增量迁移（`CREATE`/`ADD COLUMN` 为主）。库结构备份必须与代码备份同批保存。

---

## 5. 2026-11-16 首次上线记录（补 Codex 追问）

| 项 | 内容 |
|---|---|
| 授权来源 | 用户在会话中要求「把通过 pet.html 进入的后续页面更新掉」 |
| 部署提交 | 前端 `27838b3`（本仓库 dev-dsh），后端同一提交的 `server/` |
| 备份 | `/opt/backup-20261116-183621/{server-code.tgz, pet-garden.db, web.tgz}` |
| schema | 启动时自动增量迁移；`user_version=0`，表数 49（迁移以表结构判断，不依赖版本号） |
| 回滚验证 | 前端：`pet-garden.old` 与 `backups/web-*.tgz` 可直接覆盖；后端：还原 `server-code.tgz` + `pet-garden.db` 后重启 |
| 遗留风险 | 线上管理员口令仍为默认值，需尽快修改 |
