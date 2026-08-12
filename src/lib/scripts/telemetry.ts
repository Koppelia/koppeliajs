/**
 * Telemetry reporting — what a game tells the console about what happened.
 *
 * A game reports two different things, and they are deliberately separate calls:
 *
 * - {@link ParticipantResult} — one entry per PARTICIPANT. This is what fills a
 *   resident's history: "Marcelle scored 8".
 * - the session payload — collective context that belongs to nobody in
 *   particular: the difficulty, the theme, the number of rounds played.
 *
 * The console owns everything else. A game never sends a session id, never sets
 * `ended_at`, and never decides when the session is over — filarmonic writes
 * those, because a game that has stopped emitting is not a game that has ended
 * (an animator's ten-minute debrief after the last round still counts as play).
 */

/**
 * How a participant is identified WITHIN one session.
 *
 * Not the controller. The catalogue holds two incompatible participation models
 * and the key has to cover both:
 *
 * - the controller **is** the player (rapid-class, video-bike) — the key is
 *   naturally its BLE address;
 * - the player is **chosen** (bowlstar-revolution) — the animator picks residents
 *   from the roster and the controllers are the *pins*, carrying no identity at
 *   all. Keying on the device would collapse every player into one row here.
 *
 * Whatever the game picks, it must be **stable for the whole session**. If the
 * animator re-binds a controller mid-game, mint a NEW key rather than reusing the
 * old one: the existing row freezes and a fresh one starts, instead of one
 * resident's score silently overwriting another's.
 */
export type ParticipantResult = {
    /** Stable within the session. A BLE address, a resident id, a local player id. */
    participantKey: string;
    /** The resident behind this participant, when the game knows it. */
    residentId?: string;
    /** Descriptive only — never used to match rows. */
    deviceId?: string;
    /** The headline number. What it MEANS is declared in the game's telemetry.json. */
    score?: number;
    outcome?: "won" | "lost" | "rank" | "completed";
    /** Free per-game detail, interpreted by the game's rule file. */
    results?: { [key: string]: any };
    joinedAt?: Date;
    leftAt?: Date;
};

/** Wire form. Dates become ISO strings; undefined keys are dropped. */
export function serializeParticipant(p: ParticipantResult): {
    [key: string]: any;
} {
    const out: { [key: string]: any } = { participant_key: p.participantKey };
    if (p.residentId !== undefined) out.resident_id = p.residentId;
    if (p.deviceId !== undefined) out.device_id = p.deviceId;
    if (p.score !== undefined) out.score = p.score;
    if (p.outcome !== undefined) out.outcome = p.outcome;
    if (p.results !== undefined) out.results = p.results;
    if (p.joinedAt !== undefined) out.joined_at = p.joinedAt.toISOString();
    if (p.leftAt !== undefined) out.left_at = p.leftAt.toISOString();
    return out;
}
