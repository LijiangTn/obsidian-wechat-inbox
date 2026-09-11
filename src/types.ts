/*********************************** 插件配置类型 ***********************************/
export interface WeChatInboxSettings {
	workerBaseUrl: string;
	inboxFolder: string;
	attachmentFolder: string;
	autoDateFolders: boolean;
	autoCreateMarkdown: boolean;
	autoConnect: boolean;
	pollIntervalMs: number;
}

/*********************************** Worker 协议类型 ***********************************/
// weave /login/status 的响应字段都在这里,新增字段对插件无影响 —— 只读需要用到的。
export interface LoginStatus {
	logged_in: boolean;
	code?: number;
	status?: string;
	state?: string;
	message?: string;
	has_auth?: boolean;
	has_uuid: boolean;
	uuid?: string;
	uuid_age_seconds?: number | null;
	entry_host?: string;
	login_host?: string;
	trace_enabled?: boolean;
	trace_file?: string;
	last_error?: string | null;
}

export interface UpdateDocument {
	file_name: string;
	file_path?: string;
	file_size?: number;
}

export interface UpdateMessage {
	message_id: string;
	date: number;
	text: string;
	type: "text" | "image" | "file" | "unknown" | string;
	document?: UpdateDocument | null;
	reply_to_message_id?: string | number | null;
	is_from_bot?: boolean;
}

export interface Update {
	update_id: number;
	message: UpdateMessage;
}

export interface FileMetaResult {
	file_id: string;
	file_unique_id: string;
	file_size?: number;
	file_path: string;
}

/*********************************** 插件状态类型 ***********************************/
export interface StoreStats {
	message_count?: number;
	today_message_count?: number;
	file_count?: number;
	max_update_id?: number;
}

export type ConnectionPhase =
	| { kind: "disconnected"; reason: string }
	| { kind: "waiting_qr"; uuidAgeSeconds: number | null }
	| { kind: "scanned"; status: string }
	| { kind: "connected" }
	| { kind: "error"; message: string };

export interface PersistedState {
	lastUpdateId: number;
	processedMessageIds: string[];
}

/*********************************** 消息日志类型 ***********************************/
export type MessageStatus = "received" | "processed" | "skipped" | "error";

/**
 * 插件对外（公共 API / 内部日志）暴露的稳定消息类型字面量联合。
 *
 * 边界：worker 协议层的 `UpdateMessage.type` 是 `string`（会带 "unknown"，
 * 将来可能加新类型）；下游消费方（`MessageLogEntry` 和 `PublicMessage`）
 * 必须是这个字面量联合，让消费方拿到的 type 一定落在已支持范围内。
 * 归一化由 `MessageService` 在边界完成，不要在下游 `as any` 或放宽。
 */
export type PublicMessageType = "text" | "image" | "file";

export interface MessageLogEntry {
	receivedAt: number;
	msgId: string;
	updateId: number;
	type: PublicMessageType;
	text: string;
	fileName?: string;
	status: MessageStatus;
	error?: string;
}
