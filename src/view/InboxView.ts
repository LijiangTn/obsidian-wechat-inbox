import { ItemView, WorkspaceLeaf } from "obsidian";
import { WECHAT_INBOX_VIEW_TYPE } from "../constants";
import type {
	ConnectionPhase,
	MessageLogEntry,
	StoreStats,
} from "../types";
import { renderViewBody } from "./render";

/*********************************** 视图状态 ***********************************/
export interface InboxViewState {
	phase: ConnectionPhase;
	qrDataUrl: string | null;
	stats: StoreStats | null;
	messages: MessageLogEntry[];
	inboxFolder: string;
	workerUrl: string;
	autoCreateMarkdown: boolean;
	lastError: string | null;
}

/*********************************** 视图动作 ***********************************/
export interface ViewActions {
	refreshQr: () => void;
	reprocess: () => void;
	reprocessAll: () => void;
	openFolder: () => void;
	clearLog: () => void;
}

type Filter = "all" | "text" | "image" | "file";

/*********************************** 侧栏视图 ***********************************/
export class WeChatInboxView extends ItemView {
	private state: InboxViewState | null = null;
	private actions: ViewActions | null = null;
	private activeFilter: Filter = "all";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

		/*********************************** 基础信息 ***********************************/
	getViewType(): string {
		return WECHAT_INBOX_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "微信收件箱";
	}

	getIcon(): string {
		return "message-square";
	}

	/*********************************** 状态绑定 ***********************************/
	bind(state: InboxViewState, actions: ViewActions): void {
		this.state = state;
		this.actions = actions;
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		// Real state lives on the plugin; nothing to release here.
	}

		/*********************************** 渲染 ***********************************/
	updateState(state: InboxViewState): void {
		this.state = state;
		this.render();
	}

	private render(): void {
		if (!this.state || !this.actions) return;
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("wechat-inbox-view-content");
                renderViewBody(root, this.state, this.actions, this.activeFilter, (next) => {
			this.activeFilter = next;
			this.render();
		});
	}
}
