import { writable } from "svelte/store";

class AudioInstance {
	private audio?: HTMLAudioElement;
	private id: string;
	protected path: string;
	private loop: boolean;
	private volume: number; // Stocke le volume entre 0 et 100

	constructor(id: string, loop: boolean = false) {
		this.id = id;
		this.path = `/audios/${id}.mp3`;
		this.loop = loop;
		this.volume = 100; // Volume par défaut au max
	}

	fetch() {
		this.audio = new Audio(this.path);
		this.audio.loop = this.loop;
		// Appliquer le volume stocké lors de la création de l'élément audio
		this.audio.volume = this.volume / 100;
	}

	play() {
		if (this.audio != undefined) {
			this.audio.play().catch((err) =>
				console.error(`Error playing ${this.id}:`, err)
			);
		}
	}

	pause() {
		if (this.audio != undefined) {
			this.audio.pause();
		}
	}

	stop() {
		if (this.audio != undefined) {
			this.audio.pause();
			this.audio.currentTime = 0;
		}
	}

	setLoop(loop: boolean) {
		this.loop = loop; // Met à jour l'état interne
		if (this.audio != undefined) {
			this.audio.loop = loop;
		}
	}

	/**
	 * Change le volume de l'instance
	 * @param volume Nombre entre 0 et 100
	 */
	setVolume(volume: number) {
		// On s'assure que le volume reste entre 0 et 100
		const safeVolume = Math.max(0, Math.min(100, volume));
		this.volume = safeVolume;

		if (this.audio != undefined) {
			// HTMLAudioElement utilise une plage de 0.0 à 1.0
			this.audio.volume = safeVolume / 100;
		}
	}

	isPlaying(): boolean | undefined {
		if (this.audio != undefined) {
			return !this.audio.paused;
		}
	}

	getId() {
		return this.id;
	}

	getDuration(): number | undefined {
		if (this.audio !== undefined) {
			return this.audio?.duration;
		}
	}
}

class AudioUrlInstance extends AudioInstance {
	constructor(id: string, url: string, loop: boolean) {
		super(id, loop);
		this.path = url;
	}
}

export class AudioManager {
	private players: Map<string, AudioInstance> = new Map();

	/**
	 * Play an audio by id (creates it if doesn't exist)
	 */
	play(id: string, loop: boolean = false, url?: string) {
		let player = this.players.get(id);

		if (!player) {
			if (url !== undefined) {
				player = new AudioUrlInstance(id, url, loop);
			} else {
				player = new AudioInstance(id, loop);
			}
			player.fetch();
			this.players.set(id, player);
		} else {
			// Si le joueur existe déjà, on met à jour la boucle au cas où
			player.setLoop(loop);
		}

		player.play();
	}

	/**
	 * Change le volume d'un audio spécifique
	 * @param id L'identifiant du son
	 * @param volume Le volume entre 0 et 100
	 */
	setVolume(id: string, volume: number) {
		this.players.get(id)?.setVolume(volume);
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
		this.players.forEach((player) => player.stop());
	}

	/**
	 * Pause all audios
	 */
	pauseAll() {
		this.players.forEach((player) => player.pause());
	}

	/**
	 * Check if a specific audio is playing
	 */
	isPlaying(id: string): boolean {
		return this.players.get(id)?.isPlaying() ?? false;
	}

	getPlayerInstance(id: string): AudioInstance | undefined {
		return this.players.get(id);
	}
}

// Export a writable store with the AudioManager singleton
export const audioManager = writable(new AudioManager());
