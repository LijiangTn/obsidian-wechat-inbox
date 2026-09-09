import { requestUrl, RequestUrlParam } from "obsidian";
import { BASE64_CHUNK_SIZE } from "./constants";
import {
	FileMetaResult,
	LoginStatus,
	StoreStats,
	Update,
} from "./types";
import { logger } from "./logger";

/*********************************** HTTP 错误 ***********************************/
export class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = "HttpError";
	}
}

/*********************************** Worker 客户端 ***********************************/
export class FileHelperClient {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = stripTrailingSlash(baseUrl);
	}

	updateBaseUrl(baseUrl: string): void {
		this.baseUrl = stripTrailingSlash(baseUrl);
	}

	/*********************************** 登录与轮询 ***********************************/
	async getLoginStatus(autoPoll: boolean): Promise<LoginStatus> {
		return this.requestJson<LoginStatus>(
			`/login/status?auto_poll=${autoPoll ? "true" : "false"}`,
		);
	}

	async getQrPng(): Promise<ArrayBuffer> {
		const response = await requestUrl({
			url: `${this.baseUrl}/qr`,
			method: "GET",
			throw: false,
		});
		if (response.status === 200 && response.headers?.["content-type"]?.startsWith("image/png")) {
			return response.arrayBuffer;
		}
		throw new HttpError(response.status, response.text ?? "QR unavailable");
	}

	/*********************************** 消息与文件 ***********************************/
	async getUpdates(offset: number, limit = 50): Promise<Update[]> {
		const resp = await this.requestJson<{ ok: boolean; result: Update[] }>(
			`/bot/getUpdates?offset=${offset}&limit=${limit}`,
		);
		return resp.ok ? resp.result ?? [] : [];
	}

	async getFile(fileId: string): Promise<FileMetaResult> {
		const resp = await this.requestJson<{ ok: boolean; result: FileMetaResult }>(
			`/bot/getFile?file_id=${encodeURIComponent(fileId)}`,
		);
		if (!resp.ok || !resp.result) {
			throw new HttpError(404, "File metadata missing");
		}
		return resp.result;
	}

	async getStoreStats(): Promise<StoreStats> {
		try {
			return await this.requestJson<StoreStats>("/store/stats");
		} catch (err) {
			logger.warn("store stats failed", err);
			return {};
		}
	}

	async downloadStatic(relPath: string): Promise<ArrayBuffer> {
		const safe = relPath.replace(/^\/+/, "");
		return this.requestBinary(`/static/${safe}`);
	}

	/*********************************** 底层请求 ***********************************/
	private async requestJson<T>(
		path: string,
		init?: { method?: "GET" | "POST"; body?: unknown },
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const param: RequestUrlParam = {
			url,
			method: init?.method ?? "GET",
			throw: false,
		};
		if (init?.body !== undefined) {
			param.body = JSON.stringify(init.body);
			param.headers = { "Content-Type": "application/json" };
		}

		let response;
		try {
			response = await requestUrl(param);
		} catch (err) {
			throw new HttpError(0, `Network error: ${String(err)}`);
		}

		if (response.status < 200 || response.status >= 300) {
			throw new HttpError(response.status, `${response.status} ${path}`);
		}

		try {
			return response.json as T;
		} catch (err) {
			throw new HttpError(response.status, `Invalid JSON: ${String(err)}`);
		}
	}

	private async requestBinary(path: string): Promise<ArrayBuffer> {
		const response = await requestUrl({
			url: `${this.baseUrl}${path}`,
			method: "GET",
			throw: false,
		});
		if (response.status < 200 || response.status >= 300) {
			throw new HttpError(response.status, `${response.status} ${path}`);
		}
		return response.arrayBuffer;
	}
}

/*********************************** 工具函数 ***********************************/
function stripTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}

export function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i += BASE64_CHUNK_SIZE) {
		const slice = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
		binary += String.fromCharCode.apply(null, Array.from(slice));
	}
	return btoa(binary);
}
