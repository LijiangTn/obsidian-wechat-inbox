import { Notice } from "obsidian";
import {
	PROCESSED_MESSAGE_LIMIT,
} from "../constants";
import { logger } from "../logger";
import type {
	MessageLogEntry,
	MessageStatus,
	PersistedState,
	Update,
	WeChatInboxSettings,
} from "../types";
import type { AttachmentInfo, VaultWriter } from "./VaultWriter";
import { resolveWorkerError } from "../worker-errors";

/*********************************** 依赖与结果 ***********************************/
export interface MessageServiceDeps {
	client: import("../client").FileHelperClient;
	writer: VaultWriter;
	settings: WeChatInboxSettings;
	state: PersistedState;
	saveState: () => Promise<void> | void;
	notifyStats: () => Promise<void> | void;
	onMessage: (entry: MessageLogEntry) => void;
}

export interface IngestResult {
	processed: number;
	skipped: number;
}

/*********************************** 消息处理服务 ***********************************/
export class MessageService {
	private client: import("../client").FileHelperClient;
	private writer: VaultWriter;
	private settings: WeChatInboxSettings;
	private state: PersistedState;
	private saveState: () => Promise<void> | void;
	private notifyStats: () => Promise<void> | void;
	private onMessage: (entry: MessageLogEntry) => void;
	private lastError: string | null = null;

	constructor(deps: MessageServiceDeps) {
		this.client = deps.client;
		this.writer = deps.writer;
		this.settings = deps.settings;
		this.state = deps.state;
		this.saveState = deps.saveState;
		this.notifyStats = deps.notifyStats;
		this.onMessage = deps.onMessage;
	}

	/*********************************** 对外接口 ***********************************/
	updateSettings(settings: WeChatInboxSettings): void {
		this.settings = settings;
	}

	getLastError(): string | null {
		return this.lastError;
	}

	// Worker's getUpdates uses id > offset (strict). lastUpdateId already
	// holds the largest id we've seen, so the next call needs offset =
	// lastUpdateId to receive id > lastUpdateId.
	async pollOnce(): Promise<IngestResult> {
		const offset = this.state.lastUpdateId;

		if (!this.settings.autoCreateMarkdown) {
			return this.drainOffsetOnly(offset);
		}

		let updates: Update[];
		try {
			updates = await this.client.getUpdates(offset, 50);
			this.lastError = null;
		} catch (err) {
			this.lastError = await resolveWorkerError(err);
			return { processed: 0, skipped: 0 };
		}

		return this.processUpdates(updates);
	}

	/*********************************** 同步流程 ***********************************/
	// Used when autoCreateMarkdown is off — advance offset without
	// writing anything so toggling writes back on is seamless.
	private async drainOffsetOnly(offset: number): Promise<IngestResult> {
		try {
			const updates = await this.client.getUpdates(offset, 50);
			this.lastError = null;
			if (updates.length > 0) {
				for (const update of updates) {
					this.emit(update, "skipped", "auto_create_markdown_off");
				}
				this.advanceOffset(updates);
				await this.saveState();
			}
		} catch (err) {
			this.lastError = await resolveWorkerError(err);
		}
		return { processed: 0, skipped: 0 };
	}

	private async processUpdates(updates: Update[]): Promise<IngestResult> {
		let processed = 0;
		let skipped = 0;
		for (const update of updates) {
			const msg = update.message;

			if (!msg.message_id) {
				this.advanceOffset([update]);
				continue;
			}

			if (this.seen(msg.message_id)) {
				this.advanceOffset([update]);
				this.emit(update, "skipped", "duplicate");
				this.log(update, "skipped", "duplicate");
				skipped += 1;
				continue;
			}

			if (msg.is_from_bot) {
				this.remember(msg.message_id);
				this.advanceOffset([update]);
				this.emit(update, "skipped", "is_from_bot");
				this.log(update, "skipped", "is_from_bot");
				continue;
			}

			this.log(update, "received");

			try {
				await this.handleUpdate(update);
				this.remember(msg.message_id);
				this.advanceOffset([update]);
				this.emit(update, "processed");
				this.log(update, "processed");
				processed += 1;
			} catch (err) {
				const errorStr = err instanceof Error ? err.message : String(err);
				this.lastError = await resolveWorkerError(err);
				this.emit(update, "error", errorStr);
				this.log(update, "error", errorStr);
				new Notice(`[WeChat Inbox] 处理消息失败: ${errorStr}`);
			}
		}

		if (processed > 0 || skipped > 0) {
			await this.saveState();
			void this.notifyStats();
		}
		return { processed, skipped };
	}

	private async handleUpdate(update: Update): Promise<void> {
		const msg = update.message;

		let attachment: AttachmentInfo | undefined;
		if (msg.type === "file" || msg.type === "image") {
			const att = await this.writer.saveAttachment(msg, this.client);
			if (att) attachment = att;
		}

		const dayFilePath = await this.writer.appendToDailyInbox(
			msg,
			update.update_id,
			attachment,
		);
		const dayFileName = (dayFilePath.split("/").pop() ?? "").replace(/\.md$/, "");
		await this.writer.appendToMessageIndex(msg, update.update_id, dayFileName);
	}

	/*********************************** 去重与偏移 ***********************************/
	private seen(id: string): boolean {
		return this.state.processedMessageIds.includes(id);
	}

	private remember(id: string): void {
		if (this.seen(id)) return;
		this.state.processedMessageIds.push(id);
		if (this.state.processedMessageIds.length > PROCESSED_MESSAGE_LIMIT) {
			this.state.processedMessageIds.splice(
				0,
				this.state.processedMessageIds.length - PROCESSED_MESSAGE_LIMIT,
			);
		}
	}

	private advanceOffset(updates: Update[]): void {
		for (const update of updates) {
			this.state.lastUpdateId = Math.max(update.update_id, this.state.lastUpdateId);
		}
	}

	/*********************************** 日志与通知 ***********************************/
	private log(update: Update, status: MessageStatus, error?: string): void {
		const msg = update.message;
		const summary = msg.type === "text"
			? `text="${truncate(msg.text, 80)}"`
			: msg.document?.file_name
				? `file=${msg.document.file_name}`
				: `${msg.type}`;
		logger.info(
			`[RECV] uid=${update.update_id} mid=${msg.message_id || "<none>"} type=${msg.type} ${summary} → ${status}${error ? ` err=${error}` : ""}`,
		);
	}

	private emit(update: Update, status: MessageStatus, error?: string): void {
		const msg = update.message;
		const entry: MessageLogEntry = {
			receivedAt: Date.now(),
			msgId: msg.message_id || "",
			updateId: update.update_id,
			type: msg.type,
			text: msg.text || "",
			fileName: msg.document?.file_name,
			status,
			error,
		};
		try {
			this.onMessage(entry);
		} catch (err) {
			logger.warn("onMessage callback threw", err);
		}
	}
}

/*********************************** 工具函数 ***********************************/
function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}
