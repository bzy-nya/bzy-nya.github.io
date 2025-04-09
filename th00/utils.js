// Utility functions for the game

// Math utility functions
function sqr(x) { return x * x; }

function dist(x1, y1, x2, y2) {
    return Math.sqrt(sqr(Math.abs(x1-x2)) + sqr(Math.abs(y1-y2)));
}

function random_int(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); 
}

function check_range(v, l, r) {
    if (v > r) return r;
    if (v < l) return l;
    return v;
}


// Export utilities to the global scope
window.dist = dist;
window.random_int = random_int;
window.check_range = check_range;
