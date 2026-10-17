// Vendored from earendil-works/pi v1.3.0 (commit 71023aec1546d6d677a65669c5665c0927ce0dd0),
// packages/coding-agent/src/core/extensions/types.ts, MIT licence. The blocks below are
// copied verbatim; only the imports are rewritten to the package's public exports.
//
// Only the events Engram intercepts are kept. test/vendor-types.test.ts fails `make lint`
// if the installed pi declares any of them differently: update this copy in the PR that
// moves the pin, and log what changed.
import type {
	BashOperations,
	BashToolInput,
	ContextEvent as PiContextEvent,
	UserBashEventResult as PiUserBashEventResult,
} from "@earendil-works/pi-coding-agent";

/** Not exported by the package; derived from exported declarations. */
export type AgentMessage = PiContextEvent["messages"][number];
/** Not exported by the package; derived from exported declarations. */
export type BashResult = Extract<PiUserBashEventResult, { result: unknown }>["result"];

/**
 * Fired before each LLM call. Can modify messages.
 *
 * `messages` holds the conversation without system messages. The prompt and tool state
 * belong to Pi: it restores them after the handler returns, so a handler cannot drop
 * them and does not need to preserve them.
 */
export interface ContextEvent {
	type: "context";
	messages: AgentMessage[];
}

/** Fired when user executes a bash command via ! or !! prefix */
export interface UserBashEvent {
	type: "user_bash";
	/** The command to execute */
	command: string;
	/** True if !! prefix was used (excluded from LLM context) */
	excludeFromContext: boolean;
	/** Current working directory */
	cwd: string;
}


interface ToolCallEventBase {
	type: "tool_call";
	/**
	 * The call's id. For calls another tool made (with `parentToolCallId` set), pi assigns
	 * `<parent id>/<n>`; such ids never appear as tool calls or tool results in the transcript, only
	 * in the parent result's `nestedCalls` record.
	 */
	toolCallId: string;
	/** Set when another tool (for example a codemode script) issued this call. */
	parentToolCallId?: string;
}

export interface BashToolCallEvent extends ToolCallEventBase {
	toolName: "bash";
	input: BashToolInput;
}

export interface CustomToolCallEvent extends ToolCallEventBase {
	toolName: string;
	input: Record<string, unknown>;
}

export interface ContextEventResult {
	messages?: AgentMessage[];
}

export interface ToolCallEventResult {
	/** Block tool execution. To modify arguments, mutate `event.input` in place instead. */
	block?: boolean;
	reason?: string;
	/**
	 * Hint that the agent should stop after the current tool batch when this call is blocked.
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 */
	terminate?: boolean;
}

/** Result from user_bash event handler */
export type UserBashEventResult =
	| {
			/** Custom operations to use for execution */
			operations: BashOperations;
			result?: never;
	  }
	| {
			operations?: never;
			/** Full replacement: extension handled execution, use this result */
			result: BashResult;
	  };
