<div align="center">
  <img src="logo.png" alt="WeChat Inbox logo" width="180">
</div>

<h1 align="center">WeChat Inbox</h1>

<div align="center">
  把微信「文件传输助手」接入 Obsidian，作为一个本地优先的个人知识收件箱。
</div>

<div align="center">
  文字、图片、文件会通过本地 worker 拉取，并自动归档到 Vault 中按天组织的 Markdown 与附件目录。
</div>

---

## 概述

`WeChat Inbox` 是一个 Obsidian 社区插件，用来把微信「文件传输助手」中的内容同步到你的知识库。

插件本身不处理微信协议，也不直接与微信服务器通信。实际的二维码登录、消息轮询、文件下载与协议解析，全部由本地运行的 `wx-filehelper-api` worker 负责；本项目只负责：

- 在 Obsidian 中提供设置页、命令、右侧视图和状态展示
- 定期从本地 worker 拉取更新
- 去重、记录处理状态并落盘到 Vault
- 为其他插件或自动化脚本暴露稳定的公共 API

如果你希望把手机里发给「文件传输助手」的临时资料，自动沉淀到 Obsidian 中，这个插件就是为这个场景设计的。

---

## 核心特性

- **本地优先**：默认所有数据都保留在本机 Vault 与本地 worker 中
- **自动归档**：按天写入 `YYYY-MM-DD.md`，避免信息散落
- **多类型支持**：支持文本、图片与通用文件
- **幂等处理**：基于 `message_id` 与 `lastUpdateId` 做双层去重
- **可读索引**：维护一份人类可读的 `message-index.md`
- **Agent 友好**：通过 `app.plugins.plugins["wechat-inbox"].api` 暴露查询接口

---

## 非目标

为避免定位模糊，这个插件**不负责**以下事项：

- 不解析微信协议
- 不模拟或接管微信客户端行为
- 不替代 `wx-filehelper-api` worker
- 不上传数据到云端
- Phase 1 不内置 AI 处理能力

---

## 工作方式

整体链路如下：

1. 本地 `wx-filehelper-api` worker 负责二维码登录、消息拉取与文件下载。
2. `WeChat Inbox` 插件定时调用 worker 的 HTTP 接口。
3. 插件对消息进行去重、分类与错误处理。
4. 文本写入每日 Markdown，附件写入日期目录下的附件文件夹。
5. 插件同步维护一份消息索引与运行时状态，保证重启后可恢复。

默认目录结构示例：

```text
WeChat Inbox/
├── 2026/
│   └── 09/
│       └── 09/
│           ├── 2026-09-09.md
│           └── attachments/
│               ├── FastAPI最佳实践.pdf
│               └── img_6695653967305283517.jpg
└── _system/
    └── message-index.md
```

---

## 隐私与安全

本项目默认采用本地处理模式：

- 不上传微信消息、文件或账号信息
- 不引入远程脚本执行
- 不向第三方服务发送 Vault 内容
- 所有持久化数据只保存在 Vault 和插件本地数据文件中

你仍然需要自行确保本地 worker 的部署方式、端口暴露范围以及 Vault 所在设备的安全性。

---

## 环境要求

- Obsidian `1.7.2` 或更高版本
- 本地运行的 `wx-filehelper-api` worker
- 默认 worker 地址：`http://127.0.0.1:8000`
- Node.js 18+（仅在从源码构建时需要）

---

## 安装

### 手动安装

1. 在目标 Vault 下创建目录 `.obsidian/plugins/wechat-inbox/`
2. 从 [Releases](../../releases) 下载以下文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. 将它们放入 `.obsidian/plugins/wechat-inbox/`
4. 打开 Obsidian，进入 **Settings → Community plugins**
5. 启用 **WeChat Inbox**

### 使用 BRAT

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. 在 BRAT 中添加当前仓库
3. 由 BRAT 安装和更新插件

### 从源码构建

```bash
git clone <this-repo>
cd obsidian-wechat-inbox
npm install
npm run build
```

构建完成后，将 `main.js`、`manifest.json`、`styles.css` 复制到：

```text
<vault>/.obsidian/plugins/wechat-inbox/
```

---

## 配置

在 Obsidian 中打开 **Settings → WeChat Inbox**：

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Worker 地址 | `http://127.0.0.1:8000` | 本地 `wx-filehelper-api` 的 HTTP 地址 |
| 知识库目录 | `WeChat Inbox` | Vault 内收件箱根目录 |
| 附件目录 | `attachments` | 当日目录下的附件子目录名 |
| 按日期分层 | `ON` | 以 `年/月/日` 组织目录 |
| 自动写入 Markdown | `ON` | 关闭后仅推进 offset，不写入 Vault |
| 启动 Obsidian 时自动连接 | `ON` | 插件加载完成后立即开始轮询 |
| 轮询间隔（毫秒） | `2000` | 拉取消息的间隔，最低 `500` |

