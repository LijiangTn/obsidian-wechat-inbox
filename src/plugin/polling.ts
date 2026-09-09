import {
	MIN_POLL_INTERVAL_MS,
	QR_REFRESH_INTERVAL_MS,
} from "../constants";

/*********************************** 回调类型 ***********************************/
export type TickFn = () => Promise<void>;
export type QrRefreshFn = () => Promise<void>;

/*********************************** 轮询循环 ***********************************/
export class PollingLoop {
	private pollId: number | null = null;
	private qrId: number | null = null;

	/*********************************** 对外控制 ***********************************/
	start(intervalMs: number, tick: TickFn, qrRefresh: QrRefreshFn): void {
		if (this.pollId !== null) return;
		const interval = Math.max(MIN_POLL_INTERVAL_MS, intervalMs);
		this.pollId = window.setInterval(() => void tick(), interval);
		this.startQrRefresh(qrRefresh);
		void tick();
	}

	stop(): void {
		if (this.pollId !== null) {
			window.clearInterval(this.pollId);
			this.pollId = null;
		}
		this.stopQrRefresh();
	}

	get isRunning(): boolean {
		return this.pollId !== null;
	}

	/*********************************** 内部调度 ***********************************/
	private startQrRefresh(qrRefresh: QrRefreshFn): void {
		if (this.qrId !== null) return;
		this.qrId = window.setInterval(() => void qrRefresh(), QR_REFRESH_INTERVAL_MS);
		void qrRefresh();
	}

	private stopQrRefresh(): void {
		if (this.qrId !== null) {
			window.clearInterval(this.qrId);
			this.qrId = null;
		}
	}
}
