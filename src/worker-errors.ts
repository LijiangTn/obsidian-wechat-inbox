import { HttpError } from "./client";

/*********************************** Worker 错误解析 ***********************************/
export async function resolveWorkerError(err: unknown): Promise<string> {
	if (err instanceof HttpError) {
                if (err.status === 0) return "Local sync service not reachable.";
                if (err.status === 401) return "Local sync service reports unauthorized.";
                return `Sync service error: ${err.message}`;
	}
	return `Unexpected error: ${String(err)}`;
}
