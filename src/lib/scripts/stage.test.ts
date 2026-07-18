import { describe, it, expect, beforeEach } from 'vitest';
import { Stage } from './stage.js';
import { routeType } from '../stores/routeStore.js';
import { goto } from '$app/navigation';
import { makeMockConsole, asConsole } from '../../test/mockConsole.js';

beforeEach(() => {
	(goto as unknown as { mockClear: () => void }).mockClear();
	routeType.set('');
});

describe('Stage outgoing requests', () => {
	it('initStages sends the stage list and stores it', () => {
		const mock = makeMockConsole();
		const stage = new Stage(asConsole(mock));
		stage.initStages(['home', 'game', 'end']);

		const msg = mock.lastMessage()!;
		expect(msg.request.exec).toBe('initStages');
		expect(msg.getParam('stages')).toEqual(['home', 'game', 'end']);
		expect(stage.stages).toEqual(['home', 'game', 'end']);
	});

	it('goto sends a changeStage request (it does not navigate locally)', () => {
		const mock = makeMockConsole();
		const stage = new Stage(asConsole(mock));
		stage.goto('game');

		const msg = mock.lastMessage()!;
		expect(msg.request.exec).toBe('changeStage');
		expect(msg.getParam('stage')).toBe('game');
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('Stage inbound navigation', () => {
	it('navigates to the received stage using the current routeType', () => {
		routeType.set('monitor');
		const mock = makeMockConsole();
		const stage = new Stage(asConsole(mock));

		mock.trigger.stageChange('master', 'game');

		expect(goto).toHaveBeenCalledWith('/game/monitor/game');
		expect(stage.currentStage).toBe('game');
	});

	it('uses the controller routeType in the path', () => {
		routeType.set('controller');
		const mock = makeMockConsole();
		new Stage(asConsole(mock));

		mock.trigger.stageChange('master', 'home');
		expect(goto).toHaveBeenCalledWith('/game/controller/home');
	});

	it('defaults currentStage to home before any transition', () => {
		const mock = makeMockConsole();
		const stage = new Stage(asConsole(mock));
		expect(stage.currentStage).toBe('home');
	});
});
