export declare class MockWebSocket {
    static instances: MockWebSocket[];
    static reset(): void;
    url: string;
    sent: string[];
    onclose: ((ev: {
        reason?: string;
        code?: number;
    }) => void) | null;
    private _listeners;
    constructor(url: string);
    addEventListener(type: string, cb: (ev: unknown) => void): void;
    send(data: string): void;
    close(): void;
    emitOpen(): void;
    emitMessage(data: unknown): void;
    get lastSentObject(): any;
}
export declare class MockAudio {
    src: string;
    loop: boolean;
    volume: number;
    paused: boolean;
    currentTime: number;
    duration: number;
    constructor(src: string);
    play(): Promise<void>;
    pause(): void;
}
