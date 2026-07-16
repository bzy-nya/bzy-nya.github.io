export function createBreakEffect(source, options = {}) {
    const pieces = options.pieces ?? (source.isBoss ? 30 : 16);
    const colors = options.colors ?? (source.isBoss
        ? ['rgba(122, 236, 255, 0.96)', 'rgba(239, 71, 111, 0.92)', 'rgba(255, 209, 102, 0.90)']
        : ['rgba(122, 236, 255, 0.90)', 'rgba(255, 255, 255, 0.86)', `hsla(${source.hue}, 100%, 72%, 0.88)`]);

    return {
        type: 'break',
        x: source.x,
        y: source.y,
        radius: source.radius,
        age: 0,
        lifetime: options.lifetime ?? (source.isBoss ? 44 : 30),
        colors,
        pieces: Array.from({ length: pieces }, (_, index) => {
            const angle = Math.PI * 2 * index / pieces + Math.random() * 0.24;
            const speed = (source.isBoss ? 2.8 : 2.1) + Math.random() * (source.isBoss ? 3.1 : 2.2);
            return {
                angle,
                speed,
                size: (source.isBoss ? 2.8 : 2.0) + Math.random() * 3.2,
                spin: (Math.random() - 0.5) * 0.22,
                color: colors[index % colors.length]
            };
        })
    };
}

export function updateBreakEffects(effects) {
    let writeIndex = 0;
    for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        effect.age++;
        if (effect.age < effect.lifetime) {
            effects[writeIndex++] = effect;
        }
    }
    effects.length = writeIndex;
}

export function renderBreakEffects(ctx, effects) {
    effects.forEach((effect) => {
        if (effect.type !== 'break') return;

        const t = effect.age / effect.lifetime;
        const alpha = Math.max(0, 1 - t);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const ringRadius = effect.radius + t * (effect.radius * 2.4 + 18);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.46 * alpha})`;
        ctx.lineWidth = 2 + (1 - t) * 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        effect.pieces.forEach((piece, index) => {
            const drift = piece.speed * effect.age;
            const px = effect.x + Math.cos(piece.angle) * drift;
            const py = effect.y + Math.sin(piece.angle) * drift + t * t * 18;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(piece.angle + effect.age * piece.spin);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = piece.color;
            if (index % 3 === 0) {
                ctx.fillRect(-piece.size, -piece.size, piece.size * 2.0, piece.size * 2.0);
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -piece.size * 1.5);
                ctx.lineTo(piece.size, piece.size);
                ctx.lineTo(-piece.size, piece.size);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        });

        ctx.restore();
    });
}
