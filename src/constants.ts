/*********************************** 类型导入 ***********************************/
import type { WeChatInboxSettings } from "./types";

/*********************************** 轮询相关 ***********************************/

// 允许的最短轮询间隔（毫秒）
export const MIN_POLL_INTERVAL_MS = 500;
// 当 settings.pollIntervalMs 非法时使用的默认轮询间隔（毫秒）
export const DEFAULT_POLL_INTERVAL_MS = 2_000;
// 二维码刷新周期（毫秒）
export const QR_REFRESH_INTERVAL_MS = 90_000;


/*********************************** 去重相关 ***********************************/
// 保留用于去重的 message_id 上限。超过上限时按 FIFO 丢弃最早条目。
export const PROCESSED_MESSAGE_LIMIT = 5_000;
// 从磁盘加载 processedMessageIds 时保留的最大条数。
export const PROCESSED_IDS_LOAD_LIMIT = 5_000;


/*********************************** UI 相关 ***********************************/
// 右侧消息日志面板保留的最大消息条数。 */
export const RECENT_MESSAGE_LIMIT = 200;
/** 视图在折叠前渲染的最大消息条数。 */
export const MAX_RENDERED_MESSAGES = 200;


/*********************************** Obsidian 相关 ***********************************/
// 自定义 Obsidian 视图类型，用于识别微信收件箱侧栏。
export const WECHAT_INBOX_VIEW_TYPE = "wechat-inbox-view";


/*********************************** Worker 相关 ***********************************/
// weave worker 的默认地址。
export const DEFAULT_WORKER_BASE_URL = "http://127.0.0.1:8081";
// Vault 内默认收件箱根目录。
export const DEFAULT_INBOX_FOLDER = "WeChat Inbox";
// 默认附件子目录名（放在每日目录内）。
export const DEFAULT_ATTACHMENT_FOLDER = "attachments";


/*********************************** 默认配置 ***********************************/
export const DEFAULT_SETTINGS: WeChatInboxSettings = {
	workerBaseUrl: DEFAULT_WORKER_BASE_URL,
	inboxFolder: DEFAULT_INBOX_FOLDER,
	attachmentFolder: DEFAULT_ATTACHMENT_FOLDER,
	autoDateFolders: true,
	autoCreateMarkdown: true,
	autoConnect: true,
	pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
};


/*********************************** 日志相关 ***********************************/
export const LOGGER_TAG = "WeChat Inbox";


/*********************************** 二进制处理 ***********************************/
export const BASE64_CHUNK_SIZE = 0x8000;


/*********************************** 文件处理 ***********************************/
export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
