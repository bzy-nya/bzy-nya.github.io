// Utility functions for the game

// Math utility functions
export function sqr(x) { return x * x; }

export function dist(x1, y1, x2, y2) {
    return Math.sqrt(sqr(Math.abs(x1-x2)) + sqr(Math.abs(y1-y2)));
}

export function random_int(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); 
}

export function check_range(v, l, r) {
    if (v > r) return r;
    if (v < l) return l;
    return v;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp01(v) {
    return check_range(v, 0, 1);
}
