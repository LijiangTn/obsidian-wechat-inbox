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
export interface LoginStatus {
	logged_in: boolean;
	code: number;
	status: string;
	has_uuid: boolean;
	uuid?: string;
	uuid_age_seconds?: number | null;
	entry_host?: string;
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
	type: "text" | "image" | "file";
	document?: UpdateDocument | null;
	reply_to_message_id?: string | null;
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
	today_message_count?: number;
	message_count?: number;
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

export interface MessageLogEntry {
	receivedAt: number;
	msgId: string;
	updateId: number;
	type: "text" | "image" | "file";
	text: string;
	fileName?: string;
	status: MessageStatus;
	error?: string;
}
