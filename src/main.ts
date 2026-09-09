import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { PublicMessage, WeChatInboxAPI } from "./api";
import {
	bufferToBase64,
	FileHelperClient,
	HttpError,
} from "./client";
import {
	DEFAULT_SETTINGS,
	DEFAULT_INBOX_FOLDER,
	RECENT_MESSAGE_LIMIT,
	WECHAT_INBOX_VIEW_TYPE,
} from "./constants";
import { logger } from "./logger";
import { PollingLoop } from "./plugin/polling";
import { PluginStateStore } from "./plugin/state";
import { derivePhase } from "./services/derive-phase";
import { MessageService } from "./services/MessageService";
import { VaultWriter } from "./services/VaultWriter";
import { WeChatInboxSettingTab } from "./settings";
import type {
	ConnectionPhase,
	LoginStatus,
	MessageLogEntry,
	StoreStats,
	WeChatInboxSettings,
} from "./types";
import {
	InboxViewState,
	ViewActions,
	WeChatInboxView,
} from "./view/InboxView";
import { resolveWorkerError } from "./worker-errors";

export default class WeChatInboxPlugin extends Plugin {
	private stateStore!: PluginStateStore;
	private client!: FileHelperClient;
	private writer!: VaultWriter;
	private messageService!: MessageService;

	get settings(): WeChatInboxSettings {
		return this.stateStore.settings;
	}

	private phase: ConnectionPhase = { kind: "disconnected", reason: "init" };
	private qrDataUrl: string | null = null;
	private stats: StoreStats | null = null;
	private recentMessages: MessageLogEntry[] = [];

	private pollingLoop = new PollingLoop();
	private inboxView: WeChatInboxView | null = null;

	get api(): WeChatInboxAPI {
		return {
			getRecentMessages: (limit) => this.getRecentMessages(limit),
			getMessageIndexPath: () => this.getMessageIndexPath(),
			getInboxFolder: () => this.stateStore.settings.inboxFolder,
			getConnectionStatus: () => this.phase,
		};
	}

	async onload(): Promise<void> {
		/*********************************** 初始化 ***********************************/
		await this.initializeStateStore();
		this.initializeServices();

		/*********************************** 注册 ***********************************/
		this.registerInboxView();
		this.registerRibbonActions();
		this.registerCommands();
		this.registerSettings();

		/*********************************** 启动 ***********************************/
		this.startAutoConnectIfEnabled();

		logger.info("[BOOT] plugin loaded", { baseUrl: this.stateStore.settings.workerBaseUrl });
	}

	onunload(): void {
		this.pollingLoop.stop();
		this.inboxView = null;
	}

	/*********************************** 初始化 ***********************************/
	private async initializeStateStore(): Promise<void> {
		this.stateStore = new PluginStateStore(
			DEFAULT_SETTINGS,
			{ lastUpdateId: 0, processedMessageIds: [] },
			(data) => this.saveData(data),
			() => this.loadData(),
		);
		await this.stateStore.load();
	}

	private initializeServices(): void {
		const { settings, state } = this.stateStore;
		this.client = new FileHelperClient(settings.workerBaseUrl);
		this.writer = this.createWriter(settings);
		this.messageService = this.createMessageService(settings, state);
	}

	/*********************************** 注册 ***********************************/
	private registerInboxView(): void {
		this.registerView(
			WECHAT_INBOX_VIEW_TYPE,
			(leaf) => this.createInboxView(leaf),
		);
	}

	private registerRibbonActions(): void {
		this.addRibbonIcon("message-square", "微信文件传输助手", () =>
			void this.openInboxView(),
		);
	}

	private registerCommands(): void {
		this.addCommand({
			id: "open",
			name: "打开微信收件箱",
			callback: () => void this.openInboxView(),
		});
		this.addCommand({
			id: "refresh-qr",
			name: "刷新微信二维码",
			callback: () => void this.refreshQr(),
		});
		this.addCommand({
			id: "reprocess-pending",
			name: "重新拉取消息",
			callback: () => void this.reprocessPending(),
		});
		this.addCommand({
			id: "reprocess-all",
			name: "处理全部消息（清空已处理列表）",
			callback: () => void this.reprocessAll(),
		});
	}

