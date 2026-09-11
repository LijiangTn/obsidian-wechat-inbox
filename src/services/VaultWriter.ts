import { normalizePath, TFile, Vault } from "obsidian";
import type { FileHelperClient } from "../client";
import {
	DEFAULT_INBOX_FOLDER,
	INVALID_FILENAME_CHARS,
} from "../constants";
import type { UpdateMessage, WeChatInboxSettings } from "../types";

/*********************************** 依赖与附件 ***********************************/
export interface VaultWriterDeps {
	vault: Vault;
	settings: WeChatInboxSettings;
}

export interface AttachmentInfo {
	fileName: string;
	originalName: string;
}

/*********************************** Vault 写入服务 ***********************************/
export class VaultWriter {
	private deps: VaultWriterDeps;

	constructor(deps: VaultWriterDeps) {
		this.deps = deps;
	}

        /*********************************** 路径计算 ***********************************/
	private inboxBase(): string {
		return this.deps.settings.inboxFolder.trim() || DEFAULT_INBOX_FOLDER;
	}

	private yyyymmdd(date: Date): { yyyy: string; mm: string; dd: string; key: string } {
		const yyyy = String(date.getFullYear());
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		const dd = String(date.getDate()).padStart(2, "0");
		return { yyyy, mm, dd, key: `${yyyy}-${mm}-${dd}` };
	}

	private formatTime(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
	}

	private dayFolder(date: Date): string {
		const { yyyy, mm, dd } = this.yyyymmdd(date);
		const base = this.inboxBase();
		return this.deps.settings.autoDateFolders
			? [base, yyyy, mm, dd].join("/")
			: base;
	}

	private dayFilePath(date: Date): string {
		return `${this.dayFolder(date)}/${this.yyyymmdd(date).key}.md`;
	}

	private dayAttachmentFolder(date: Date): string {
		return `${this.dayFolder(date)}/attachments`;
	}

	private indexPath(): string {
		return `${this.inboxBase()}/_system/message-index.md`;
	}

	/*********************************** Markdown 写入 ***********************************/
	async appendToDailyInbox(
		message: UpdateMessage,
		updateId: number,
		attachment?: AttachmentInfo,
	): Promise<string> {
		const date = new Date(message.date * 1000);
		const notePath = this.dayFilePath(date);
		const folder = notePath.split("/").slice(0, -1).join("/");
		await this.ensureFolder(folder);

		const existing = await this.readDayFile(date);
		const newCount = (existing?.count ?? 0) + 1;
		const section = this.buildSection(date, message, attachment);

		// updateFrontmatterCount returns the full content (frontmatter +
		// body) with count replaced — append the section directly to avoid
		// duplicating the body on every poll.
		const content = existing
			? updateFrontmatterCount(existing.content, newCount) + section
			: buildInitialContent(this.yyyymmdd(date).key, newCount) + section;

		if (existing) {
			await this.deps.vault.modify(existing.file, content);
		} else {
			await this.deps.vault.create(notePath, content);
		}
		return notePath;
	}

	/*********************************** 附件写入 ***********************************/
	async saveAttachment(
		message: UpdateMessage,
		client: FileHelperClient,
	): Promise<AttachmentInfo | null> {
		if (message.type !== "file" && message.type !== "image") return null;
		const originalName = message.document?.file_name;
		if (!originalName) return null;

		const date = new Date(message.date * 1000);
		const folder = this.dayAttachmentFolder(date);
		await this.ensureFolder(folder);

		const meta = await client.getFile(message.message_id);
		const rel = deriveRelativePath(meta.file_path, originalName);
		const buffer = await client.downloadStatic(rel);

		const safeName = sanitizeFileName(originalName);
		const vaultPath = `${folder}/${safeName}`;
		await this.writeBinary(vaultPath, buffer);

		return { fileName: safeName, originalName };
	}

