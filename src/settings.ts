import { App, PluginSettingTab, Setting } from "obsidian";
import type WeChatInboxPlugin from "./main";
import {
	DEFAULT_ATTACHMENT_FOLDER,
	DEFAULT_INBOX_FOLDER,
	DEFAULT_POLL_INTERVAL_MS,
	DEFAULT_WORKER_BASE_URL,
	MIN_POLL_INTERVAL_MS,
} from "./constants";

/*********************************** 设置面板 ***********************************/
export class WeChatInboxSettingTab extends PluginSettingTab {
	plugin: WeChatInboxPlugin;

	constructor(app: App, plugin: WeChatInboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

        getControlValue(key: string): unknown {
                return this.plugin.settings[key as keyof typeof this.plugin.settings];
        }

        async setControlValue(key: string, value: unknown): Promise<void> {
                switch (key) {
                        case "workerBaseUrl":
                                this.plugin.settings.workerBaseUrl =
                                        String(value).trim() || DEFAULT_WORKER_BASE_URL;
                                await this.plugin.persistSettings();
                                this.plugin.refreshServiceSettings();
                                return;
                        case "inboxFolder":
                                this.plugin.settings.inboxFolder =
                                        String(value).trim() || DEFAULT_INBOX_FOLDER;
                                await this.plugin.persistSettings();
                                return;
                        case "attachmentFolder":
                                this.plugin.settings.attachmentFolder =
                                        String(value).trim() || DEFAULT_ATTACHMENT_FOLDER;
                                await this.plugin.persistSettings();
                                return;
                        case "autoDateFolders":
                                this.plugin.settings.autoDateFolders = Boolean(value);
                                await this.plugin.persistSettings();
                                return;
                        case "autoCreateMarkdown":
                                this.plugin.settings.autoCreateMarkdown = Boolean(value);
                                await this.plugin.persistSettings();
                                this.plugin.refreshServiceSettings();
                                return;
                        case "autoConnect":
                                this.plugin.settings.autoConnect = Boolean(value);
                                await this.plugin.persistSettings();
                                if (this.plugin.settings.autoConnect) {
                                        this.plugin.startPolling();
                                } else {
                                        this.plugin.stopPolling();
                                }
                                return;
                        case "pollIntervalMs": {
                                const parsed =
                                        typeof value === "number"
                                                ? value
                                                : Number.parseInt(String(value), 10);
                                this.plugin.settings.pollIntervalMs =
                                        Number.isFinite(parsed) && parsed >= MIN_POLL_INTERVAL_MS
                                                ? parsed
                                                : DEFAULT_POLL_INTERVAL_MS;
                                await this.plugin.persistSettings();
                                this.plugin.restartPolling();
                                return;
                        }
                        default:
                                return;
                }
        }

        getSettingDefinitions(): unknown[] {
                return [
                        {
                                type: "group",
                                heading: "连接设置",
                                items: [
                                        {
                                                name: "Worker 地址",
                                                desc: "Wx-filehelper-api 监听的 HTTP 地址",
                                                control: {
                                                        type: "text",
                                                        key: "workerBaseUrl",
                                                        placeholder: DEFAULT_WORKER_BASE_URL,
                                                },
                                        },
                                ],
                        },
                        {
                                type: "group",
                                heading: "保存设置",
                                items: [
                                        {
                                                name: "知识库目录",
                                                desc: "收件箱根目录（vault 相对路径）",
                                                control: {
                                                        type: "text",
                                                        key: "inboxFolder",
                                                        placeholder: DEFAULT_INBOX_FOLDER,
                                                },
                                        },
                                        {
                                                name: "附件目录",
                                                desc: "当日日期目录下的附件子目录名",
                                                control: {
                                                        type: "text",
                                                        key: "attachmentFolder",
                                                        placeholder: DEFAULT_ATTACHMENT_FOLDER,
                                                },
                                        },
                                        {
                                                name: "按日期分层",
                                                desc: "按 年/月/日 拆分收件箱目录",
                                                control: {
                                                        type: "toggle",
                                                        key: "autoDateFolders",
                                                },
                                        },
                                ],
                        },
                        {
                                type: "group",
                                heading: "同步行为",
                                items: [
                                        {
                                                name: "自动写入 Markdown",
                                                desc: "收到消息时立即写入 vault。关闭后只同步 offset、不写文件",
                                                control: {
                                                        type: "toggle",
                                                        key: "autoCreateMarkdown",
                                                },
                                        },
                                        {
                                                name: "启动 Obsidian 时自动连接",
                                                desc: "插件加载后立即开始轮询",
                                                control: {
                                                        type: "toggle",
                                                        key: "autoConnect",
                                                },
                                        },
                                        {
                                                name: "轮询间隔 (毫秒)",
                                                desc: "向 worker 拉取更新的间隔",
                                                control: {
                                                        type: "number",
                                                        key: "pollIntervalMs",
                                                        min: MIN_POLL_INTERVAL_MS,
                                                        defaultValue: DEFAULT_POLL_INTERVAL_MS,
                                                },
                                        },
                                ],
                        },
                ];
        }

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		/*********************************** 连接设置 ***********************************/
		new Setting(containerEl).setName("连接设置").setHeading();

		new Setting(containerEl)
			.setName("Worker 地址")
                        .setDesc("Wx-filehelper-api 监听的 HTTP 地址")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_WORKER_BASE_URL)
					.setValue(this.plugin.settings.workerBaseUrl)
					.onChange(async (value) => {
						const trimmed = value.trim();
						this.plugin.settings.workerBaseUrl = trimmed || DEFAULT_WORKER_BASE_URL;
						await this.plugin.persistSettings();
						this.plugin.refreshServiceSettings();
					}),
			);

		/*********************************** 保存设置 ***********************************/
		new Setting(containerEl).setName("保存设置").setHeading();

		new Setting(containerEl)
			.setName("知识库目录")
                        .setDesc("收件箱根目录（vault 相对路径）")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_INBOX_FOLDER)
					.setValue(this.plugin.settings.inboxFolder)
					.onChange(async (value) => {
						this.plugin.settings.inboxFolder = value.trim() || DEFAULT_INBOX_FOLDER;
						await this.plugin.persistSettings();
					}),
			);

		new Setting(containerEl)
			.setName("附件目录")
			.setDesc("当日日期目录下的附件子目录名")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_ATTACHMENT_FOLDER)
					.setValue(this.plugin.settings.attachmentFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentFolder = value.trim() || DEFAULT_ATTACHMENT_FOLDER;
						await this.plugin.persistSettings();
					}),
			);

		new Setting(containerEl)
			.setName("按日期分层")
			.setDesc("按 年/月/日 拆分收件箱目录")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoDateFolders)
					.onChange(async (value) => {
						this.plugin.settings.autoDateFolders = value;
						await this.plugin.persistSettings();
					}),
			);

		/*********************************** 同步行为 ***********************************/
		new Setting(containerEl)
			.setName("自动写入 Markdown")
                        .setDesc("收到消息时立即写入 vault。关闭后只同步 offset、不写文件")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateMarkdown)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateMarkdown = value;
						await this.plugin.persistSettings();
						this.plugin.refreshServiceSettings();
					}),
			);

		new Setting(containerEl)
			.setName("启动 Obsidian 时自动连接")
			.setDesc("插件加载后立即开始轮询")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoConnect)
					.onChange(async (value) => {
						this.plugin.settings.autoConnect = value;
						await this.plugin.persistSettings();
						if (value) {
							this.plugin.startPolling();
						} else {
							this.plugin.stopPolling();
						}
					}),
			);

		new Setting(containerEl)
			.setName("轮询间隔 (毫秒)")
                        .setDesc("向 worker 拉取更新的间隔")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_POLL_INTERVAL_MS))
					.setValue(String(this.plugin.settings.pollIntervalMs))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.pollIntervalMs =
							Number.isFinite(parsed) && parsed >= MIN_POLL_INTERVAL_MS
								? parsed
								: DEFAULT_POLL_INTERVAL_MS;
						await this.plugin.persistSettings();
						this.plugin.restartPolling();
					}),
			);
	}
}
