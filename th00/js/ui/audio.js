import { TH00_ASSET_PATHS } from '../core/config.js';

const sounds = {
    graze: new Audio(resolveAssetUrl(TH00_ASSET_PATHS.sounds.graze)),
    gameOver: new Audio(resolveAssetUrl(TH00_ASSET_PATHS.sounds.gameOver)),
    damage: new Audio(resolveAssetUrl(TH00_ASSET_PATHS.sounds.damage)),
    blowup: new Audio(resolveAssetUrl(TH00_ASSET_PATHS.sounds.blowup)),
    pause: new Audio(resolveAssetUrl(TH00_ASSET_PATHS.sounds.pause))
};

sounds.graze.volume = 0.3;
sounds.gameOver.volume = 0.22;
sounds.damage.volume = 0.16;
sounds.blowup.volume = 0.12;
sounds.pause.volume = 0.3;

const soundThrottles = {
    graze: {
        lastFrame: -9999,
        minFrames: 3
    },
    damage: {
        lastFrame: -9999,
        minFrames: 3
    }
};

function createSoundPool(soundName, poolSize = 6) {
    const originalSound = sounds[soundName];
    if (!originalSound) return [];

    return Array.from({ length: poolSize }, () => {
        const clone = originalSound.cloneNode(true);
        clone.volume = originalSound.volume;
        return clone;
    });
}

const soundPools = {
    graze: {
        index: 0,
        items: createSoundPool('graze', 6)
    },
    damage: {
        index: 0,
        items: createSoundPool('damage', 6)
    },
    blowup: {
        index: 0,
        items: createSoundPool('blowup', 5)
    }
};

let stageMusic = null;
let stageMusicToken = 0;

function playPooledSound(soundName) {
    const pool = soundPools[soundName];
    if (!pool || pool.items.length === 0) return;

    const sound = pool.items[pool.index];
    pool.index = (pool.index + 1) % pool.items.length;
    try {
        sound.pause();
        sound.currentTime = 0;
    } catch (_) {
        // Some browsers reject seeking before metadata is ready; playing still works.
    }
    sound.volume = sounds[soundName].volume;
    sound.play().catch(() => {});
}

export function playSound(soundName, currentFrame = 0) {
    if (!sounds[soundName]) return;

    if (soundName === 'graze' || soundName === 'damage') {
        const throttle = soundThrottles[soundName];
        if (currentFrame < throttle.lastFrame) {
            throttle.lastFrame = -9999;
        }
        if (currentFrame - throttle.lastFrame < throttle.minFrames) return;

        throttle.lastFrame = currentFrame;
        playPooledSound(soundName);
        return;
    }

    if (soundName === 'blowup') {
        playPooledSound(soundName);
        return;
    }

    const sound = sounds[soundName].cloneNode(true);
    sound.volume = sounds[soundName].volume;
    sound.play().catch(() => {});
}

export function resetAudioState() {
    Object.values(soundThrottles).forEach((throttle) => {
        throttle.lastFrame = -9999;
    });
    Object.values(soundPools).forEach((pool) => {
        pool.index = 0;
        pool.items.forEach((sound) => {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (_) {
                // Some browsers reject seeking before metadata is ready.
            }
        });
    });
}

export function playStageMusic(src) {
    stopStageMusic();
    if (!src) return;

    if (/\.mid(?:i)?(?:$|\?)/i.test(src)) {
        playMidiStageMusic(src, ++stageMusicToken);
        return;
    }

    const audio = new Audio(resolveAssetUrl(src));
    audio.loop = true;
    audio.volume = 0.42;
    stageMusic = { type: 'audio', audio };
    audio.play().catch(() => {});
}

export function playPlayerScore() {
    playStageMusic(TH00_ASSET_PATHS.music.playerScore);
}