	/*********************************** 索引写入 ***********************************/
	async appendToMessageIndex(
		message: UpdateMessage,
		updateId: number,
		dayFileName: string,
	): Promise<void> {
		const path = this.indexPath();
		const folder = path.split("/").slice(0, -1).join("/");
		await this.ensureFolder(folder);

		const row = this.buildIndexRow(message, updateId, dayFileName);
		const existing = this.deps.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			const content = await this.deps.vault.read(existing);
			const sep = content.endsWith("\n") ? "" : "\n";
			await this.deps.vault.modify(existing, content + sep + row);
		} else {
			await this.deps.vault.create(path, buildInitialIndex() + row);
		}
	}

	/*********************************** 内容构建 ***********************************/
	private buildSection(
		date: Date,
		message: UpdateMessage,
		attachment?: AttachmentInfo,
	): string {
		const time = this.formatTime(date);
		let body: string;
		if (message.type === "image" && attachment) {
			body = `![[attachments/${attachment.fileName}]]\n`;
		} else if (message.type === "file" && attachment) {
			body = `[📎 ${attachment.fileName}](attachments/${attachment.fileName})\n`;
		} else {
			const text = (message.text ?? "").trimEnd();
			body = text.length > 0 ? `${text}\n` : "(空)\n";
		}
		return `## ${time}\n\n${body}\n\n---\n\n`;
	}

	private buildIndexRow(
		message: UpdateMessage,
		updateId: number,
		dayFileName: string,
	): string {
		const date = new Date(message.date * 1000);
		const time = this.formatTime(date);
		return `| ${time} | [[${dayFileName}]] | ${message.message_id} | ${updateId} | ${message.type} |\n`;
	}

	/*********************************** Vault 辅助 ***********************************/
	private async readDayFile(date: Date): Promise<DayFileState | null> {
		const path = this.dayFilePath(date);
		const file = this.deps.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		const content = await this.deps.vault.read(file);
		return { path, file, content, count: extractMessageCount(content) };
	}

	private async ensureFolder(path: string): Promise<void> {
		const { vault } = this.deps;
		const normalized = normalizePath(path);
		if (normalized === "" || normalized === "/") return;
		const existing = vault.getAbstractFileByPath(normalized);
		if (existing) return;
		const parent = normalized.split("/").slice(0, -1).join("/");
		if (parent && parent !== normalized) {
			await this.ensureFolder(parent);
		}
		try {
			await vault.createFolder(normalized);
		} catch (err) {
			if (!(err instanceof Error) || !/exists/i.test(err.message)) {
				throw err;
			}
		}
	}

	private async writeBinary(path: string, buffer: ArrayBuffer): Promise<void> {
		const { vault } = this.deps;
		const normalized = normalizePath(path);
		const folder = normalized.split("/").slice(0, -1).join("/");
		await this.ensureFolder(folder);

		const existing = vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFile) {
			await vault.modifyBinary(existing, buffer);
			return;
		}
		await vault.createBinary(normalized, buffer);
	}
}

/*********************************** 内部数据结构 ***********************************/
interface DayFileState {
	path: string;
	file: TFile;
	content: string;
	count: number;
}

/*********************************** 纯函数工具 ***********************************/
function extractMessageCount(content: string): number {
	const m = content.match(/^message_count:\s*(\d+)/m);
	if (m && m[1] !== undefined) {
		const n = parseInt(m[1], 10);
		return Number.isNaN(n) ? 0 : n;
	}
	return 0;
}

function updateFrontmatterCount(content: string, newCount: number): string {
	if (/^message_count:\s*\d+/m.test(content)) {
		return content.replace(/^message_count:\s*\d+/m, `message_count: ${newCount}`);
	}
	return content.replace(/^---\n/, `---\nmessage_count: ${newCount}\n`);
}

function buildInitialContent(key: string, count: number): string {
	return [
		"---",
		"source: wechat",
		"type: inbox",
		`date: ${key}`,
		`message_count: ${count}`,
		"---",
		"",
		`# 微信收集箱 ｜ ${key}`,
		"",
	].join("\n");
}

function buildInitialIndex(): string {
	return [
		"# 微信收集箱 ｜ 消息索引",
		"",
		"| 时间 | 日期文件 | Message ID | Update ID | 类型 |",
		"|---|---|---|---|---|",
		"",
	].join("\n");
}

function sanitizeFileName(name: string): string {
	const cleaned = name.replace(INVALID_FILENAME_CHARS, "_");
	return cleaned.slice(0, 200) || "file";
}

function deriveRelativePath(storedPath: string, fallbackName: string): string {
	const normalized = storedPath.replace(/\\/g, "/");
        if (normalized && !/^(?:[A-Za-z]:\/|\/)/.test(normalized)) {
                return normalized
                        .replace(/^\/+/, "")
                        .replace(/^storage\/+/, "");
        }
	const idx = normalized.lastIndexOf("downloads/");
        if (idx >= 0) {
                return normalized.slice(idx + "downloads/".length);
        }
        const storageMatch = normalized.match(/(?:^|\/)storage\/(.+)$/);
        if (storageMatch?.[1]) {
                return storageMatch[1];
        }
        return fallbackName;
}
