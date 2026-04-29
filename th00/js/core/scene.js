import { GAME_CONSTANTS } from './config.js';

function createShaderProgram(gl, vertexSource, fragmentSource) {
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('th00 background shader compile failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('th00 background shader link failed:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function createBackgroundShader() {
    const canvas = document.createElement('canvas');
    canvas.width = GAME_CONSTANTS.SCREEN.WIDTH;
    canvas.height = GAME_CONSTANTS.SCREEN.HEIGHT;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    const vertexSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform float u_frame;
        uniform vec2 u_resolution;
        uniform float u_dark;

        #define RED vec3(0.937, 0.278, 0.435)
        #define YELLOW vec3(1.000, 0.820, 0.400)
        #define GREEN vec3(0.024, 0.839, 0.627)
        #define BLUE vec3(0.067, 0.541, 0.698)
        #define NAVY vec3(0.027, 0.231, 0.298)
        #define PINK vec3(1.000, 0.220, 0.880)
        #define CYAN vec3(0.100, 0.900, 1.000)
        #define DAY_FOG vec3(0.925, 0.935, 0.945)
        #define NIGHT_FOG vec3(0.012, 0.014, 0.050)

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float line(float v, float width) {
            return 1.0 - smoothstep(0.0, width, abs(v));
        }

        float boxMask2D(vec2 p, vec2 center, vec2 halfSize, float blur) {
            vec2 d = abs(p - center) - halfSize;
            float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
            return 1.0 - smoothstep(0.0, blur, dist);
        }

        vec3 paletteAccent(float value) {
            float band = floor(fract(value) * 5.0);
            if (band < 1.0) return RED;
            if (band < 2.0) return YELLOW;
            if (band < 3.0) return GREEN;
            if (band < 4.0) return BLUE;
            return NAVY;
        }

        vec3 boostedAccent(vec3 accent) {
            return clamp(accent * 1.18 + vec3(0.035), 0.0, 1.0);
        }

        vec3 dayCircuitColor(float lane) {
            if (lane < 0.5) return boostedAccent(RED);
            if (lane < 1.5) return boostedAccent(YELLOW);
            if (lane < 2.5) return boostedAccent(GREEN);
            return boostedAccent(BLUE);
        }

        float circuitPathCoord(float index, float lane, float column) {
            float wave = sin(index * 1.37 + lane * 2.11 + column * 0.53) + sin(index * 0.63 + lane * 3.73 + column * 1.17);
            float slot = clamp(floor(wave * 1.08 + 2.0), 0.0, 3.0);
            return column * 4.0 + 0.48 + slot * 0.92 + lane * 0.07;
        }

        void sampleDayCircuitProjection(
            vec2 uv,
            float projectionWeight,
            inout float routeMask,
            inout float nodeOuterMask,
            inout float nodeInnerMask,
            inout vec3 routeAccent,
            inout vec3 nodeAccent
        ) {
            float lineHalf = 0.0050;
            float lineBlur = 0.0080;
            float nodeOuter = 0.026;
            float nodeInner = 0.014;

            for (int laneIndex = 0; laneIndex < 4; laneIndex++) {
                float lane = float(laneIndex);
                vec2 gridScale = vec2(0.46 + lane * 0.028, 0.38 + lane * 0.024);
                vec2 offset = vec2(hash(vec2(lane, 31.0)), hash(vec2(lane, 47.0))) * 8.0;
                vec2 g = uv * gridScale + offset;
                vec3 accent = dayCircuitColor(lane);
                float cell = floor(g.y);
                float columnBase = floor(g.x / 4.0);

                for (int columnIndex = 0; columnIndex < 2; columnIndex++) {
                    float column = columnBase + float(columnIndex) - 1.0;
                    for (int i = 0; i < 4; i++) {
                        float y0 = cell + float(i) - 2.0;
                        float y1 = y0 + 1.0;
                        float x0 = circuitPathCoord(y0, lane, column);
                        float x1 = circuitPathCoord(y1, lane, column);
                        float midX = 0.5 * (x0 + x1);
                        float midY = 0.5 * (y0 + y1);
                        float halfX = 0.5 * abs(x1 - x0) + nodeOuter * 0.92;

                        float vertical = boxMask2D(g, vec2(x0, midY), vec2(lineHalf, 0.5 + nodeOuter * 0.92), lineBlur);
                        float horizontal = boxMask2D(g, vec2(midX, y1), vec2(halfX, lineHalf), lineBlur);
                        float outerA = boxMask2D(g, vec2(x0, y0), vec2(nodeOuter), lineBlur);
                        float outerB = boxMask2D(g, vec2(x0, y1), vec2(nodeOuter), lineBlur);
                        float outerC = boxMask2D(g, vec2(x1, y1), vec2(nodeOuter), lineBlur);
                        float innerA = boxMask2D(g, vec2(x0, y0), vec2(nodeInner), lineBlur);
                        float innerB = boxMask2D(g, vec2(x0, y1), vec2(nodeInner), lineBlur);
                        float innerC = boxMask2D(g, vec2(x1, y1), vec2(nodeInner), lineBlur);
                        float localRoute = max(horizontal, vertical);
                        float localOuter = max(max(outerA, outerB), outerC);
                        float localInner = max(max(innerA, innerB), innerC);
                        localRoute *= projectionWeight;
                        localOuter *= projectionWeight;
                        localInner *= projectionWeight;

                        if (localRoute > routeMask) {
                            routeMask = localRoute;
                            routeAccent = accent;
                        }
                        if (localOuter > nodeOuterMask) {
                            nodeOuterMask = localOuter;
                            nodeAccent = accent;
                        }
                        nodeInnerMask = max(nodeInnerMask, localInner);
                    }
                }
            }
        }

        vec3 applyDaySurfaceCircuits(vec3 base, vec3 p, vec3 normal, float edgeCarryMask) {
            float routeMask = 0.0;
            float nodeOuterMask = 0.0;
            float nodeInnerMask = 0.0;
            vec3 routeAccent = vec3(0.0);
            vec3 nodeAccent = vec3(0.0);
            vec3 projectionWeight = max(abs(normal), vec3(edgeCarryMask));

            sampleDayCircuitProjection(p.xz, projectionWeight.y, routeMask, nodeOuterMask, nodeInnerMask, routeAccent, nodeAccent);
            sampleDayCircuitProjection(p.xy, projectionWeight.z, routeMask, nodeOuterMask, nodeInnerMask, routeAccent, nodeAccent);
            sampleDayCircuitProjection(p.zy, projectionWeight.x, routeMask, nodeOuterMask, nodeInnerMask, routeAccent, nodeAccent);

            vec3 originalBase = base;
            float surfaceStrength = abs(normal.y) > 0.5 ? 0.52 : 0.34;
            base = mix(base, routeAccent, routeMask * surfaceStrength);
            base = mix(base, originalBase, nodeInnerMask * nodeOuterMask * 0.96);
            float nodeBorder = max(nodeOuterMask - nodeInnerMask, 0.0);
            base = mix(base, mix(nodeAccent, vec3(0.98), 0.24), nodeBorder * surfaceStrength * 0.82);
            return base;
        }

        float boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out vec3 normal, out float edgeCarryMask) {
            vec3 inv = 1.0 / rd;
            vec3 t0 = (bmin - ro) * inv;
            vec3 t1 = (bmax - ro) * inv;
            vec3 tn = min(t0, t1);
            vec3 tf = max(t0, t1);
            float tNear = max(max(tn.x, tn.y), tn.z);
            float tFar = min(min(tf.x, tf.y), tf.z);
            if (tFar < max(tNear, 0.001)) return 1.0e6;

            vec3 hit = ro + rd * tNear;
            float ex = min(abs(hit.x - bmin.x), abs(hit.x - bmax.x));
            float ey = min(abs(hit.y - bmin.y), abs(hit.y - bmax.y));
            float ez = min(abs(hit.z - bmin.z), abs(hit.z - bmax.z));
            normal = vec3(0.0);
            float edgeDistance = 0.0;
            if (ex < ey && ex < ez) {
                normal.x = hit.x < (bmin.x + bmax.x) * 0.5 ? -1.0 : 1.0;
                edgeDistance = min(min(hit.y - bmin.y, bmax.y - hit.y), min(hit.z - bmin.z, bmax.z - hit.z));
            } else if (ey < ez) {
                normal.y = hit.y < (bmin.y + bmax.y) * 0.5 ? -1.0 : 1.0;
                edgeDistance = min(min(hit.x - bmin.x, bmax.x - hit.x), min(hit.z - bmin.z, bmax.z - hit.z));
            } else {
                normal.z = hit.z < (bmin.z + bmax.z) * 0.5 ? -1.0 : 1.0;
                edgeDistance = min(min(hit.x - bmin.x, bmax.x - hit.x), min(hit.y - bmin.y, bmax.y - hit.y));
            }
            edgeCarryMask = 1.0 - smoothstep(0.05, 0.22, max(edgeDistance, 0.0));
            return tNear;
        }

        vec3 getRay(vec2 uv, float frame, float dark) {
            vec2 p = vec2(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
            p.x *= u_resolution.x / u_resolution.y;
            vec3 rd = normalize(vec3(p.x * 0.88, p.y * 0.84 - (dark < 0.5 ? 0.10 : 0.03), 1.44));
            float yaw = sin(frame * 0.010) * (dark < 0.5 ? 0.016 : 0.030);
            float cy = cos(yaw);
            float sy = sin(yaw);
            rd.xz = mat2(cy, -sy, sy, cy) * rd.xz;
            return rd;
        }

        vec3 moonDisc(vec2 uv, vec2 center, float radius) {
            vec2 p = uv - center;
            float d = length(p);
            float disc = 1.0 - smoothstep(radius, radius + 0.004, d);
            float glow = exp(-max(d - radius, 0.0) * 24.0) * 0.30;
            float shade = clamp(1.05 - d / radius * 0.42 - p.x * 1.05 + p.y * 0.18, 0.0, 1.0);
            return mix(vec3(0.58, 0.67, 0.82), vec3(1.00, 0.96, 0.88), shade) * disc + CYAN * glow;
        }

        vec3 skyColor(vec2 uv, float frame, float dark) {
            if (dark < 0.5) {
                vec3 color = mix(vec3(0.940, 0.948, 0.958), vec3(0.790, 0.815, 0.845), smoothstep(0.0, 1.0, uv.y));
                vec2 sun = vec2(0.73, 0.16);
                float d = length((uv - sun) * vec2(u_resolution.x / u_resolution.y, 1.0));
                float disc = 1.0 - smoothstep(0.048, 0.052, d);
                color += vec3(0.96, 0.76, 0.30) * exp(-d * 6.2) * 0.10;
                color = mix(color, vec3(0.99, 0.90, 0.62), disc * 0.82);
                return color;
            }

            vec3 color = mix(vec3(0.055, 0.010, 0.115), vec3(0.001, 0.003, 0.018), smoothstep(0.0, 1.0, uv.y));
            color += PINK * exp(-length((uv - vec2(0.25, 0.22)) * vec2(1.0, 1.7)) * 2.8) * 0.28;
            color += CYAN * exp(-length((uv - vec2(0.70, 0.36)) * vec2(1.2, 2.0)) * 3.6) * 0.22;
            color += RED * exp(-abs(uv.y - 0.26) * 7.2) * 0.10;

            vec2 starUv = uv * vec2(90.0, 130.0);
            vec2 starCell = floor(starUv);
            vec2 starLocal = fract(starUv) - 0.5;
            float starRand = hash(starCell);
            float star = step(0.980, starRand) * (1.0 - smoothstep(0.055, 0.170, length(starLocal)));
            float twinkle = 0.55 + 0.45 * sin(frame * 0.045 + starRand * 34.0);
            color += vec3(0.70, 0.88, 1.0) * star * twinkle * smoothstep(0.66, 0.18, uv.y) * 0.88;
            color += moonDisc(uv, vec2(0.75, 0.17), 0.064);
            return color;
        }

        vec3 dayGroundColor(vec3 p, float frame) {
            float lane = 1.0 - smoothstep(0.25, 1.80, abs(p.x));
            vec3 base = mix(vec3(0.800, 0.815, 0.832), vec3(0.955, 0.960, 0.965), lane);
            float tile = max(line(fract(p.x * 0.32) - 0.5, 0.010), line(fract((p.z + frame * 0.025) * 0.30) - 0.5, 0.010));
            float edge = line(abs(p.x) - 1.62, 0.022);
            base = mix(base, vec3(0.700, 0.735, 0.770), tile * 0.10);
            base += mix(RED, BLUE, step(0.5, fract(p.z * 0.22))) * edge * 0.10;
            return base;
        }

        vec3 nightGroundColor(vec3 p, float frame) {
            float lane = 1.0 - smoothstep(0.24, 1.48, abs(p.x));
            vec3 base = mix(vec3(0.004, 0.005, 0.018), vec3(0.018, 0.025, 0.070), lane);
            float gridX = line(fract(p.x * 0.42) - 0.5, 0.014);
            float gridZ = line(fract((p.z + frame * 0.055) * 0.42) - 0.5, 0.014);
            float edge = line(abs(p.x) - 1.42, 0.026);
            base += GREEN * gridZ * 0.16;
            base += CYAN * gridX * 0.13;
            base += mix(PINK, CYAN, step(0.5, fract(p.z * 0.36))) * edge * 0.68;
            base += PINK * exp(-abs(p.x) * 0.60) * exp(-p.z * 0.045) * 0.040;
            return base;
        }

        vec3 dayBuildingColor(vec3 p, vec3 normal, vec2 cell, float seed, float viewT) {
            vec3 sunDir = normalize(vec3(-0.45, 0.82, -0.35));
            float diffuse = clamp(dot(normal, sunDir), 0.0, 1.0);
            float side = normal.x * 0.22 + normal.z * 0.16;
            vec3 concrete = mix(vec3(0.700, 0.725, 0.750), vec3(0.972, 0.976, 0.980), seed * 0.72);
            concrete *= 0.78 + diffuse * 0.34 + side;
            concrete += vec3(1.0, 0.86, 0.56) * diffuse * 0.045;

            if (abs(normal.y) < 0.5) {
                float coord = abs(normal.x) > 0.5 ? p.z : p.x;
                float window = line(fract(coord * 2.6) - 0.5, 0.045) * line(fract(p.y * 1.9) - 0.5, 0.050);
                concrete += vec3(0.42, 0.54, 0.66) * window * step(0.78, hash(floor(vec2(coord * 2.6, p.y * 1.9)) + cell)) * 0.12;
            }

            return mix(concrete, DAY_FOG, smoothstep(18.0, 52.0, viewT));
        }

        vec3 spaceObjectColor(vec3 p, vec3 normal, vec2 id, float seed, float frame) {
            vec3 neon = mix(CYAN, PINK, hash(id + 4.0));
            neon = mix(neon, GREEN, step(0.72, hash(id + 11.0)) * 0.42);
            float rim = pow(1.0 - max(dot(normal, normalize(-p)), 0.0), 1.6);
            float stripeA = line(fract((p.x + p.y + p.z) * 1.35 + seed) - 0.5, 0.030);
            float stripeB = line(fract((p.x - p.z) * 0.92 + frame * 0.010) - 0.5, 0.018);
            vec3 base = mix(vec3(0.025, 0.018, 0.075), vec3(0.110, 0.030, 0.180), seed);
            base += neon * (0.18 + rim * 0.55 + stripeA * 0.40 + stripeB * 0.25);
            return base;
        }

        float vaporMask(vec3 p, float frame) {
            float wave = sin(p.z * 0.15 + frame * 0.030 + p.x * 0.42) * 0.08;
            float gridX = line(fract((p.x + wave) * 0.42) - 0.5, 0.014);
            float gridZ = line(fract((p.z + frame * 0.055) * 0.42 + wave) - 0.5, 0.014);
            float scan = line(fract((p.z + frame * 0.030) * 0.12) - 0.5, 0.030);
            return max(max(gridX, gridZ), scan * 0.6);
        }

        vec3 renderDayWorld(vec2 uv, float frame) {
            vec3 ro = vec3(0.0, 1.64, frame * 0.052 - 6.2);
            ro.x += sin(frame * 0.014) * 0.10;
            vec3 rd = getRay(uv, frame, 0.0);
            vec3 color = skyColor(uv, frame, 0.0);

            float bestT = 1.0e6;
            vec3 bestNormal = vec3(0.0, 1.0, 0.0);
            vec3 bestPoint = vec3(0.0);
            vec2 bestCell = vec2(0.0);
            float bestSeed = 0.0;
            float bestEdgeCarryMask = 0.0;
            float hitKind = 0.0;

            if (rd.y < -0.015) {
                float tGround = -ro.y / rd.y;
                if (tGround > 0.0) {
                    bestT = tGround;
                    bestPoint = ro + rd * tGround;
                    bestNormal = vec3(0.0, 1.0, 0.0);
                    bestEdgeCarryMask = 0.0;
                    hitKind = 1.0;
                }
            }

            float baseRow = floor((ro.z - 6.0) / 1.95);
            for (int r = 0; r < 18; r++) {
                float rowId = baseRow + float(r);
                float z = 2.1 + rowId * 1.95;
                for (int c = 0; c < 13; c++) {
                    float col = float(c) - 6.0;
                    if (abs(col) < 1.35) continue;

                    float seed = hash(vec2(col * 3.1, rowId));
                    float x = col * 0.98 + (seed - 0.5) * 0.36;
                    float sx = mix(0.30, 0.62, hash(vec2(col, rowId + 3.0)));
                    float sz = mix(0.44, 0.88, hash(vec2(col + 5.0, rowId)));
                    float h = mix(1.0, 6.2, seed) + step(0.80, seed) * 1.4;

                    vec3 n;
                    float edgeCarryMask;
                    float t = boxHit(ro, rd, vec3(x - sx, 0.0, z - sz), vec3(x + sx, h, z + sz), n, edgeCarryMask);
                    if (t < bestT) {
                        bestT = t;
                        bestNormal = n;
                        bestPoint = ro + rd * t;
                        bestCell = vec2(col, rowId);
                        bestSeed = seed;
                        bestEdgeCarryMask = edgeCarryMask;
                        hitKind = 2.0;
                    }

                    if (r < 11) {
                        vec3 nt;
                        float tierEdgeCarryMask;
                        vec3 tierMin = vec3(x - sx * 0.62, h, z - sz * 0.62);
                        vec3 tierMax = vec3(x + sx * 0.62, h + mix(0.20, 0.72, hash(vec2(rowId, col + 12.0))), z + sz * 0.62);
                        float tt = boxHit(ro, rd, tierMin, tierMax, nt, tierEdgeCarryMask);
                        if (tt < bestT && seed > 0.34) {
                            bestT = tt;
                            bestNormal = nt;
                            bestPoint = ro + rd * tt;
                            bestCell = vec2(col, rowId);
                            bestSeed = seed;
                            bestEdgeCarryMask = tierEdgeCarryMask;
                            hitKind = 2.0;
                        }

                        vec3 np;
                        float podEdgeCarryMask;
                        float sideDir = sign(col);
                        vec3 podMin = vec3(x + sideDir * sx * 0.62 - sx * 0.28, h * 0.28, z - sz * 0.18);
                        vec3 podMax = vec3(x + sideDir * sx * 0.62 + sx * 0.28, h * 0.58, z + sz * 0.18);
                        float tp = boxHit(ro, rd, podMin, podMax, np, podEdgeCarryMask);
                        if (tp < bestT && seed > 0.44) {
                            bestT = tp;
                            bestNormal = np;
                            bestPoint = ro + rd * tp;
                            bestCell = vec2(col + sideDir * 0.25, rowId);
                            bestSeed = seed + 0.17;
                            bestEdgeCarryMask = podEdgeCarryMask;
                            hitKind = 2.0;
                        }
                    }
                }
            }

            if (hitKind > 1.5) {
                color = dayBuildingColor(bestPoint, bestNormal, bestCell, bestSeed, bestT);
            } else if (hitKind > 0.5) {
                color = dayGroundColor(bestPoint, frame);
                color = mix(color, DAY_FOG, smoothstep(18.0, 48.0, bestT));
            }

            if (hitKind > 0.5 && bestT < 34.0) {
                color = applyDaySurfaceCircuits(color, bestPoint, bestNormal, bestEdgeCarryMask);
            }

            float horizonGlow = exp(-abs(uv.y - 0.49) * 12.0);
            color += vec3(1.0, 0.82, 0.45) * 0.035 * horizonGlow;
            return color;
        }

        vec3 renderNightWorld(vec2 uv, float frame) {
            vec3 ro = vec3(0.0, 1.44 + sin(frame * 0.018) * 0.05, frame * 0.070 - 6.8);
            ro.x += sin(frame * 0.012) * 0.28;
            vec3 rd = getRay(uv, frame, 1.0);
            vec3 color = skyColor(uv, frame, 1.0);

            float bestT = 1.0e6;
            vec3 bestNormal = vec3(0.0, 1.0, 0.0);
            vec3 bestPoint = vec3(0.0);
            vec2 bestId = vec2(0.0);
            float bestSeed = 0.0;
            float tGround = 1.0e6;
            vec3 groundPoint = vec3(0.0);
            if (rd.y < -0.012) {
                tGround = -ro.y / rd.y;
                if (tGround > 0.0) {
                    groundPoint = ro + rd * tGround;
                } else {
                    tGround = 1.0e6;
                }
            }

            float baseRow = floor((ro.z - 8.0) / 5.2);
            for (int r = 0; r < 10; r++) {
                float rowId = baseRow + float(r);
                float z = 5.0 + rowId * 5.2;
                for (int c = 0; c < 7; c++) {
                    float col = float(c) - 3.0;
                    float seed = hash(vec2(col * 5.3, rowId));
                    float x = col * 1.55 + sin(rowId * 1.7 + frame * 0.010) * 0.34;
                    float y = mix(-0.85, 5.4, hash(vec2(rowId, col + 8.0)));
                    vec3 size = vec3(
                        mix(0.12, 0.46, seed),
                        mix(0.10, 0.62, hash(vec2(rowId + 4.0, col))),
                        mix(0.12, 0.68, hash(vec2(col + 2.0, rowId + 6.0)))
                    );
                    if (abs(col) < 0.7 && seed < 0.78) continue;
                    if (seed < 0.28) continue;

                    vec3 n;
                    float edgeCarryMask;
                    float t = boxHit(ro, rd, vec3(x - size.x, y - size.y, z - size.z), vec3(x + size.x, y + size.y, z + size.z), n, edgeCarryMask);
                    if (t < bestT) {
                        bestT = t;
                        bestNormal = n;
                        bestPoint = ro + rd * t;
                        bestId = vec2(col, rowId);
                        bestSeed = seed;
                    }
                }
            }

            if (bestT < 1.0e5) {
                color = spaceObjectColor(bestPoint, bestNormal, bestId, bestSeed, frame);
                color = mix(color, NIGHT_FOG, smoothstep(18.0, 44.0, bestT));
            }

            if (tGround < 1.0e5) {
                vec3 grid = nightGroundColor(groundPoint, frame);
                float alpha = 0.14 + vaporMask(groundPoint, frame) * 0.72;
                color = mix(color, grid, alpha);
                color += mix(PINK, CYAN, 0.42) * vaporMask(groundPoint, frame) * 0.08;
                color = mix(color, NIGHT_FOG, smoothstep(16.0, 38.0, tGround) * 0.48);
            }

            float horizonGlow = exp(-abs(uv.y - 0.47) * 9.5);
            color += mix(PINK, CYAN, 0.38) * 0.18 * horizonGlow;
            return color;
        }

        void main() {
            vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
            uv += vec2(sin(u_frame * 0.034) * 0.0012, cos(u_frame * 0.027) * 0.0010);
            vec3 color = u_dark < 0.5 ? renderDayWorld(uv, u_frame) : renderNightWorld(uv, u_frame);
            float vignette = 1.0 - smoothstep(0.22, 0.98, distance(v_uv, vec2(0.5)));
            color *= u_dark < 0.5 ? (0.985 + vignette * 0.030) : (0.68 + vignette * 0.46);
            color = pow(max(color, 0.0), vec3(u_dark < 0.5 ? 1.02 : 0.92));
            gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
        }
    `;

    const program = createShaderProgram(gl, vertexSource, fragmentSource);
    if (!program) return null;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]), gl.STATIC_DRAW);

    return {
        canvas,
        gl,
        program,
        buffer,
        positionLocation: gl.getAttribLocation(program, 'a_position'),
        frameLocation: gl.getUniformLocation(program, 'u_frame'),
        resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
        darkLocation: gl.getUniformLocation(program, 'u_dark')
    };
}

function renderBackgroundShader(shader, frame) {
    if (!shader) return false;

    const { gl, program, buffer } = shader;
    gl.viewport(0, 0, shader.canvas.width, shader.canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(shader.positionLocation);
    gl.vertexAttribPointer(shader.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(shader.frameLocation, frame);
    gl.uniform2f(shader.resolutionLocation, shader.canvas.width, shader.canvas.height);
    gl.uniform1f(shader.darkLocation, document.body.classList.contains('dark-theme') ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
}

export function createStageBackground() {
    const staticLayer = document.createElement('canvas');
    staticLayer.width = GAME_CONSTANTS.SCREEN.WIDTH;
    staticLayer.height = GAME_CONSTANTS.SCREEN.HEIGHT;
    const sctx = staticLayer.getContext('2d');

    const stars = Array.from({ length: GAME_CONSTANTS.BACKGROUND.STAR_COUNT }, () => ({
        x: Math.random() * GAME_CONSTANTS.SCREEN.WIDTH,
        y: Math.random() * GAME_CONSTANTS.SCREEN.HEIGHT,
        radius: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 16 + 10,
        alpha: Math.random() * 0.5 + 0.15,
        drift: Math.random() * 18 + 6,
        phase: Math.random() * Math.PI * 2
    }));

    const petals = Array.from({ length: GAME_CONSTANTS.BACKGROUND.PETAL_COUNT }, () => ({
        x: Math.random() * GAME_CONSTANTS.SCREEN.WIDTH,
        y: Math.random() * GAME_CONSTANTS.SCREEN.HEIGHT,
        radius: Math.random() * 8 + 5,
        speed: Math.random() * 24 + 14,
        sway: Math.random() * 24 + 18,
        alpha: Math.random() * 0.15 + 0.06,
        rotation: Math.random() * Math.PI * 2
    }));

    const ribbons = Array.from({ length: 4 }, (_, index) => ({
        baseY: 90 + index * 108,
        amplitude: 12 + index * 5,
        speed: 0.18 + index * 0.05,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.07 + index * 0.02,
        hue: 198 + index * 16
    }));

    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 160;
    patternCanvas.height = 160;
    const pctx = patternCanvas.getContext('2d');

    pctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
    pctx.strokeStyle = 'rgba(130, 170, 210, 0.10)';
    pctx.lineWidth = 1;
    for (let i = -40; i < 200; i += 20) {
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(i + 80, 160);
        pctx.stroke();
    }

    pctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    for (let y = 20; y < 160; y += 40) {
        for (let x = 20; x < 160; x += 40) {
            pctx.beginPath();
            pctx.arc(x, y, 2.4, 0, Math.PI * 2);
            pctx.fill();
        }
    }

    const baseGradient = sctx.createLinearGradient(0, 0, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
    baseGradient.addColorStop(0, '#f9fbff');
    baseGradient.addColorStop(0.28, '#eef3f8');
    baseGradient.addColorStop(0.62, '#dce3ea');
    baseGradient.addColorStop(1, '#cbd3dc');
    sctx.fillStyle = baseGradient;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);

    const horizonGlow = sctx.createRadialGradient(
        GAME_CONSTANTS.SCREEN.WIDTH * 0.52,
        GAME_CONSTANTS.SCREEN.HEIGHT * 0.58,
        30,
        GAME_CONSTANTS.SCREEN.WIDTH * 0.52,
        GAME_CONSTANTS.SCREEN.HEIGHT * 0.58,
        360
    );
    horizonGlow.addColorStop(0, 'rgba(255, 210, 120, 0.22)');
    horizonGlow.addColorStop(0.42, 'rgba(90, 145, 220, 0.10)');
    horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = horizonGlow;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);

    const pattern = sctx.createPattern(patternCanvas, 'repeat');
    sctx.save();
    sctx.globalAlpha = 0.16;
    sctx.fillStyle = pattern;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
    sctx.restore();

    sctx.save();
    const sun = sctx.createRadialGradient(
        GAME_CONSTANTS.SCREEN.WIDTH * 0.72,
        GAME_CONSTANTS.SCREEN.HEIGHT * 0.18,
        8,
        GAME_CONSTANTS.SCREEN.WIDTH * 0.72,
        GAME_CONSTANTS.SCREEN.HEIGHT * 0.18,
        140
    );
    sun.addColorStop(0, 'rgba(255, 248, 204, 0.95)');
    sun.addColorStop(0.22, 'rgba(255, 216, 120, 0.24)');
    sun.addColorStop(1, 'rgba(255, 216, 120, 0)');
    sctx.fillStyle = sun;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
    sctx.restore();

    sctx.save();
    sctx.strokeStyle = 'rgba(95, 115, 135, 0.10)';
    sctx.lineWidth = 1;
    for (let y = 80; y < GAME_CONSTANTS.SCREEN.HEIGHT; y += 64) {
        sctx.beginPath();
        sctx.moveTo(0, y);
        sctx.bezierCurveTo(
            GAME_CONSTANTS.SCREEN.WIDTH * 0.25, y - 16,
            GAME_CONSTANTS.SCREEN.WIDTH * 0.75, y + 18,
            GAME_CONSTANTS.SCREEN.WIDTH, y - 6
        );
        sctx.stroke();
    }
    sctx.restore();

    sctx.save();
    sctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    sctx.lineWidth = 2;
    sctx.strokeRect(14, 14, GAME_CONSTANTS.SCREEN.WIDTH - 28, GAME_CONSTANTS.SCREEN.HEIGHT - 28);
    sctx.strokeStyle = 'rgba(100, 130, 160, 0.12)';
    sctx.strokeRect(28, 28, GAME_CONSTANTS.SCREEN.WIDTH - 56, GAME_CONSTANTS.SCREEN.HEIGHT - 56);
    sctx.strokeStyle = 'rgba(236, 72, 94, 0.10)';
    sctx.lineWidth = 1;
    sctx.strokeRect(42, 42, GAME_CONSTANTS.SCREEN.WIDTH - 84, GAME_CONSTANTS.SCREEN.HEIGHT - 84);
    sctx.restore();

    sctx.save();
    const floorGradient = sctx.createLinearGradient(0, GAME_CONSTANTS.SCREEN.HEIGHT * 0.66, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
    floorGradient.addColorStop(0, 'rgba(126, 163, 255, 0)');
    floorGradient.addColorStop(0.28, 'rgba(145, 156, 168, 0.12)');
    floorGradient.addColorStop(1, 'rgba(105, 118, 132, 0.18)');
    sctx.fillStyle = floorGradient;
    sctx.fillRect(0, GAME_CONSTANTS.SCREEN.HEIGHT * 0.66, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT * 0.34);
    sctx.restore();

    return {
        stars,
        petals,
        ribbons,
        moon: {
            x: GAME_CONSTANTS.SCREEN.WIDTH * 0.74,
            y: 116,
            radius: 42
        },
        horizonY: GAME_CONSTANTS.SCREEN.HEIGHT * 0.56,
        shader: createBackgroundShader(),
        staticLayer
    };
}

export function drawBloom(ctx, x, y, radius, color, alpha = 1) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawMoonbow(ctx, moon, frame) {
    const pulse = 0.72 + Math.sin(frame * 0.015) * 0.08;
    const rings = [
        ['rgba(239, 71, 111, 0.14)', moon.radius + 28],
        ['rgba(255, 209, 102, 0.11)', moon.radius + 39],
        ['rgba(6, 214, 160, 0.10)', moon.radius + 52],
        ['rgba(17, 138, 178, 0.13)', moon.radius + 67]
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    rings.forEach(([color, radius], index) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 6 - index * 0.8;
        ctx.beginPath();
        ctx.arc(
            moon.x + Math.sin(frame * 0.0075 + index) * 1.4,
            moon.y + Math.cos(frame * 0.006 + index) * 1.2,
            radius * pulse,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    });
    ctx.restore();
}

function drawMoon(ctx, moon, frame) {
    drawMoonbow(ctx, moon, frame);

    const glow = ctx.createRadialGradient(moon.x, moon.y, moon.radius * 0.35, moon.x, moon.y, moon.radius * 3.5);
    glow.addColorStop(0, 'rgba(241, 251, 255, 0.36)');
    glow.addColorStop(0.32, 'rgba(184, 228, 255, 0.18)');
    glow.addColorStop(0.62, 'rgba(255, 209, 102, 0.07)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.radius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    const moonGradient = ctx.createRadialGradient(
        moon.x - moon.radius * 0.32,
        moon.y - moon.radius * 0.38,
        moon.radius * 0.2,
        moon.x,
        moon.y,
        moon.radius
    );
    moonGradient.addColorStop(0, '#ffffff');
    moonGradient.addColorStop(0.46, '#edf7fb');
    moonGradient.addColorStop(0.78, '#cfdde6');
    moonGradient.addColorStop(1, '#93aab9');

    ctx.save();
    ctx.fillStyle = moonGradient;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();

    const craters = [
        [-15, -11, 8, 0.16],
        [10, -18, 5, 0.13],
        [15, 6, 9, 0.15],
        [-4, 15, 6, 0.12],
        [-22, 13, 4, 0.12]
    ];
    craters.forEach(([dx, dy, radius, alpha]) => {
        const crater = ctx.createRadialGradient(moon.x + dx - radius * 0.35, moon.y + dy - radius * 0.35, 1, moon.x + dx, moon.y + dy, radius);
        crater.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        crater.addColorStop(1, `rgba(57, 83, 102, ${alpha + 0.08})`);
        ctx.fillStyle = crater;
        ctx.beginPath();
        ctx.arc(moon.x + dx, moon.y + dy, radius, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

function drawVaporwaveGrid(ctx, width, height, horizonY, frame) {
    const vanishingX = width * 0.5 + Math.sin(frame * 0.0075) * 18;
    const floorTop = horizonY;
    const speed = (frame * 1.53) % 42;

    const floorGradient = ctx.createLinearGradient(0, floorTop, 0, height);
    floorGradient.addColorStop(0, 'rgba(7, 59, 76, 0)');
    floorGradient.addColorStop(0.36, 'rgba(17, 138, 178, 0.12)');
    floorGradient.addColorStop(1, 'rgba(239, 71, 111, 0.18)');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, floorTop, width, height - floorTop);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const y = floorTop + Math.pow(t, 2.25) * (height - floorTop + 80) + speed * (0.22 + t);
        if (y > height + 20) continue;

        const alpha = 0.14 + t * 0.42;
        ctx.strokeStyle = `rgba(6, 214, 160, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    for (let lane = -9; lane <= 9; lane++) {
        const bottomX = width * 0.5 + lane * 62 + Math.sin(frame * 0.012 + lane) * 4;
        const alpha = 0.16 + (1 - Math.abs(lane) / 10) * 0.26;
        ctx.strokeStyle = `rgba(17, 138, 178, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(vanishingX, floorTop);
        ctx.lineTo(bottomX, height + 34);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 209, 102, 0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorTop);
    ctx.lineTo(width, floorTop);
    ctx.stroke();

    ctx.restore();
}

function drawSpeedHaze(ctx, width, height, frame) {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (isDarkTheme ? 12 : 7); i++) {
        const x = (i * 73 + frame * 0.63) % (width + 120) - 60;
        const y = 120 + ((i * 41 + frame * 0.9) % 430);
        const length = isDarkTheme ? 40 + (i % 4) * 18 : 24 + (i % 3) * 14;
        const color = isDarkTheme
            ? (i % 2 ? '255, 46, 132' : '6, 214, 160')
            : (i % 3 === 0 ? '236, 72, 94' : i % 3 === 1 ? '20, 112, 225' : '242, 179, 42');
        ctx.strokeStyle = `rgba(${color}, ${isDarkTheme ? 0.08 : 0.045})`;
        ctx.lineWidth = isDarkTheme ? 1 + (i % 3) : 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + length, y + length * (isDarkTheme ? 0.35 : 0.16));
        ctx.stroke();
    }
    ctx.restore();
}

export function renderBackground(ctx, background, frame, bulletCount, isDarkTheme) {
    const width = GAME_CONSTANTS.SCREEN.WIDTH;
    const height = GAME_CONSTANTS.SCREEN.HEIGHT;
    const heavyEffectsEnabled = bulletCount < GAME_CONSTANTS.PERFORMANCE.BACKGROUND_EFFECT_BULLET_THRESHOLD;
    const shakeX = Math.sin(frame * 0.035) * 1.4 + Math.sin(frame * 0.088) * 0.35;
    const shakeY = Math.cos(frame * 0.028) * 1.1;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (renderBackgroundShader(background.shader, frame)) {
        ctx.drawImage(background.shader.canvas, -6, -6, width + 12, height + 12);
        ctx.restore();
        return;
    } else {
        ctx.drawImage(background.staticLayer, -6, -6, width + 12, height + 12);
        if (isDarkTheme) {
            drawMoon(ctx, background.moon, frame);
            drawVaporwaveGrid(ctx, width, height, background.horizonY, frame);
        }
    }

    if (heavyEffectsEnabled) {
        drawSpeedHaze(ctx, width, height, frame);
        if (isDarkTheme) {
            drawBloom(ctx, width * 0.5, height * 0.22, 260, 'rgba(18, 96, 255, 0.14)', 1);
            drawBloom(ctx, width * 0.5, height * 0.86, 220, 'rgba(255, 46, 132, 0.14)', 1);
            drawBloom(ctx, width * 0.74, 118, 120, 'rgba(6, 214, 160, 0.10)', 1);
        } else {
            drawBloom(ctx, width * 0.73, height * 0.18, 180, 'rgba(255, 214, 102, 0.16)', 1);
            drawBloom(ctx, width * 0.30, height * 0.74, 170, 'rgba(24, 124, 255, 0.06)', 1);
        }
    }

    if (isDarkTheme) {
        background.ribbons.forEach((ribbon, index) => {
            ctx.save();
            ctx.strokeStyle = `hsla(${ribbon.hue}, 100%, 72%, ${ribbon.alpha})`;
            ctx.lineWidth = 14 - index * 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let x = -40; x <= width + 40; x += 40) {
                const waveY = ribbon.baseY +
                    Math.sin(x * 0.014 + frame * (0.018 + ribbon.speed * 0.01) + ribbon.phase) * ribbon.amplitude +
                    Math.sin(x * 0.028 - frame * 0.013 + ribbon.phase) * (ribbon.amplitude * 0.35);
                if (x === -40) {
                    ctx.moveTo(x, waveY);
                } else {
                    ctx.lineTo(x, waveY);
                }
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    if (isDarkTheme) {
        background.stars.forEach((star) => {
            const x = (star.x + Math.sin(frame * 0.017 + star.phase) * star.drift + width) % width;
            const y = (star.y + frame * star.speed * 0.016) % height;
            const twinkle = 0.55 + 0.45 * Math.sin(frame * 0.04 + star.phase);
            ctx.fillStyle = `rgba(214, 236, 255, ${star.alpha * twinkle})`;
            ctx.beginPath();
            ctx.arc(x, y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    if (!heavyEffectsEnabled) {
        ctx.restore();
        return;
    }

    background.petals.forEach((petal, index) => {
        const y = (petal.y + frame * petal.speed * 0.016) % (height + 30) - 15;
        const x = petal.x + Math.sin(frame * 0.015 + index) * petal.sway;
        const rotation = petal.rotation + frame * 0.012;
        const accentColors = isDarkTheme
            ? ['rgba(255, 46, 132, 0.82)', 'rgba(42, 130, 255, 0.78)', 'rgba(6, 214, 160, 0.74)']
            : ['rgba(236, 72, 94, 0.18)', 'rgba(20, 112, 225, 0.16)', 'rgba(242, 179, 42, 0.14)'];
        ctx.save();
        ctx.globalAlpha = isDarkTheme ? petal.alpha * 0.90 : petal.alpha * 0.45;
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = accentColors[index % accentColors.length];
        ctx.beginPath();
        if (isDarkTheme) {
            ctx.moveTo(0, -petal.radius);
            ctx.lineTo(petal.radius * 0.55, 0);
            ctx.lineTo(0, petal.radius);
            ctx.lineTo(-petal.radius * 0.55, 0);
        } else {
            ctx.arc(0, 0, Math.max(1.2, petal.radius * 0.20), 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    });

    ctx.restore();
}
