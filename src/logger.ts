import { LOGGER_TAG } from "./constants";

// All levels routed through console.debug to comply with the Obsidian
// plugin guideline that forbids console.log/warn/error. Output appears
// in Obsidian's developer console when "Verbose" log level is enabled.

type LogLevel = "INFO" | "WARN" | "ERROR";

/*********************************** 日志输出 ***********************************/
function emit(level: LogLevel, args: unknown[]): void {
	console.debug(`[${LOGGER_TAG}][${level}]`, ...args);
}

/*********************************** 日志接口 ***********************************/
export const logger = {
	info: (...args: unknown[]): void => emit("INFO", args),
	warn: (...args: unknown[]): void => emit("WARN", args),
	error: (...args: unknown[]): void => emit("ERROR", args),
};