	private registerSettings(): void {
		this.addSettingTab(new WeChatInboxSettingTab(this.app, this));
	}

	private startAutoConnectIfEnabled(): void {
		if (this.stateStore.settings.autoConnect) {
			this.startPolling();
		}
	}

	/*********************************** 服务装配 ***********************************/
	private createWriter(settings: WeChatInboxSettings): VaultWriter {
		return new VaultWriter({ vault: this.app.vault, settings });
	}

	private createMessageService(
		settings: WeChatInboxSettings,
		state = this.stateStore.state,
	): MessageService {
		return new MessageService({
			client: this.client,
			writer: this.writer,
			settings,
			state,
			saveState: () => this.saveState(),
			notifyStats: () => this.refreshStats(),
			onMessage: (entry) => this.recordMessage(entry),
		});
	}

	private createInboxView(leaf: WorkspaceLeaf): WeChatInboxView {
		const view = new WeChatInboxView(leaf);
		view.bind(this.getViewState(), this.getViewActions());
		this.inboxView = view;
		return view;
	}

	/*********************************** 轮询与连接 ***********************************/
	refreshServiceSettings(): void {
		const { settings, state } = this.stateStore;
		this.client?.updateBaseUrl(settings.workerBaseUrl);
		this.writer = this.createWriter(settings);
		this.messageService = this.createMessageService(settings, state);
	}

	startPolling(): void {
		this.pollingLoop.start(
			this.stateStore.settings.pollIntervalMs,
			() => this.tick(),
			() => this.refreshQr(),
		);
	}

	stopPolling(): void {
		this.pollingLoop.stop();
	}

	restartPolling(): void {
		this.stopPolling();
		if (this.stateStore.settings.autoConnect) this.startPolling();
	}

	private async tick(): Promise<void> {
		let status: LoginStatus | null = null;
		try {
			status = await this.client.getLoginStatus(false);
		} catch (err) {
			const message = await resolveWorkerError(err);
			this.updatePhase(derivePhase(null, message));
			return;
		}

		if (status.logged_in) {
			this.updatePhase(derivePhase(status, null));
			try {
				const result = await this.messageService.pollOnce();
				if (result.processed > 0 || result.skipped > 0) {
					logger.info(
						`[POLL] processed=${result.processed} skipped=${result.skipped} offset=${this.stateStore.state.lastUpdateId}`,
					);
				} else {
					logger.info(`[POLL] no new updates (offset=${this.stateStore.state.lastUpdateId})`);
				}
			} catch (err) {
				logger.warn("[POLL] pollOnce failed", err);
			}
		} else {
			this.updatePhase(derivePhase(status, null));
		}
	}

	private updatePhase(phase: ConnectionPhase): void {
		const previousKind = this.phase.kind;
		this.phase = phase;
		this.notifyView();
		if (phase.kind === "connected" && previousKind !== "connected") {
			void this.refreshStats();
		}
	}

	private async refreshQr(): Promise<void> {
		try {
			const png = await this.client.getQrPng();
			this.qrDataUrl = `data:image/png;base64,${bufferToBase64(png)}`;
			this.updatePhase(derivePhase({ logged_in: false, has_uuid: true }, null));
			logger.info("[QR] refreshed");
		} catch (err) {
			if (err instanceof HttpError && err.status === 200) {
				// Worker says "Already logged in".
				this.qrDataUrl = null;
				return;
			}
			this.qrDataUrl = null;
			logger.warn("[QR] refresh failed", err);
		}
		this.notifyView();
	}

	private async refreshStats(): Promise<void> {
		try {
			this.stats = await this.client.getStoreStats();
		} catch {
			this.stats = null;
		}
		this.notifyView();
	}

	/*********************************** 视图状态 ***********************************/
	private recordMessage(entry: MessageLogEntry): void {
		this.recentMessages.unshift(entry);
		if (this.recentMessages.length > RECENT_MESSAGE_LIMIT) {
			this.recentMessages.length = RECENT_MESSAGE_LIMIT;
		}
		this.notifyView();
	}

