import { describe, expect, it, vi } from 'vitest';
import { asConsole, makeMockConsole } from '../../test/mockConsole.js';
import { Message, MessageType } from './message.js';
import { Vision, VisionError, VisionRequest } from './vision.js';

function answer(params: Record<string, unknown>, type: MessageType = MessageType.RESPONSE): Message {
	const response = new Message();
	response.setType(type);
	for (const key in params) response.addParam(key, params[key]);
	return response;
}

const STATUS = { installed: true, running: true, camera: { state: 'ok' }, modules: ['pose'], recording: false };

describe('Vision', () => {
	it('status: what the console says, « not installed » when it cannot say', async () => {
		const mock = makeMockConsole();
		const vision = new Vision(asConsole(mock));
		const asked = vision.status();
		expect(mock.lastMessage().request.exec).toBe(VisionRequest.getStatus);
		mock.respondLast(answer({ status: STATUS }));
		expect(await asked).toMatchObject({ installed: true, running: true, camera: { state: 'ok' }, modules: ['pose'] });

		const old = vision.status();
		mock.respondLast(answer({ error: 'Unsupported message' }, MessageType.ERROR));
		expect(await old).toMatchObject({ installed: false, running: false, camera: { state: 'unknown' } });
	});

	it('start: results reach the callback until stop', async () => {
		const mock = makeMockConsole();
		const vision = new Vision(asConsole(mock));
		const onPose = vi.fn();
		const started = vision.startPose(onPose, { minHeightShare: 0.3 });
		const request = mock.lastMessage();
		expect(request.request.exec).toBe(VisionRequest.startModule);
		expect(request.request.params).toEqual({ module: 'pose', options: { minHeightShare: 0.3 } });
		mock.respondLast(answer({ module: 'pose' }));
		const handle = await started;

		mock.trigger.request(VisionRequest.data, { module: 'pose', data: { frame: 1 } });
		mock.trigger.request(VisionRequest.data, { module: 'hands', data: { frame: 2 } });
		expect(onPose).toHaveBeenCalledTimes(1);
		expect(onPose).toHaveBeenCalledWith({ frame: 1 });

		handle.setOptions({ minHeightShare: 0 });
		expect(mock.lastMessage().request.exec).toBe(VisionRequest.setModuleOptions);
		handle.stop();
		handle.stop();
		expect(mock.sentWithExec(VisionRequest.stopModule)).toHaveLength(1);
		mock.trigger.request(VisionRequest.data, { module: 'pose', data: { frame: 3 } });
		expect(onPose).toHaveBeenCalledTimes(1);
	});

	it('start refused: a VisionError with its code, nothing left listening', async () => {
		const mock = makeMockConsole();
		const vision = new Vision(asConsole(mock));
		const onPose = vi.fn();
		const started = vision.startPose(onPose);
		mock.respondLast(answer({ error: 'no camera', code: 'NO_CAMERA' }, MessageType.ERROR));
		await expect(started).rejects.toMatchObject({ name: 'VisionError', code: 'NO_CAMERA' });
		mock.trigger.request(VisionRequest.data, { module: 'pose', data: {} });
		expect(onPose).not.toHaveBeenCalled();
	});

	it('no answer: a TIMEOUT', async () => {
		vi.useFakeTimers();
		try {
			const vision = new Vision(asConsole(makeMockConsole()));
			const preview = vision.openPreview();
			vi.advanceTimersByTime(6000);
			await expect(preview).rejects.toBeInstanceOf(VisionError);
		} finally {
			vi.useRealTimers();
		}
	});

	it('preview and status changes', async () => {
		const mock = makeMockConsole();
		const vision = new Vision(asConsole(mock));
		const url = vision.openPreview();
		mock.respondLast(answer({ url: 'http://127.0.0.1:2240/preview.mjpeg?token=t' }));
		expect(await url).toContain('token=t');
		const onStatus = vi.fn();
		vision.onStatus(onStatus);
		mock.trigger.request(VisionRequest.statusNotification, { status: { ...STATUS, camera: { state: 'absent' } } });
		expect(onStatus.mock.calls[0][0].camera.state).toBe('absent');
	});
});
