import type { ConnectionPhase, LoginStatus } from "../types";

/*********************************** 输入类型 ***********************************/
export type LoginStatusLike = LoginStatus | { logged_in: boolean; has_uuid: boolean };

/*********************************** 状态推导 ***********************************/
// 把 LoginStatus 折叠成 5 种 UI 状态。
// weave 的 LoginStatus 字段比旧版多 (state / has_auth / message / last_error 等),
// 优先用顶层语义字段 logged_in / has_uuid,其余字段只是参考。
export function derivePhase(
	status: LoginStatusLike | null,
	lastError: string | null,
): ConnectionPhase {
	if (lastError) return { kind: "error", message: lastError };
	if (!status) return { kind: "disconnected", reason: "worker unreachable" };
	if (status.logged_in) return { kind: "connected" };
	const fullStatus = status as LoginStatus;
	// weave 状态字符串:`scanned_wait_confirm` 仍由 status 字段表达;
	// `state` 字段如果为 "scanned" 也视为扫码待确认。
	if (fullStatus.status === "scanned_wait_confirm" || fullStatus.state === "scanned") {
		return { kind: "scanned", status: "scanned_wait_confirm" };
	}
	if (status.has_uuid) {
		return {
			kind: "waiting_qr",
			uuidAgeSeconds: fullStatus.uuid_age_seconds ?? null,
		};
	}
	return {
		kind: "disconnected",
		reason: fullStatus.status ?? fullStatus.state ?? "idle",
	};
}
