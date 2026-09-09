import type { InboxViewState, ViewActions } from "./InboxView";
import { MAX_RENDERED_MESSAGES } from "../constants";
import type { MessageLogEntry } from "../types";

/*********************************** 过滤类型 ***********************************/
type Filter = "all" | "text" | "image" | "file";

/*********************************** 视图总装 ***********************************/
export function renderViewBody(
	root: HTMLElement,
	state: InboxViewState,
        actions: ViewActions,
	activeFilter: Filter,
	onFilterChange: (f: Filter) => void,
): void {
	renderHeader(root, state);
        renderActions(root, state, actions);
	if (state.phase.kind === "connected") {
		renderMessages(root, state, activeFilter, onFilterChange);
	} else {
		renderQr(root, state);
	}
	renderFooter(root, state);
}

/*********************************** 顶部区域 ***********************************/
function renderHeader(root: HTMLElement, state: InboxViewState): void {
	const header = root.createDiv({ cls: "wechat-inbox-view-header" });
	const statusEl = header.createDiv({ cls: "wechat-inbox-status" });
	const dot = statusEl.createDiv({ cls: "wechat-inbox-dot" });
	const text = statusEl.createDiv();

	switch (state.phase.kind) {
		case "connected":
			dot.addClass("connected");
			text.setText("已连接 · 文件传输助手在线");
			break;
		case "waiting_qr":
			dot.addClass("disconnected");
			text.setText("等待扫码…");
			break;
		case "scanned":
			dot.addClass("scanning");
			text.setText("已扫码，请在手机上点击「登录」");
			break;
		case "disconnected":
			dot.addClass("disconnected");
			text.setText(`未连接 · ${state.phase.reason}`);
			break;
		case "error":
			dot.addClass("error");
			text.setText("出错");
			break;
	}

	if (state.stats) {
		const meta = statusEl.createDiv({ cls: "wechat-inbox-status-meta" });
		const today = state.stats.today_message_count ?? 0;
		const total = state.stats.message_count;
		meta.setText(total !== undefined ? `今天 ${today} · 累计 ${total}` : `今天 ${today}`);
	}

	if (!state.autoCreateMarkdown) {
		header.createDiv({
			cls: "wechat-inbox-warn",
			text: "⚠ 自动写入 Markdown 已关闭（Settings → WeChat Inbox）",
		});
	}
	if (state.lastError) {
		header.createDiv({
			cls: "wechat-inbox-error",
			text: `错误: ${state.lastError}`,
		});
	}
}

/*********************************** 二维码区域 ***********************************/
function renderQr(root: HTMLElement, state: InboxViewState): void {
	const container = root.createDiv({ cls: "wechat-inbox-qr-container" });
	if (state.qrDataUrl) {
		const img = container.createEl("img", { cls: "wechat-inbox-qr" });
		img.src = state.qrDataUrl;
	} else {
		container.createDiv({
			cls: "wechat-inbox-qr wechat-inbox-qr-status",
			text: "二维码加载中…",
		});
	}
	container.createDiv({
		cls: "wechat-inbox-qr-status",
		text: "请使用微信扫一扫登录「文件传输助手」",
	});
}

/*********************************** 操作区域 ***********************************/
function renderActions(
        root: HTMLElement,
        state: InboxViewState,
        actions: ViewActions,
): void {
        const container = root.createDiv({ cls: "wechat-inbox-actions" });
        const buttons = state.phase.kind === "connected"
                ? [
                        { label: "打开收件箱", onClick: actions.openFolder },
                        { label: "重新拉取", onClick: actions.reprocess },
                        { label: "处理全部", onClick: actions.reprocessAll },
                        { label: "清空日志", onClick: actions.clearLog },
                ]
                : [
                        { label: "刷新二维码", onClick: actions.refreshQr },
                        { label: "清空日志", onClick: actions.clearLog },
                ];

        for (const button of buttons) {
                const el = container.createEl("button", {
                        cls: "wechat-inbox-action-button",
                        text: button.label,
                });
                el.addEventListener("click", () => button.onClick());
        }
}

