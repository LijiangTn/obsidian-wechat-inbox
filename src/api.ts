/**
 * @fileoverview 插件的公共 API 接口。
 *
 * 其他插件和 agent 集成通过
 * `app.plugins.plugins["wechat-inbox"].api` 访问插件能力。
 * 这里定义的接口是公开契约——保持精简、稳定，并与内部模块解耦。
 */

import type { ConnectionPhase, PublicMessageType } from "./types";

/*********************************** 公共消息结构 ***********************************/
/**
 * 通过公共 API 暴露的微信消息结构。
 *
 * 比内部的 `MessageLogEntry` 更窄：内部专用字段（如内存日志缓冲位置）
 * 不属于稳定契约的一部分。
 */
export interface PublicMessage {
	/** 插件首次观测到此消息的本地 epoch 毫秒数。 */
	receivedAt: number;
	/** 微信消息 ID，重启后仍然稳定。 */
	msgId: string;
	/** Worker update_id，同时也是 `getUpdates` 的 offset。 */
	updateId: number;
	/** worker 上报的消息类型。 */
	type: PublicMessageType;
	/** 消息正文（仅文本；附件类型为空）。 */
	text: string;
	/** 原始文件名（仅图片 / 文件消息）。 */
	fileName?: string;
	/** 插件如何处理这条消息。 */
	status: "received" | "processed" | "skipped" | "error";
	/** 当 status === "error" 时的错误字符串。 */
	error?: string;
}

/*********************************** 公共 API ***********************************/
/**
 * 在 `app.plugins.plugins["wechat-inbox"].api` 上暴露的公共 API。
 *
 * 为 agent 集成设计：调用方可以询问最近消息列表、定位磁盘上的人类可读索引、
 * 或查询当前连接状态，而不需要了解内部实现细节。
 *
 * @example
 * ```ts
 * const plugin = app.plugins.plugins["wechat-inbox"] as WeChatInboxPlugin;
 * const recent = plugin.api.getRecentMessages(50);
 * const indexPath = plugin.api.getMessageIndexPath();
 * ```
 */
export interface WeChatInboxAPI {
	/**
	 * 获取最近接收的 `limit` 条消息，按时间倒序。
	 * `limit` 默认 100，受 `RECENT_MESSAGE_LIMIT` 限制。
	 */
	getRecentMessages(limit?: number): PublicMessage[];

	/** 人类可读的消息索引 Markdown 的 Vault 相对路径。 */
	getMessageIndexPath(): string;

	/** 收件箱根目录的 Vault 相对路径。 */
	getInboxFolder(): string;

	/** 当前连接相位——用来判断 worker 是否在线。 */
	getConnectionStatus(): ConnectionPhase;
}
