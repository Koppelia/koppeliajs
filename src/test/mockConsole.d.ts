import type { Console } from '../lib/scripts/console.js';
import type { Message } from '../lib/scripts/message.js';
type Callback = (response: Message) => void;
/**
 * A lightweight stand-in for {@link Console}. It records every message passed to
 * sendMessage and captures the handlers registered by the class under test, so a
 * test can simulate inbound network events (`trigger.*`) and answer outbound
 * requests (`respondLast`). Cast the returned object with `asConsole()` when a
 * constructor expects a real Console.
 *
 * `ready` defaults to true so onReady() callbacks fire immediately, matching an
 * already-connected console; set it to false before constructing to defer them.
 */
export declare function makeMockConsole(options?: {
    ready?: boolean;
}): {
    sendMessage: import("vitest").Mock<(message: Message, callback?: Callback) => void>;
    onReady: import("vitest").Mock<(cb: () => void) => string>;
    onStateChange: import("vitest").Mock<(cb: (from: string, state: unknown, update: boolean) => void) => string>;
    onStageChange: import("vitest").Mock<(cb: (from: string, stage: string) => void) => string>;
    onDataExchange: import("vitest").Mock<(cb: (from: string, data: unknown) => void) => string>;
    onRequest: import("vitest").Mock<(cb: (request: string, params: Record<string, unknown>, from: string, address: string) => void) => string>;
    onDeviceEvent: import("vitest").Mock<(cb: (device: string, from_addr: string, event: string) => void) => string>;
    unsubscribeCallback: import("vitest").Mock<(id: string) => boolean>;
    getMediaUrl: import("vitest").Mock<(path: string) => string>;
    getMedia: import("vitest").Mock<(_path: string) => Promise<unknown>>;
    sent: {
        message: Message;
        callback?: Callback;
    }[];
    setMediaResponse(value: unknown): void;
    setReady(value: boolean): void;
    trigger: {
        ready: () => void;
        stateChange: (from: string, state: unknown, update: boolean) => void;
        stageChange: (from: string, stage: string) => void;
        dataExchange: (from: string, data: unknown) => void;
        request: (request: string, params: Record<string, unknown>, from?: string, address?: string) => void;
        deviceEvent: (device: string, from_addr: string, event: string) => void;
    };
    /** Invoke the callback of the most recently sent request with a response. */
    respondLast(response: Message): void;
    /** All sent messages whose request.exec matches. */
    sentWithExec(exec: string): Message[];
    lastMessage(): Message;
};
export type MockConsole = ReturnType<typeof makeMockConsole>;
/** Cast a mock to the Console type for constructors that require the real one. */
export declare function asConsole(mock: MockConsole): Console;
export {};
