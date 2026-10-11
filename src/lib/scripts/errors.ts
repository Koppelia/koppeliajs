/**
 * A device command the console refused or could not complete: unknown
 * controller, timeout, any error that is not the mic limit.
 */
export class DeviceError extends Error {
    constructor(message: string = "Device command failed") {
        super(message);
        this.name = "DeviceError";
    }
}

/**
 * The console refused to start another microphone: as many controllers as it
 * allows already stream. The limit is the console's (configurable there, 2 by
 * default) — read `limit` rather than wording a number of your own.
 */
export class MicLimitError extends DeviceError {
    /** How many mics may stream at once, when the console said so. */
    public readonly limit?: number;

    constructor(message?: string, limit?: number) {
        super(
            message ??
                (limit !== undefined
                    ? `Maximum of ${limit} mic modules can be active simultaneously`
                    : "Maximum number of mic modules already active"),
        );
        this.name = "MicLimitError";
        this.limit = limit;
    }
}
