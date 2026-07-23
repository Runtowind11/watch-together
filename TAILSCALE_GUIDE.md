# Tailscale 配置指南

通过 Tailscale 组建虚拟局域网，你和女朋友的设备就像在同一个局域网内，无需公网 IP。

## 1. 注册 Tailscale 账号

1. 打开 https://tailscale.com
2. 点击 **Get Started** → 用 Google / GitHub / Microsoft 账号登录
3. 登录后进入管理后台

## 2. 安装 Tailscale

### Windows（跑服务器的电脑）

1. 下载安装包: https://tailscale.com/download/windows
2. 安装后点击系统托盘的 Tailscale 图标 → **Log in**
3. 浏览器弹出登录页面 → 确认登录
4. 登录成功后记下虚拟 IP（如 `100.x.x.x`）

### 手机端（观看方）

| 平台 | 安装方式 |
|---|---|
| **Android** | Google Play 搜索 Tailscale 安装 |
| **iOS** | App Store 搜索 Tailscale 安装 |

1. 安装后打开 App → 登录同一个账号
2. 连接后等待几秒，会显示已连接

## 3. 确认连接

### 在电脑上检查

```powershell
# 查看 Tailscale 分配的 IP
tailscale ip -4
# 输出: 100.x.x.x
```

### 互相测试连通性

在**电脑**上运行：

```powershell
# 查看手机是否在线
tailscale status
# 输出:
# 100.x.x.x   你的电脑    windows
# 100.y.y.y   女朋友的手机  android/ios
```

在**电脑**上启动服务后用**手机**访问：

```
http://100.x.x.x:3001
```

如果能打开页面，说明 Tailscale 组网成功。

## 4. 启动项目

### 首次启动（构建前端）

```powershell
# 在项目根目录运行
.\start.ps1 -ServerUrl "http://100.x.x.x:3001"
```

### 后续启动（前端已构建）

```powershell
cd server
$env:NODE_ENV = "production"
$env:SERVER_URL = "http://100.x.x.x:3001"
npx tsx src/index.ts
```

## 5. 双方访问方式

| 角色 | 访问地址 |
|---|---|
| 你（电脑端，运行服务） | http://localhost:3001 |
| 女朋友（手机端，异地） | http://你电脑的TailscaleIP:3001 |

**注意：** 两者需要**使用同一个 Tailscale 账号**才能组网。

## 6. 常见问题

**Q: 手机连不上电脑**
- 检查手机是否已登录 Tailscale（App 界面显示 Connected）
- 检查电脑是否开机且 Tailscale 在运行
- 运行 `tailscale status` 确认手机在线

**Q: 视频播放卡顿**
- Tailscale 会自动选择最佳路径（直连或中继）
- 如果双方都是流量，网络差时可能走中继
- 建议有一方使用 WiFi 以提高速度

**Q: 换地方需要重新配置吗？**
- 不需要。Tailscale IP 跟随设备，无论你在哪里上网，IP 不变。