export function pauseStageMusic() {
    if (!stageMusic) return;

    if (stageMusic.type === 'audio') {
        stageMusic.audio.pause();
        return;
    }

    if (stageMusic.type === 'midi') {
        stageMusic.context.suspend().catch(() => {});
    }
}

export function resumeStageMusic() {
    if (!stageMusic) return;

    if (stageMusic.type === 'audio') {
        stageMusic.audio.play().catch(() => {});
        return;
    }

    if (stageMusic.type === 'midi') {
        stageMusic.context.resume().catch(() => {});
    }
}

export function stopStageMusic() {
    stageMusicToken++;
    if (!stageMusic) return;

    try {
        if (stageMusic.type === 'audio') {
            stageMusic.audio.pause();
            stageMusic.audio.currentTime = 0;
        } else if (stageMusic.type === 'midi') {
            clearTimeout(stageMusic.schedulerTimer);
            stageMusic.nodes.forEach((node) => {
                try {
                    node.stop(0);
                } catch (_) {
                    // Already stopped.
                }
            });
            stageMusic.context.close().catch(() => {});
        }
    } catch (_) {
        // Some browsers reject seeking before metadata is ready.
    }
    stageMusic = null;
}

async function playMidiStageMusic(src, token) {
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const delay = context.createDelay(0.35);
    const delayGain = context.createGain();

    master.gain.value = 0.2;
    delay.delayTime.value = 0.18;
    delayGain.gain.value = 0.16;
    master.connect(compressor);
    master.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(compressor);
    compressor.connect(context.destination);
    stageMusic = {
        type: 'midi',
        context,
        master,
        sequence: null,
        nodes: [],
        schedulerTimer: 0,
        startedAt: 0,
        scheduledUntil: 0,
        token
    };
    context.resume().catch(() => {});

    try {
        const response = await fetch(resolveAssetUrl(src));
        if (!response.ok) {
            throw new Error(`MIDI request failed: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (token !== stageMusicToken || !stageMusic || stageMusic.context !== context) {
            context.close().catch(() => {});
            return;
        }

        const sequence = parseMidi(buffer);
        if (sequence.notes.length === 0) {
            throw new Error('MIDI contains no playable notes');
        }
        stageMusic.sequence = sequence;
        await context.resume();
        scheduleMidiLoop(stageMusic);
    } catch (error) {
        if (stageMusic && stageMusic.context === context) {
            stageMusic = null;
        }
        context.close().catch(() => {});
        console.warn('Unable to play MIDI stage music:', error);
    }
}

function getAudioContextClass() {
    return globalThis.AudioContext
        || globalThis.webkitAudioContext
        || (globalThis.window && (window.AudioContext || window.webkitAudioContext));
}

function resolveAssetUrl(src) {
    try {
        if (/^assets\//.test(src)) {
            return new URL(`../../${src}`, import.meta.url).href;
        }
        return new URL(src, import.meta.url).href;
    } catch (_) {
        return src;
    }
}

function scheduleMidiLoop(music) {
    if (!music || music !== stageMusic || music.type !== 'midi' || !music.sequence) return;

    music.nodes = [];
    music.startedAt = music.context.currentTime + 0.08;
    music.scheduledUntil = 0;
    scheduleMidiWindow(music);
}

function scheduleMidiWindow(music) {
    if (!music || music !== stageMusic || music.type !== 'midi' || !music.sequence) return;

    const lookaheadSeconds = 1.8;
    const elapsed = Math.max(0, music.context.currentTime - music.startedAt);
    const from = music.scheduledUntil;
    const to = elapsed + lookaheadSeconds;

    music.sequence.notes.forEach((note) => {
        if (note.start >= from && note.start < to) {
            scheduleMidiNote(music, note, music.startedAt);
        }
    });

    music.scheduledUntil = to;
    music.nodes = music.nodes.filter((node) => !node.__stopAt || node.__stopAt > music.context.currentTime);

    if (to >= music.sequence.duration + 0.5) {
        music.schedulerTimer = setTimeout(() => scheduleMidiLoop(music), Math.max(0, music.sequence.duration - elapsed) * 1000);
        return;
    }

    music.schedulerTimer = setTimeout(() => scheduleMidiWindow(music), 280);
}

function scheduleMidiNote(music, note, startAt) {
    if (note.channel === 9) {
        scheduleMidiDrum(music, note, startAt);
        return;
    }

    const start = startAt + note.start;
    const duration = Math.max(0.04, note.duration);
    const frequency = 440 * Math.pow(2, (note.note - 69) / 12);
    const oscillator = music.context.createOscillator();
    const overtone = music.context.createOscillator();
    const gain = music.context.createGain();
    const overtoneGain = music.context.createGain();
    const filter = music.context.createBiquadFilter();
    const voice = getMidiVoice(note.channel);

    oscillator.type = voice.wave;
    overtone.type = voice.overtoneWave;
    oscillator.frequency.setValueAtTime(frequency, start);
    overtone.frequency.setValueAtTime(frequency * voice.overtoneRatio, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.filter + note.velocity * voice.filterRange, start);
    filter.Q.setValueAtTime(voice.q, start);

    const volume = voice.volume * note.velocity;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + voice.attack);
    gain.gain.setValueAtTime(Math.max(0.0002, volume * voice.sustain), start + Math.max(voice.attack, duration * 0.55));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + voice.release);
    overtoneGain.gain.setValueAtTime(voice.overtoneGain, start);

    oscillator.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(gain);
    gain.connect(music.master);
    oscillator.start(start);
    overtone.start(start);
    oscillator.__stopAt = start + duration + voice.release + 0.02;
    overtone.__stopAt = oscillator.__stopAt;
    oscillator.stop(oscillator.__stopAt);
    overtone.stop(overtone.__stopAt);
    music.nodes.push(oscillator);
    music.nodes.push(overtone);
}

function scheduleMidiDrum(music, note, startAt) {
    const start = startAt + note.start;
    const oscillator = music.context.createOscillator();
    const gain = music.context.createGain();
    const filter = music.context.createBiquadFilter();
    const isKick = note.note < 38;
    const isHat = note.note >= 42;
    const baseFrequency = isKick ? 90 : (isHat ? 5200 : 190);
    const duration = isHat ? 0.045 : 0.09;

    oscillator.type = isHat ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(baseFrequency, start);
    if (isKick) {
        oscillator.frequency.exponentialRampToValueAtTime(46, start + duration);
    }

    filter.type = isHat ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(isHat ? 3600 : 900, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime((isHat ? 0.045 : 0.13) * note.velocity, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(music.master);
    oscillator.start(start);
    oscillator.__stopAt = start + duration + 0.02;
    oscillator.stop(oscillator.__stopAt);
    music.nodes.push(oscillator);
}

function getMidiVoice(channel) {
    const voices = [
        { wave: 'square', overtoneWave: 'triangle', overtoneRatio: 2, overtoneGain: 0.08, volume: 0.07, attack: 0.01, release: 0.08, sustain: 0.72, filter: 1800, filterRange: 3200, q: 1.4 },
        { wave: 'triangle', overtoneWave: 'sine', overtoneRatio: 2, overtoneGain: 0.04, volume: 0.05, attack: 0.018, release: 0.16, sustain: 0.82, filter: 1500, filterRange: 1700, q: 0.8 },
        { wave: 'sawtooth', overtoneWave: 'triangle', overtoneRatio: 0.5, overtoneGain: 0.05, volume: 0.055, attack: 0.012, release: 0.08, sustain: 0.76, filter: 900, filterRange: 1300, q: 0.9 },
        { wave: 'sawtooth', overtoneWave: 'square', overtoneRatio: 2, overtoneGain: 0.1, volume: 0.09, attack: 0.008, release: 0.1, sustain: 0.7, filter: 2600, filterRange: 4200, q: 1.7 }
    ];
    return voices[channel] || voices[channel % voices.length];
}

function parseMidi(buffer) {
    const view = new DataView(buffer);
    let offset = 0;
    const readText = (length) => {
        let text = '';
        for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(offset++));
        return text;
    };
    const readU16 = () => {
        const value = view.getUint16(offset);
        offset += 2;
        return value;
    };
    const readU32 = () => {
        const value = view.getUint32(offset);
        offset += 4;
        return value;
    };
    const readVar = () => {
        let value = 0;
        let byte = 0;
        do {
            byte = view.getUint8(offset++);
            value = (value << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        return value;
    };

    if (readText(4) !== 'MThd') {
        throw new Error('Invalid MIDI header');
    }

    const headerLength = readU32();
    offset += 2;
    const trackCount = readU16();
    const ticksPerBeat = readU16();
    offset += Math.max(0, headerLength - 6);

    const events = [];
    const tempos = [{ tick: 0, mpqn: 500000 }];

    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
        if (readText(4) !== 'MTrk') break;
        const trackLength = readU32();
        const trackEnd = offset + trackLength;
        let tick = 0;
        let runningStatus = 0;

        while (offset < trackEnd) {
            tick += readVar();
            let status = view.getUint8(offset++);
            if (status < 0x80) {
                offset--;
                status = runningStatus;
            } else {
                runningStatus = status;
            }

            if (status === 0xff) {
                const type = view.getUint8(offset++);
                const length = readVar();
                if (type === 0x51 && length === 3) {
                    const mpqn = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
                    tempos.push({ tick, mpqn });
                }
                offset += length;
                continue;
            }

            if (status === 0xf0 || status === 0xf7) {
                offset += readVar();
                continue;
            }

            const command = status & 0xf0;
            const channel = status & 0x0f;
            const data1 = view.getUint8(offset++);
            const needsSecondByte = command !== 0xc0 && command !== 0xd0;
            const data2 = needsSecondByte ? view.getUint8(offset++) : 0;

            if (command === 0x90 || command === 0x80) {
                events.push({
                    tick,
                    type: command === 0x90 && data2 > 0 ? 'on' : 'off',
                    channel,
                    note: data1,
                    velocity: data2 / 127
                });
            }
        }

        offset = trackEnd;
    }

    tempos.sort((a, b) => a.tick - b.tick);
    events.sort((a, b) => a.tick - b.tick);

    const tickToSeconds = createTickConverter(tempos, ticksPerBeat);
    const activeNotes = new Map();
    const notes = [];

    events.forEach((event) => {
        const key = `${event.channel}:${event.note}`;
        if (event.type === 'on') {
            if (!activeNotes.has(key)) activeNotes.set(key, []);
            activeNotes.get(key).push(event);
            return;
        }

        const stack = activeNotes.get(key);
        if (!stack || stack.length === 0) return;
        const startEvent = stack.shift();
        const start = tickToSeconds(startEvent.tick);
        const end = tickToSeconds(event.tick);
        notes.push({
            start,
            duration: end - start,
            note: event.note,
            channel: event.channel,
            velocity: Math.max(0.2, startEvent.velocity)
        });
    });

    const duration = notes.reduce((max, note) => Math.max(max, note.start + note.duration), 0);
    return { notes, duration };
}

function createTickConverter(tempos, ticksPerBeat) {
    return (tick) => {
        let seconds = 0;
        let lastTick = 0;
        let tempo = tempos[0].mpqn;

        for (let i = 1; i < tempos.length && tempos[i].tick <= tick; i++) {
            seconds += ((tempos[i].tick - lastTick) * tempo) / ticksPerBeat / 1000000;
            lastTick = tempos[i].tick;
            tempo = tempos[i].mpqn;
        }

        seconds += ((tick - lastTick) * tempo) / ticksPerBeat / 1000000;
        return seconds;
    };
}
