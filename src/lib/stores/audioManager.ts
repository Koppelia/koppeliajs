import { writable } from 'svelte/store';

class AudioInstance {
	private audio: HTMLAudioElement;
	private id: string;

	constructor(id: string, loop: boolean = false) {
		this.id = id;
		this.audio = new Audio(`/audios/${id}.mp3`);
		this.audio.loop = loop;
	}

	play() {
		this.audio.play().catch(err => console.error(`Error playing ${this.id}:`, err));
	}

	pause() {
		this.audio.pause();
	}

	stop() {
		this.audio.pause();
		this.audio.currentTime = 0;
	}

	setLoop(loop: boolean) {
		this.audio.loop = loop;
	}

	isPlaying() {
		return !this.audio.paused;
	}

	getId() {
		return this.id;
	}
}

class AudioManager {
	private players: Map<string, AudioInstance> = new Map();

	/**
	 * Play an audio by id (creates it if doesn't exist)
	 */
	play(id: string, loop: boolean = false) {
		let player = this.players.get(id);

		if (!player) {
			player = new AudioInstance(id, loop);
			this.players.set(id, player);
		} else {
			player.setLoop(loop);
		}

		player.play();
	}

	/**
	 * Pause a specific audio by id
	 */
	pause(id: string) {
		this.players.get(id)?.pause();
	}

	/**
	 * Stop a specific audio by id
	 */
	stop(id: string) {
		this.players.get(id)?.stop();
	}

	/**
	 * Stop all audios
	 */
	stopAll() {
		this.players.forEach(player => player.stop());
	}

	/**
	 * Pause all audios
	 */
	pauseAll() {
		this.players.forEach(player => player.pause());
	}

	/**
	 * Check if a specific audio is playing
	 */
	isPlaying(id: string): boolean {
		return this.players.get(id)?.isPlaying() ?? false;
	}
}

// Export a writable store with the AudioManager singleton
export const audioManager = writable(new AudioManager());