/*********************************** 消息区域 ***********************************/
function renderMessages(
	root: HTMLElement,
	state: InboxViewState,
	activeFilter: Filter,
	onFilterChange: (f: Filter) => void,
): void {
	const container = root.createDiv({ cls: "wechat-inbox-messages" });
	renderMessagesHeader(container, state, activeFilter, onFilterChange);

	const filtered = activeFilter === "all"
		? state.messages
		: state.messages.filter((m) => m.type === activeFilter);

	if (filtered.length === 0) {
		container.createDiv({
			cls: "wechat-inbox-empty",
			text: state.messages.length === 0
				? "暂无消息。请在微信文件传输助手中发送内容。"
				: "当前筛选下没有消息。",
		});
		return;
	}

	const list = container.createDiv({ cls: "wechat-inbox-messages-list" });
	for (const entry of filtered.slice(0, MAX_RENDERED_MESSAGES)) {
		renderMessageEntry(list, entry);
	}
	if (filtered.length > MAX_RENDERED_MESSAGES) {
		list.createDiv({
			cls: "wechat-inbox-messages-overflow",
			text: `还有 ${filtered.length - MAX_RENDERED_MESSAGES} 条更早的消息被折叠`,
		});
	}
}

function renderMessagesHeader(
	container: HTMLElement,
	state: InboxViewState,
	activeFilter: Filter,
	onFilterChange: (f: Filter) => void,
): void {
	const header = container.createDiv({ cls: "wechat-inbox-messages-header" });
	header.createDiv({
		cls: "wechat-inbox-messages-title",
		text: `消息日志 (${state.messages.length})`,
	});

	const filters = header.createDiv({ cls: "wechat-inbox-filters" });
	const filterDefs: { key: Filter; label: string }[] = [
		{ key: "all", label: "全部" },
		{ key: "text", label: "文字" },
		{ key: "image", label: "图片" },
		{ key: "file", label: "文件" },
	];
	for (const f of filterDefs) {
		const btn = filters.createEl("button", {
			text: f.label,
			cls: activeFilter === f.key
				? "wechat-inbox-filter wechat-inbox-filter-active"
				: "wechat-inbox-filter",
		});
		btn.addEventListener("click", () => onFilterChange(f.key));
	}
}

function renderMessageEntry(list: HTMLElement, entry: MessageLogEntry): void {
	const item = list.createDiv({
		cls: `wechat-inbox-message wechat-inbox-message-${entry.status}`,
	});

	const head = item.createDiv({ cls: "wechat-inbox-message-head" });
	head.createDiv({ cls: "wechat-inbox-message-icon", text: typeIcon(entry.type) });

	const time = new Date(entry.receivedAt);
	head.createDiv({
		cls: "wechat-inbox-message-time",
		text: `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`,
	});

	head.createDiv({
		cls: "wechat-inbox-message-status",
		text: statusLabel(entry.status),
	});

	const body = item.createDiv({ cls: "wechat-inbox-message-body" });
	if (entry.type === "text") {
		body.setText(entry.text || "(空)");
	} else if (entry.fileName) {
		body.setText(entry.fileName);
	} else {
		body.setText(`[${entry.type}]`);
	}

	if (entry.error) {
		item.createDiv({
			cls: "wechat-inbox-message-error",
			text: entry.error,
		});
	}

	const meta = item.createDiv({ cls: "wechat-inbox-message-meta" });
	meta.setText(`update_id=${entry.updateId}${entry.msgId ? ` · msg_id=${entry.msgId}` : ""}`);
}

/*********************************** 底部区域 ***********************************/
function renderFooter(root: HTMLElement, state: InboxViewState): void {
	const footer = root.createDiv({ cls: "wechat-inbox-footer" });
	footer.createDiv({
		cls: "wechat-inbox-footer-row",
		text: `Worker: ${state.workerUrl}`,
	});
	footer.createDiv({
		cls: "wechat-inbox-footer-row",
		text: `收件箱: ${state.inboxFolder}`,
	});
	footer.createDiv({
		cls: "wechat-inbox-footer-tip",
		text: "调试日志：View → Toggle Developer Tools → Console（Verbose 级别）",
	});
}

/*********************************** 显示工具 ***********************************/
function typeIcon(type: string): string {
	switch (type) {
		case "text": return "📝";
		case "image": return "🖼️";
		case "file": return "📎";
		default: return "❓";
	}
}

function statusLabel(status: MessageLogEntry["status"]): string {
	switch (status) {
		case "received": return "已接收";
		case "processed": return "✓ 已写入";
		case "skipped": return "跳过";
		case "error": return "⚠ 失败";
	}
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}
