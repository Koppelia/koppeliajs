/**
 * Autonomous mode, game side: a game launched by a session script (CMS « Séances ») runs with no
 * animator. These types mirror `@koppelia/koppeliajs-core` (src/autonomous.ts), which this SDK does
 * not depend on — keep both in step.
 */

/** What a game launched by a session receives; null when the game was launched by hand. */
export interface AutoModeContext {
	runId: string;
	sessionName: string;
	stepIndex: number;
	stepCount: number;
	nextStepTitle: string | null;
	/** The step's settings, already validated against the game's `autonomousOptions`. */
	options: Record<string, unknown>;
	online: boolean;
}

export type AssistantPurpose = 'anecdote' | 'explain_wrong_majority';

export interface AssistantRequest {
	purpose: AssistantPurpose;
	/** Question, choices, right answer, majority choice, explanation… NEVER a resident's name. */
	context: Record<string, unknown>;
	/** Give up after this long (default 4000 ms): the game goes on with its written text. */
	timeoutMs?: number;
}

export interface SpeechResult {
	/** Cut by stopSpeech or a pause. */
	interrupted: boolean;
	/** The console never said it was done; the SDK stopped waiting after an estimate. */
	timedOut: boolean;
}

/** Request names, as in koppeliajs-core `AutonomousRequest`. */
export const AutonomousRequest = {
	getContext: 'getAutonomousContext',
	stepFinished: 'autonomousStepFinished',
	pause: 'pauseSession',
	resume: 'resumeSession',
	paused: 'autoModePaused',
	resumed: 'autoModeResumed',
	stateNotification: 'sessionStateNotification',
	getConnectivity: 'getConnectivity',
	connectivityNotification: 'connectivityNotification',
	assistant: 'assistantRequest',
	speechFinished: 'speechFinished',
	stopSpeech: 'stopSpeech'
} as const;

/** How long the SDK waits for the console on an autonomous-mode request (ms). */
export const AUTO_MODE_REQUEST_TIMEOUT_MS = 3000;
export const ASSISTANT_DEFAULT_TIMEOUT_MS = 4000;

/**
 * When the console never reports the end of a sentence (older Maestro), how long to wait anyway:
 * about 90 ms per character, plus 2 s. Long enough not to talk over the voice, short enough never
 * to block a game.
 */
export function speechFallbackMs(text: string): number {
	return text.length * 90 + 2000;
}

/** Parses the console's context payload; anything unusable means « not in a session ». */
export function parseAutoModeContext(raw: unknown): AutoModeContext | null {
	if (raw === null || raw === undefined || typeof raw !== 'object') return null;
	const c = raw as Record<string, unknown>;
	if (typeof c.runId !== 'string' || c.runId === '') return null;
	return {
		runId: c.runId,
		sessionName: String(c.sessionName ?? ''),
		stepIndex: Number(c.stepIndex ?? 0),
		stepCount: Number(c.stepCount ?? 1),
		nextStepTitle: typeof c.nextStepTitle === 'string' ? c.nextStepTitle : null,
		options:
			c.options !== null && typeof c.options === 'object'
				? (c.options as Record<string, unknown>)
				: {},
		online: Boolean(c.online)
	};
}
