import {
	DEFAULT_SETTINGS,
	PROCESSED_IDS_LOAD_LIMIT,
} from "../constants";
import type { PersistedState, WeChatInboxSettings } from "../types";

/*********************************** 状态存储 ***********************************/
export class PluginStateStore {
	settings: WeChatInboxSettings;
	state: PersistedState;
	private saveData: (data: unknown) => Promise<void>;
	private loadData: () => Promise<unknown>;

	constructor(
		settings: WeChatInboxSettings,
		state: PersistedState,
		saveData: (data: unknown) => Promise<void>,
		loadData: () => Promise<unknown>,
	) {
		this.settings = settings;
		this.state = state;
		this.saveData = saveData;
		this.loadData = loadData;
	}

	/*********************************** 生命周期 ***********************************/
	async load(): Promise<void> {
		const raw = (await this.loadData()) as
			| (Partial<WeChatInboxSettings> & { state?: PersistedState })
			| null;
		const { state: _ignoredState, ...rawSettings } = raw ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, rawSettings);

		const persisted = raw?.state;
		this.state = {
			lastUpdateId: persisted?.lastUpdateId ?? 0,
			processedMessageIds: Array.isArray(persisted?.processedMessageIds)
				? persisted.processedMessageIds.slice(-PROCESSED_IDS_LOAD_LIMIT)
				: [],
		};
	}

	async save(): Promise<void> {
		await this.saveData({ ...this.settings, state: this.state });
	}
}
