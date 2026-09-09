import type { ConnectionPhase, LoginStatus } from "../types";

/*********************************** 输入类型 ***********************************/
export type LoginStatusLike = LoginStatus | { logged_in: boolean; has_uuid: boolean };

/*********************************** 状态推导 ***********************************/
export function derivePhase(
	status: LoginStatusLike | null,
	lastError: string | null,
): ConnectionPhase {
	if (lastError) return { kind: "error", message: lastError };
	if (!status) return { kind: "disconnected", reason: "worker unreachable" };
	if (status.logged_in) return { kind: "connected" };
	const fullStatus = status as LoginStatus;
	if (fullStatus.status === "scanned_wait_confirm") {
		return {
			kind: "scanned",
			status: "scanned_wait_confirm",
		};
	}
	if (status.has_uuid) {
		return {
			kind: "waiting_qr",
			uuidAgeSeconds: fullStatus.uuid_age_seconds ?? null,
		};
	}
	return {
		kind: "disconnected",
		reason: fullStatus.status ?? "idle",
	};
}
