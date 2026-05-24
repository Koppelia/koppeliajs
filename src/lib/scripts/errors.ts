export class MicLimitError extends Error {
    constructor(message: string = "Maximum of 5 mic modules can be active simultaneously") {
        super(message);
        this.name = "MicLimitError";
    }
}