	private clearMessageLog(): void {
		this.recentMessages = [];
		this.notifyView();
	}

	private notifyView(): void {
		this.inboxView?.updateState(this.getViewState());
	}

	private getViewState(): InboxViewState {
		const settings = this.stateStore.settings;
		return {
			phase: this.phase,
			qrDataUrl: this.qrDataUrl,
			stats: this.stats,
			messages: this.recentMessages,
			inboxFolder: settings.inboxFolder,
			workerUrl: settings.workerBaseUrl,
			autoCreateMarkdown: settings.autoCreateMarkdown,
			lastError: this.messageService.getLastError(),
		};
	}

	private getViewActions(): ViewActions {
		return {
			refreshQr: () => void this.refreshQr(),
			reprocess: () => void this.reprocessPending(),
			reprocessAll: () => void this.reprocessAll(),
			openFolder: () => void this.openInboxFolder(),
			clearLog: () => this.clearMessageLog(),
		};
	}

	private async openInboxView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(WECHAT_INBOX_VIEW_TYPE);
		let leaf: WorkspaceLeaf | undefined = existing[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) {
				new Notice("无法创建收件箱视图：右侧面板不可用");
				return;
			}
			await right.setViewState({ type: WECHAT_INBOX_VIEW_TYPE, active: true });
			leaf = right;
		}
		void workspace.revealLeaf(leaf);
		const view = leaf.view as WeChatInboxView;
		view.bind(this.getViewState(), this.getViewActions());
		this.inboxView = view;
	}

	private async openInboxFolder(): Promise<void> {
		const { vault, workspace } = this.app;
		const folder = this.stateStore.settings.inboxFolder.trim() || DEFAULT_INBOX_FOLDER;
		const leaves = workspace.getLeavesOfType("file-explorer");
		const leaf = leaves[0];
		if (!leaf) {
			new Notice("找不到文件资源管理器。请先在 Obsidian 中打开文件浏览器。");
			return;
		}
		// revealInFolder is a no-op for paths that don't exist yet — create
		// the folder first so the user sees something.
		if (!vault.getAbstractFileByPath(folder)) {
			try {
				await vault.createFolder(folder);
			} catch (err) {
				if (!(err instanceof Error) || !/exists/i.test(err.message)) {
					throw err;
				}
			}
		}
		const view = leaf.view as unknown as {
			revealInFolder?: (path: string) => Promise<void> | void;
		};
		try {
			if (typeof view?.revealInFolder === "function") {
				await view.revealInFolder(folder);
			}
		} catch {
			// fall through to the notice below
		}
		new Notice(`收件箱目录: ${folder}`);
	}

	/*********************************** 状态重置 ***********************************/
	private async reprocessPending(): Promise<void> {
		this.stateStore.state.lastUpdateId = 0;
		await this.stateStore.save();
		new Notice("已重置轮询 offset，下次轮询将重新拉取 worker 中的消息");
		void this.tick();
	}

	private async reprocessAll(): Promise<void> {
		this.stateStore.state.lastUpdateId = 0;
		this.stateStore.state.processedMessageIds = [];
		await this.stateStore.save();
		new Notice("已清空已处理列表，将从最早的消息重新处理");
		void this.tick();
	}

	/*********************************** 持久化与 API ***********************************/
	async persistSettings(): Promise<void> {
		await this.stateStore.save();
	}

	private async saveState(): Promise<void> {
		await this.stateStore.save();
	}

	private getRecentMessages(limit = 100): PublicMessage[] {
		return this.recentMessages.slice(0, limit).map((entry) => ({
			receivedAt: entry.receivedAt,
			msgId: entry.msgId,
			updateId: entry.updateId,
			type: entry.type,
			text: entry.text,
			fileName: entry.fileName,
			status: entry.status,
			error: entry.error,
		}));
	}

	private getMessageIndexPath(): string {
		const base = this.stateStore.settings.inboxFolder.trim() || DEFAULT_INBOX_FOLDER;
		return `${base}/_system/message-index.md`;
	}
}
