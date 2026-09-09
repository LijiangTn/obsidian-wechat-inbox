import { HttpError } from "./client";

/*********************************** Worker 错误解析 ***********************************/
export async function resolveWorkerError(err: unknown): Promise<string> {
	if (err instanceof HttpError) {
		if (err.status === 0) return "Worker not reachable. Is wx-filehelper-api running?";
		if (err.status === 401) return "Worker reports unauthorized.";
		return `Worker error: ${err.message}`;
	}
	return `Unexpected error: ${String(err)}`;
}