设置变更会即时作用于运行中的插件实例；例如，Worker 地址变更后会立刻切换到新的目标地址。

---

## 使用方法

1. 点击左侧 Ribbon 的消息图标，或通过命令面板执行 **打开微信收件箱**
2. 右侧栏会显示二维码
3. 使用手机微信扫码，并在手机上确认登录
4. 状态切换为“已连接”后，发送到「文件传输助手」的内容会自动同步

---

## 视图与命令

### 右侧视图

右侧栏会展示：

- 当前连接状态
- 今天 / 累计消息数
- 最近消息日志
- 最近错误信息
- 当前 worker 地址与收件箱目录
- 常用操作按钮，例如刷新二维码、重新拉取、打开收件箱目录

### 命令面板

| 命令 | 说明 |
|---|---|
| 打开微信收件箱 | 打开或聚焦右侧收件箱视图 |
| 刷新微信二维码 | 立即重新获取登录二维码 |
| 重新拉取消息 | 重置 `lastUpdateId`，重新从 worker 拉取未处理更新 |
| 处理全部消息（清空已处理列表） | 清空去重记录并从头处理消息，适合排障或重建 |

---

## 数据布局

插件运行后，会在 Vault 与插件数据目录中维护三类数据：

```text
<vault>/
├── WeChat Inbox/
│   ├── 2026/
│   │   └── 09/
│   │       └── 09/
│   │           ├── 2026-09-09.md
│   │           └── attachments/
│   └── _system/
│       └── message-index.md
└── .obsidian/plugins/wechat-inbox/
    └── data.json
```

说明如下：

- `YYYY-MM-DD.md`：当天消息的正文内容，适合阅读和后续知识处理
- `message-index.md`：人类可读的消息索引，包含 `msg_id`、`update_id`、日期文件引用
- `data.json`：插件运行时状态，包括 `processedMessageIds` 与 `lastUpdateId`

为保持每日文件干净，`msg_id` 与 `update_id` 不会写入当天正文文件本身。

---

## 公共 API

插件会在 `app.plugins.plugins["wechat-inbox"].api` 上暴露公共接口：

```ts
const plugin = app.plugins.plugins["wechat-inbox"];

const recent = plugin.api.getRecentMessages(50);
const indexPath = plugin.api.getMessageIndexPath();
const inboxFolder = plugin.api.getInboxFolder();
const status = plugin.api.getConnectionStatus();
```

返回能力包括：

- 最近消息列表
- 消息索引文件路径
- 当前收件箱根目录
- 当前连接状态

完整类型定义见 `src/api.ts`。

---

## 常见问题

### 二维码显示正常，但始终无法登录

- 确认本地 worker 正在运行
- 检查设置中的 Worker 地址是否正确
- 确认手机端已在扫码后点击“登录”

可以先测试 worker 状态接口：

```bash
curl http://127.0.0.1:8000/login/status
```

### 视图显示已连接，但 Vault 中没有写入内容

- 确认 **自动写入 Markdown** 处于开启状态
- 检查 worker 是否已经收到消息
- 打开 Obsidian 开发者工具查看错误日志

```bash
curl http://127.0.0.1:8000/store/stats
```

### 重启 Obsidian 后怀疑出现重复导入

正常情况下不会重复，因为插件会持久化：

- `processedMessageIds`
- `lastUpdateId`

如果你手动执行了“处理全部消息（清空已处理列表）”，则插件会重新处理历史消息，这是预期行为。

---

## 调试

调试时建议打开 Obsidian 开发者工具：

```text
View → Toggle Developer Tools
```

在 Console 中将日志级别切换为 `Verbose`，插件日志会带统一前缀：

```text
[WeChat Inbox][INFO] [BOOT] plugin loaded {"baseUrl":"http://127.0.0.1:8000"}
[WeChat Inbox][INFO] [RECV] uid=12 mid=1700000000123 type=text text="hello" → processed
[WeChat Inbox][INFO] [POLL] processed=1 skipped=0 offset=12
[WeChat Inbox][INFO] [QR] refreshed
```

---

## 开发

### 本地开发

```bash
npm install
npm run dev
```

### 生产构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### 目录结构

```text
src/
├── main.ts
├── constants.ts
├── types.ts
├── logger.ts
├── client.ts
├── settings.ts
├── api.ts
├── worker-errors.ts
├── plugin/
│   ├── state.ts
│   └── polling.ts
├── services/
│   ├── derive-phase.ts
│   ├── VaultWriter.ts
│   └── MessageService.ts
└── view/
    ├── InboxView.ts
    └── render.ts
```

---

## 许可证

本项目基于 [MIT License](LICENSE) 发布。

---

## 致谢

- `wx-filehelper-api`：负责本地二维码登录、消息获取与文件下载
- Obsidian 团队：提供插件 API 与社区生态
- `obsidian-sample-plugin`：项目骨架的起点
