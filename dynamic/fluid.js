const dom = {
    fluidCanvas: document.getElementById('fluidCanvas'),
    isingCanvas: document.getElementById('isingCanvas'),
    simulationSelect: document.getElementById('simulationSelect'),
    controlsTitle: document.getElementById('controlsTitle'),
    hint: document.getElementById('hint'),
    fpsNumber: document.querySelector('#fps .number'),
    togglePanel: document.getElementById('togglePanel'),
    controlsPanel: document.querySelector('.controls'),
    modeSections: document.querySelectorAll('.mode-section')
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const format = (value, digits) => Number(value).toFixed(digits);

const shapeHelpersGLSL = `
bool pointInShape(vec2 uv, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = uv - center;
    p.x *= aspectRatio;

    if (shape < 0.5) {
        return length(p) <= radius;
    }

    if (shape < 1.5) {
        vec2 d = abs(p);
        return d.x <= radius && d.y <= radius;
    }

    float h = radius * 1.7320508;
    float halfBase = radius * 0.57735026;

    if (p.y < -radius || p.y > h - radius) {
        return false;
    }

    float yFromBase = p.y + radius;
    float maxX = mix(halfBase, 0.0, clamp(yFromBase / h, 0.0, 1.0));
    return abs(p.x) <= maxX;
}

float distToShapeEdge(vec2 uv, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = uv - center;
    p.x *= aspectRatio;

    if (shape < 0.5) {
        return abs(length(p) - radius);
    }

    if (shape < 1.5) {
        vec2 d = abs(p) - vec2(radius);
        float outside = length(max(d, 0.0));
        float inside = min(max(d.x, d.y), 0.0);
        return abs(outside + inside);
    }

    float h = radius * 1.7320508;
    float halfBase = radius * 0.57735026;
    vec2 p0 = vec2(-halfBase, -radius);
    vec2 p1 = vec2(halfBase, -radius);
    vec2 p2 = vec2(0.0, h - radius);

    vec2 e0 = p1 - p0;
    vec2 e1 = p2 - p1;
    vec2 e2 = p0 - p2;

    vec2 v0 = p - p0;
    vec2 v1 = p - p1;
    vec2 v2 = p - p2;

    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);

    return sqrt(min(min(dot(pq0, pq0), dot(pq1, pq1)), dot(pq2, pq2)));
}
`;

class FluidSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });
        this.supported = Boolean(this.gl);
        this.maxObstacles = 32;
        this.preview = { x: 0.5, y: 0.5, radius: 0.05, shape: 0 };
        this.obstacles = [];
        this.config = {
            flowSpeed: 2.4,
            viscosity: 0.0008,
            vorticity: 0.45,
            pressureIterations: 18,
            showArrows: true,
            showStreamlines: true
        };

        if (!this.supported) {
            return;
        }

        const gl = this.gl;
        gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('OES_texture_float_linear');
        gl.disable(gl.BLEND);

        this.vertexShader = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

        this.addSourceFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform float u_time;
        uniform float u_dt;
        uniform float u_flowSpeed;
        uniform float u_vorticity;
        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;

            float inlet = exp(-pow(v_uv.x / 0.075, 2.0));
            float profile = 0.86 + 0.14 * cos((v_uv.y - 0.5) * 3.14159265);
            vel.x += (u_flowSpeed * profile - vel.x) * inlet * 0.28;
            vel.y *= 0.992;

            float noiseA = sin(v_uv.y * 28.0 + u_time * 1.9);
            float noiseB = sin(v_uv.y * 46.0 - u_time * 1.2);
            float shear = (noiseA * 0.65 + noiseB * 0.35) * u_vorticity;
            vel.y += inlet * shear * 0.06;

            float outflow = smoothstep(0.95, 1.0, v_uv.x);
            vel *= mix(0.9995, 0.985, outflow);

            outColor = vec4(vel, 0.0, 1.0);
        }`;

        this.advectFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_source;
        uniform vec2 u_texel;
        uniform float u_dt;
        uniform float u_dissipation;
        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;
            vec2 coord = clamp(v_uv - vel * u_dt * u_texel * 30.0, u_texel * 0.5, 1.0 - u_texel * 0.5);
            outColor = vec4(texture(u_source, coord).xy * u_dissipation, 0.0, 1.0);
        }`;

        this.divergenceFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform vec2 u_texel;
        void main() {
            float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.0)).x;
            float R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.0)).x;
            float B = texture(u_velocity, v_uv - vec2(0.0, u_texel.y)).y;
            float T = texture(u_velocity, v_uv + vec2(0.0, u_texel.y)).y;
            float div = 0.5 * ((R - L) + (T - B));
            outColor = vec4(div, 0.0, 0.0, 1.0);
        }`;

        this.pressureFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_pressure;
        uniform sampler2D u_divergence;
        uniform vec2 u_texel;
        void main() {
            float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
            float R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
            float B = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
            float T = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
            float div = texture(u_divergence, v_uv).x;
            outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
        }`;

        this.gradientFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_pressure;
        uniform sampler2D u_velocity;
        uniform vec2 u_texel;
        void main() {
            float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
            float R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
            float B = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
            float T = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
            vec2 vel = texture(u_velocity, v_uv).xy - vec2(R - L, T - B) * 0.5;
            outColor = vec4(vel, 0.0, 1.0);
        }`;

        this.vorticityFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform vec2 u_texel;
        void main() {
            float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.0)).y;
            float R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.0)).y;
            float B = texture(u_velocity, v_uv - vec2(0.0, u_texel.y)).x;
            float T = texture(u_velocity, v_uv + vec2(0.0, u_texel.y)).x;
            float curl = 0.5 * ((R - L) - (T - B));
            outColor = vec4(curl, 0.0, 0.0, 1.0);
        }`;

        this.vorticityForceFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_curl;
        uniform vec2 u_texel;
        uniform float u_dt;
        uniform float u_strength;
        void main() {
            float L = abs(texture(u_curl, v_uv - vec2(u_texel.x, 0.0)).x);
            float R = abs(texture(u_curl, v_uv + vec2(u_texel.x, 0.0)).x);
            float B = abs(texture(u_curl, v_uv - vec2(0.0, u_texel.y)).x);
            float T = abs(texture(u_curl, v_uv + vec2(0.0, u_texel.y)).x);
            float C = texture(u_curl, v_uv).x;

            vec2 gradient = 0.5 * vec2(R - L, T - B);
            gradient /= max(length(gradient), 1e-4);
            vec2 force = vec2(gradient.y, -gradient.x) * C * u_strength;
            vec2 vel = texture(u_velocity, v_uv).xy + force * u_dt;
            outColor = vec4(vel, 0.0, 1.0);
        }`;

        this.obstacleFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_obstacleData;
        uniform int u_numObstacles;
        uniform float u_aspectRatio;
        ${shapeHelpersGLSL}
        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;
            bool inside = false;
            float nearestEdge = 1e6;
            vec2 nearestCenter = vec2(0.0);
            float nearestRadius = 0.0;

            for (int i = 0; i < 32; i++) {
                if (i >= u_numObstacles) {
                    break;
                }

                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                vec2 center = obstacleData.xy;
                float radius = obstacleData.z;
                float shape = obstacleData.w;

                if (pointInShape(v_uv, center, radius, shape, u_aspectRatio)) {
                    inside = true;
                }

                float edge = distToShapeEdge(v_uv, center, radius, shape, u_aspectRatio);
                if (edge < nearestEdge) {
                    nearestEdge = edge;
                    nearestCenter = center;
                    nearestRadius = radius;
                }
            }

            if (inside) {
                outColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            if (nearestRadius > 0.0 && nearestEdge < nearestRadius * 0.7) {
                vec2 normal = v_uv - nearestCenter;
                normal.x *= u_aspectRatio;
                float nlen = length(normal);
                if (nlen > 1e-4) {
                    normal /= nlen;
                    vec2 tangent = vec2(-normal.y, normal.x);
                    float normalVelocity = dot(vel, normal);
                    vel -= normal * max(normalVelocity, 0.0);
                    float tangentialSpeed = dot(vel, tangent);
                    float influence = 1.0 - smoothstep(0.0, nearestRadius * 0.7, nearestEdge);
                    float targetTangential = max(abs(tangentialSpeed), length(vel) * 0.55);
                    vel = mix(vel, tangent * sign(tangentialSpeed + 1e-4) * targetTangential, influence * 0.6);
                    vel *= 1.0 - influence * 0.28;
                }
            }

            outColor = vec4(vel, 0.0, 1.0);
        }`;

        this.streamlineFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_oldStreamlines;
        uniform sampler2D u_obstacleData;
        uniform int u_numObstacles;
        uniform vec2 u_texel;
        uniform float u_dt;
        uniform float u_aspectRatio;
        uniform float u_seedCount;
        uniform float u_seedStrength;
        ${shapeHelpersGLSL}
        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;
            vec2 coord = clamp(v_uv - vel * u_dt * u_texel * 36.0, u_texel * 0.5, 1.0 - u_texel * 0.5);
            float line = texture(u_oldStreamlines, coord).r * 0.968;

            bool inside = false;
            for (int i = 0; i < 32; i++) {
                if (i >= u_numObstacles) {
                    break;
                }
                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                if (pointInShape(v_uv, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                    inside = true;
                    break;
                }
            }

            if (inside) {
                outColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            float seedColumn = exp(-pow((v_uv.x - 0.03) / 0.015, 2.0));
            float row = abs(fract(v_uv.y * u_seedCount) - 0.5);
            float stripe = 1.0 - smoothstep(0.14, 0.48, row);
            float injection = seedColumn * stripe * smoothstep(0.05, 0.35, length(vel)) * u_seedStrength;
            float fadeOut = 1.0 - smoothstep(0.94, 1.0, v_uv.x);

            outColor = vec4(max(line, injection) * fadeOut, 0.0, 0.0, 1.0);
        }`;

        this.displayFS = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;
        uniform sampler2D u_velocity;
        uniform sampler2D u_streamlines;
        uniform sampler2D u_obstacleData;
        uniform int u_numObstacles;
        uniform float u_showArrows;
        uniform float u_showStreamlines;
        uniform vec2 u_previewPos;
        uniform float u_previewRadius;
        uniform float u_previewShape;
        uniform float u_aspectRatio;
        ${shapeHelpersGLSL}

        float sdArrow(vec2 p) {
            vec2 shaft = abs(p - vec2(0.12, 0.0)) - vec2(0.16, 0.05);
            float shaftDist = max(shaft.x, shaft.y);

            vec2 hp = p - vec2(0.24, 0.0);
            float d1 = dot(hp, normalize(vec2(0.13, 0.11))) - 0.108;
            float d2 = dot(hp, normalize(vec2(0.13, -0.11))) - 0.108;
            float d3 = -hp.x;
            float headDist = max(max(d1, d2), d3);

            return min(shaftDist, headDist);
        }

        vec3 speedColor(float speed) {
            float t = clamp(speed / 2.0, 0.0, 1.0);
            vec3 a = vec3(0.02, 0.06, 0.11);
            vec3 b = vec3(0.04, 0.36, 0.78);
            vec3 c = vec3(0.00, 0.80, 0.68);
            vec3 d = vec3(1.00, 0.72, 0.12);
            vec3 e = vec3(1.00, 0.28, 0.08);

            if (t < 0.3) return mix(a, b, t / 0.3);
            if (t < 0.6) return mix(b, c, (t - 0.3) / 0.3);
            if (t < 0.82) return mix(c, d, (t - 0.6) / 0.22);
            return mix(d, e, (t - 0.82) / 0.18);
        }

        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;
            float speed = length(vel);
            vec3 color = speedColor(speed);

            bool insideObstacle = false;
            float obstacleEdge = 1e6;

            for (int i = 0; i < 32; i++) {
                if (i >= u_numObstacles) {
                    break;
                }
                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                obstacleEdge = min(obstacleEdge, distToShapeEdge(v_uv, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio));
                if (pointInShape(v_uv, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                    insideObstacle = true;
                }
            }

            float aa = max(length(fwidth(v_uv)) * 2.0, 0.0015);

            if (insideObstacle) {
                vec3 fill = vec3(0.20, 0.28, 0.38);
                float rim = 1.0 - smoothstep(0.0, 0.01 + aa, obstacleEdge);
                color = mix(fill, vec3(0.60, 0.75, 0.92), rim * 0.45);
            } else {
                float shadow = 1.0 - smoothstep(0.0, 0.025, obstacleEdge);
                color = mix(color, vec3(0.04, 0.08, 0.14), shadow * 0.22);
            }

            if (u_showArrows > 0.5 && !insideObstacle) {
                vec2 gridSize = vec2(max(26.0, floor(26.0 * u_aspectRatio)), 26.0);
                vec2 cellCenter = (floor(v_uv * gridSize) + 0.5) / gridSize;
                bool cellBlocked = false;

                for (int i = 0; i < 32; i++) {
                    if (i >= u_numObstacles) {
                        break;
                    }
                    vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                    if (pointInShape(cellCenter, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                        cellBlocked = true;
                        break;
                    }
                }

                if (!cellBlocked) {
                    vec2 cellVel = texture(u_velocity, cellCenter).xy;
                    float cellSpeed = length(cellVel);
                    if (cellSpeed > 0.03) {
                        vec2 dir = normalize(cellVel);
                        vec2 local = (v_uv - cellCenter) * gridSize;
                        float angle = atan(dir.y, dir.x);
                        mat2 rot = mat2(cos(-angle), -sin(-angle), sin(-angle), cos(-angle));
                        float dist = sdArrow(rot * local);
                        float arrowAlpha = 1.0 - smoothstep(-0.03, 0.03, dist);
                        color = mix(color, vec3(0.96, 0.97, 1.0), arrowAlpha * 0.82);
                    }
                }
            }

            if (u_showStreamlines > 0.5 && !insideObstacle) {
                float line = texture(u_streamlines, v_uv).r;
                color = mix(color, vec3(1.0, 0.98, 0.86), clamp(line, 0.0, 1.0) * 0.75);
            }

            float previewEdge = distToShapeEdge(v_uv, u_previewPos, u_previewRadius, u_previewShape, u_aspectRatio);
            float previewLine = 1.0 - smoothstep(0.002, 0.004 + aa, previewEdge);
            color = mix(color, vec3(0.98, 0.99, 1.0), previewLine * 0.5);

            outColor = vec4(color, 1.0);
        }`;

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

        this.programs = {
            addSource: this.createProgram(this.vertexShader, this.addSourceFS),
            advect: this.createProgram(this.vertexShader, this.advectFS),
            divergence: this.createProgram(this.vertexShader, this.divergenceFS),
            pressure: this.createProgram(this.vertexShader, this.pressureFS),
            gradient: this.createProgram(this.vertexShader, this.gradientFS),
            vorticity: this.createProgram(this.vertexShader, this.vorticityFS),
            vorticityForce: this.createProgram(this.vertexShader, this.vorticityForceFS),
            obstacle: this.createProgram(this.vertexShader, this.obstacleFS),
            streamline: this.createProgram(this.vertexShader, this.streamlineFS),
            display: this.createProgram(this.vertexShader, this.displayFS)
        };

        this.createObstacleTexture();
        this.updateObstacleTexture();
        this.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
            gl.deleteShader(shader);
            throw new Error(message);
        }

        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program) || 'Unknown program link error';
            gl.deleteProgram(program);
            throw new Error(message);
        }

        return program;
    }

    createFBO(width, height, internalFormat = this.gl.RGBA16F, format = this.gl.RGBA, type = this.gl.HALF_FLOAT) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer incomplete');
        }

        return { texture, fbo, width, height };
    }

    createDoubleFBO(width, height) {
        const read = this.createFBO(width, height);
        const write = this.createFBO(width, height);
        return {
            read,
            write,
            swap() {
                const temp = this.read;
                this.read = this.write;
                this.write = temp;
            }
        };
    }

    deleteFBO(target) {
        if (!target) {
            return;
        }

        const gl = this.gl;
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.fbo);
    }

    deleteDoubleFBO(target) {
        if (!target) {
            return;
        }
        this.deleteFBO(target.read);
        this.deleteFBO(target.write);
    }

    clearTarget(target) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
        gl.viewport(0, 0, target ? target.width : this.canvas.width, target ? target.height : this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    blit(program, destination, uniforms) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination ? destination.fbo : null);
        gl.viewport(0, 0, destination ? destination.width : this.canvas.width, destination ? destination.height : this.canvas.height);
        gl.useProgram(program);

        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        let textureUnit = 0;
        for (const [name, value] of Object.entries(uniforms || {})) {
            const loc = gl.getUniformLocation(program, name);
            if (loc == null) {
                continue;
            }

            if (typeof value === 'number') {
                if (name === 'u_numObstacles') {
                    gl.uniform1i(loc, value);
                } else {
                    gl.uniform1f(loc, value);
                }
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length === 2) {
                    gl.uniform2f(loc, value[0], value[1]);
                } else if (value.length === 3) {
                    gl.uniform3f(loc, value[0], value[1], value[2]);
                } else if (value.length === 4) {
                    gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
                }
                continue;
            }

            const texture = value.texture || value;
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(loc, textureUnit);
            textureUnit += 1;
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    createObstacleTexture() {
        const gl = this.gl;
        this.obstacleDataArray = new Float32Array(this.maxObstacles * 4);
        this.obstacleDataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.obstacleDataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.maxObstacles, 1, 0, gl.RGBA, gl.FLOAT, this.obstacleDataArray);
    }

    updateObstacleTexture() {
        if (!this.supported) {
            return;
        }

        this.obstacleDataArray.fill(0);
        for (let i = 0; i < this.obstacles.length && i < this.maxObstacles; i += 1) {
            const obstacle = this.obstacles[i];
            const offset = i * 4;
            this.obstacleDataArray[offset] = obstacle.x;
            this.obstacleDataArray[offset + 1] = obstacle.y;
            this.obstacleDataArray[offset + 2] = obstacle.radius;
            this.obstacleDataArray[offset + 3] = obstacle.shape;
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.obstacleDataTexture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.maxObstacles, 1, gl.RGBA, gl.FLOAT, this.obstacleDataArray);
    }

    resize(width, height, dpr) {
        if (!this.supported) {
            return;
        }

        const displayWidth = Math.max(1, Math.floor(width * Math.min(dpr, 2)));
        const displayHeight = Math.max(1, Math.floor(height * Math.min(dpr, 2)));
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        const simScale = clamp(700 / Math.max(displayWidth, displayHeight), 0.34, 0.55);
        const simWidth = Math.max(128, Math.floor(displayWidth * simScale));
        const simHeight = Math.max(72, Math.floor(displayHeight * simScale));

        this.deleteDoubleFBO(this.velocity);
        this.deleteDoubleFBO(this.pressure);
        this.deleteDoubleFBO(this.streamlines);
        this.deleteFBO(this.divergence);
        this.deleteFBO(this.curl);

        this.velocity = this.createDoubleFBO(simWidth, simHeight);
        this.pressure = this.createDoubleFBO(simWidth, simHeight);
        this.streamlines = this.createDoubleFBO(simWidth, simHeight);
        this.divergence = this.createFBO(simWidth, simHeight);
        this.curl = this.createFBO(simWidth, simHeight);
        this.reset();
    }

    reset() {
        if (!this.supported) {
            return;
        }

        this.clearTarget(this.velocity.read);
        this.clearTarget(this.velocity.write);
        this.clearTarget(this.pressure.read);
        this.clearTarget(this.pressure.write);
        this.clearTarget(this.streamlines.read);
        this.clearTarget(this.streamlines.write);
        this.clearTarget(this.divergence);
        this.clearTarget(this.curl);
    }

    resetStreamlines() {
        if (!this.supported || !this.streamlines) {
            return;
        }

        this.clearTarget(this.streamlines.read);
        this.clearTarget(this.streamlines.write);
    }

    setPreview(x, y, radius, shape) {
        this.preview.x = clamp(x, 0, 1);
        this.preview.y = clamp(y, 0, 1);
        this.preview.radius = radius;
        this.preview.shape = shape;
    }

    addObstacle(x, y, radius, shape) {
        if (this.obstacles.length >= this.maxObstacles) {
            return;
        }

        this.obstacles.push({
            x: clamp(x, 0, 1),
            y: clamp(y, 0, 1),
            radius,
            shape
        });

        this.updateObstacleTexture();
        this.resetStreamlines();
    }

    removeNearestObstacle(x, y) {
        if (this.obstacles.length === 0) {
            return;
        }

        const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
        let nearestIndex = -1;
        let nearestDistance = Infinity;

        for (let i = 0; i < this.obstacles.length; i += 1) {
            const obstacle = this.obstacles[i];
            const dx = (obstacle.x - x) * aspect;
            const dy = obstacle.y - y;
            const distance = Math.hypot(dx, dy);

            if (distance < nearestDistance && distance < obstacle.radius * 1.6) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        if (nearestIndex >= 0) {
            this.obstacles.splice(nearestIndex, 1);
            this.updateObstacleTexture();
            this.resetStreamlines();
        }
    }

    clearObstacles() {
        this.obstacles.length = 0;
        this.updateObstacleTexture();
        this.resetStreamlines();
    }

    step(dt) {
        if (!this.supported) {
            return;
        }

        const gl = this.gl;
        const texel = [1 / this.velocity.read.width, 1 / this.velocity.read.height];
        const aspectRatio = this.canvas.width / Math.max(this.canvas.height, 1);
        const time = performance.now() * 0.001;

        this.blit(this.programs.addSource, this.velocity.write, {
            u_velocity: this.velocity.read,
            u_time: time,
            u_dt: dt,
            u_flowSpeed: this.config.flowSpeed,
            u_vorticity: this.config.vorticity
        });
        this.velocity.swap();

        this.blit(this.programs.obstacle, this.velocity.write, {
            u_velocity: this.velocity.read,
            u_obstacleData: this.obstacleDataTexture,
            u_numObstacles: this.obstacles.length,
            u_aspectRatio: aspectRatio
        });
        this.velocity.swap();

        this.blit(this.programs.vorticity, this.curl, {
            u_velocity: this.velocity.read,
            u_texel: texel
        });

        this.blit(this.programs.vorticityForce, this.velocity.write, {
            u_velocity: this.velocity.read,
            u_curl: this.curl,
            u_texel: texel,
            u_dt: dt,
            u_strength: this.config.vorticity * 18.0
        });
        this.velocity.swap();

        this.blit(this.programs.advect, this.velocity.write, {
            u_velocity: this.velocity.read,
            u_source: this.velocity.read,
            u_texel: texel,
            u_dt: dt,
            u_dissipation: 1.0 - clamp(this.config.viscosity * 18.0, 0.0, 0.09)
        });
        this.velocity.swap();

        this.clearTarget(this.pressure.read);
        this.clearTarget(this.pressure.write);

        this.blit(this.programs.divergence, this.divergence, {
            u_velocity: this.velocity.read,
            u_texel: texel
        });

        for (let i = 0; i < this.config.pressureIterations; i += 1) {
            this.blit(this.programs.pressure, this.pressure.write, {
                u_pressure: this.pressure.read,
                u_divergence: this.divergence,
                u_texel: texel
            });
            this.pressure.swap();
        }

        this.blit(this.programs.gradient, this.velocity.write, {
            u_pressure: this.pressure.read,
            u_velocity: this.velocity.read,
            u_texel: texel
        });
        this.velocity.swap();

        if (this.config.showStreamlines) {
            this.blit(this.programs.streamline, this.streamlines.write, {
                u_velocity: this.velocity.read,
                u_oldStreamlines: this.streamlines.read,
                u_obstacleData: this.obstacleDataTexture,
                u_numObstacles: this.obstacles.length,
                u_texel: texel,
                u_dt: dt,
                u_aspectRatio: aspectRatio,
                u_seedCount: 42.0,
                u_seedStrength: 0.95
            });
            this.streamlines.swap();
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render() {
        if (!this.supported) {
            return;
        }

        const aspectRatio = this.canvas.width / Math.max(this.canvas.height, 1);
        this.blit(this.programs.display, null, {
            u_velocity: this.velocity.read,
            u_streamlines: this.streamlines.read,
            u_obstacleData: this.obstacleDataTexture,
            u_numObstacles: this.obstacles.length,
            u_showArrows: this.config.showArrows ? 1.0 : 0.0,
            u_showStreamlines: this.config.showStreamlines ? 1.0 : 0.0,
            u_previewPos: [this.preview.x, this.preview.y],
            u_previewRadius: this.preview.radius,
            u_previewShape: this.preview.shape,
            u_aspectRatio: aspectRatio
        });
    }

    update(dt) {
        this.step(dt);
        this.render();
    }
}

class IsingSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d', { alpha: false });
        this.config = {
            size: 192,
            coupling: 1,
            beta: 0.45,
            field: 0,
            sweepsPerSecond: 18
        };
        this.accumulator = 0;
        this.randomize();
    }

    resize(width, height, dpr) {
        const scale = Math.min(dpr || 1, 2);
        this.canvas.width = Math.max(1, Math.floor(width * scale));
        this.canvas.height = Math.max(1, Math.floor(height * scale));
        this.needsRender = true;
    }

    randomize() {
        const size = this.config.size;
        this.spins = new Int8Array(size * size);
        for (let i = 0; i < this.spins.length; i += 1) {
            this.spins[i] = Math.random() < 0.5 ? -1 : 1;
        }
        this.ensureOffscreen();
        this.needsRender = true;
    }

    ensureOffscreen() {
        const size = this.config.size;
        if (this.offscreen.width !== size || this.offscreen.height !== size) {
            this.offscreen.width = size;
            this.offscreen.height = size;
            this.imageData = this.offscreenCtx.createImageData(size, size);
        }
    }

    setSize(nextSize) {
        if (nextSize === this.config.size) {
            return;
        }
        this.config.size = nextSize;
        this.accumulator = 0;
        this.randomize();
    }

    flipAll() {
        for (let i = 0; i < this.spins.length; i += 1) {
            this.spins[i] = -this.spins[i];
        }
        this.needsRender = true;
    }

    getViewport() {
        const side = Math.min(this.canvas.width, this.canvas.height);
        return {
            side,
            offsetX: (this.canvas.width - side) * 0.5,
            offsetY: (this.canvas.height - side) * 0.5
        };
    }

    metropolisSweep() {
        const size = this.config.size;
        const attempts = size * size;
        const spins = this.spins;
        const beta = this.config.beta;
        const coupling = this.config.coupling;
        const field = this.config.field;

        for (let i = 0; i < attempts; i += 1) {
            const x = (Math.random() * size) | 0;
            const y = (Math.random() * size) | 0;
            const index = y * size + x;
            const spin = spins[index];

            const left = spins[y * size + ((x - 1 + size) % size)];
            const right = spins[y * size + ((x + 1) % size)];
            const up = spins[((y - 1 + size) % size) * size + x];
            const down = spins[((y + 1) % size) * size + x];
            const neighborSum = left + right + up + down;
            const deltaE = 2 * spin * (coupling * neighborSum + field);

            if (deltaE <= 0 || Math.random() < Math.exp(-beta * deltaE)) {
                spins[index] = -spin;
            }
        }

        this.needsRender = true;
    }

    poke(x, y) {
        const size = this.config.size;
        const { side, offsetX, offsetY } = this.getViewport();
        const px = x * this.canvas.width;
        const py = (1 - y) * this.canvas.height;

        if (px < offsetX || px > offsetX + side || py < offsetY || py > offsetY + side) {
            return;
        }

        const localX = (px - offsetX) / side;
        const localY = (py - offsetY) / side;
        const ix = clamp(Math.floor(localX * size), 0, size - 1);
        const iy = clamp(Math.floor(localY * size), 0, size - 1);
        const index = iy * size + ix;
        this.spins[index] = -this.spins[index];
        this.needsRender = true;
    }

    update(dt) {
        this.accumulator += dt * this.config.sweepsPerSecond;
        while (this.accumulator >= 1) {
            this.metropolisSweep();
            this.accumulator -= 1;
        }

        if (!this.needsRender) {
            return;
        }

        this.render();
    }

    render() {
        this.ensureOffscreen();

        const size = this.config.size;
        const pixels = this.imageData.data;
        const spins = this.spins;

        for (let i = 0; i < spins.length; i += 1) {
            const pixelIndex = i * 4;
            if (spins[i] > 0) {
                pixels[pixelIndex] = 247;
                pixels[pixelIndex + 1] = 182;
                pixels[pixelIndex + 2] = 103;
            } else {
                pixels[pixelIndex] = 53;
                pixels[pixelIndex + 1] = 110;
                pixels[pixelIndex + 2] = 196;
            }
            pixels[pixelIndex + 3] = 255;
        }

        this.offscreenCtx.putImageData(this.imageData, 0, 0);

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05070b';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const { side, offsetX, offsetY } = this.getViewport();
        ctx.drawImage(this.offscreen, offsetX, offsetY, side, side);

        if (size <= 128) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            const step = side / size;
            ctx.beginPath();
            for (let i = 1; i < size; i += 1) {
                const x = offsetX + i * step;
                const y = offsetY + i * step;
                ctx.moveTo(x, offsetY);
                ctx.lineTo(x, offsetY + side);
                ctx.moveTo(offsetX, y);
                ctx.lineTo(offsetX + side, y);
            }
            ctx.stroke();
        }

        this.needsRender = false;
    }
}

const fluid = new FluidSimulation(dom.fluidCanvas);
const ising = new IsingSimulation(dom.isingCanvas);

const appState = {
    mode: fluid.supported ? 'fluid' : 'ising',
    panelCollapsed: false,
    lastFrameTime: performance.now(),
    fpsFrameCount: 0,
    fpsLastUpdate: performance.now()
};

if (!fluid.supported) {
    dom.simulationSelect.querySelector('option[value="fluid"]').disabled = true;
    dom.simulationSelect.value = 'ising';
}

const controls = {
    fluid: {
        flowSpeed: document.getElementById('flowSpeed'),
        viscosity: document.getElementById('viscosity'),
        turbulence: document.getElementById('turbulence'),
        reynolds: document.getElementById('reynolds'),
        obstacleSize: document.getElementById('obstacleSize'),
        showArrows: document.getElementById('showArrows'),
        showStreamlines: document.getElementById('showStreamlines'),
        clearObstacles: document.getElementById('clearObstacles'),
        resetFluid: document.getElementById('resetFluid'),
        shapeButtons: {
            circle: document.getElementById('shapeCircle'),
            square: document.getElementById('shapeSquare'),
            triangle: document.getElementById('shapeTriangle')
        }
    },
    ising: {
        size: document.getElementById('isingSize'),
        coupling: document.getElementById('isingCoupling'),
        beta: document.getElementById('isingBeta'),
        field: document.getElementById('isingField'),
        sweeps: document.getElementById('isingSweeps'),
        randomize: document.getElementById('randomizeIsing'),
        flip: document.getElementById('flipIsing')
    }
};

const displays = {
    flowSpeed: document.getElementById('flowSpeedVal'),
    viscosity: document.getElementById('viscosityVal'),
    turbulence: document.getElementById('turbulenceVal'),
    reynolds: document.getElementById('reynoldsVal'),
    obstacleSize: document.getElementById('obstacleSizeVal'),
    isingSize: document.getElementById('isingSizeVal'),
    isingCoupling: document.getElementById('isingCouplingVal'),
    isingBeta: document.getElementById('isingBetaVal'),
    isingField: document.getElementById('isingFieldVal'),
    isingSweeps: document.getElementById('isingSweepsVal')
};

const isingCritical = {
    shell: document.getElementById('isingBetaShell'),
    mark: document.getElementById('isingCriticalMark'),
    text: document.getElementById('isingCriticalText')
};

function setHint(text) {
    dom.hint.textContent = text;
}

function setMode(mode) {
    const nextMode = mode === 'fluid' && !fluid.supported ? 'ising' : mode;
    appState.mode = nextMode;
    dom.simulationSelect.value = nextMode;

    dom.fluidCanvas.hidden = nextMode !== 'fluid';
    dom.isingCanvas.hidden = nextMode !== 'ising';
    dom.controlsTitle.textContent = nextMode === 'fluid' ? '流体控制' : 'Ising 控制';

    for (const section of dom.modeSections) {
        section.hidden = section.dataset.mode !== nextMode;
    }

    if (nextMode === 'fluid') {
        setHint('流体模式：左键放置障碍物，右键删除最近障碍物，移动鼠标预览放置位置。');
    } else {
        setHint('Ising 模式：点击晶格可翻转局部自旋，调节 J / β / h / 扫描速率观察临界行为和磁化。');
        ising.needsRender = true;
    }
}

function updateFluidLabels() {
    displays.flowSpeed.textContent = format(fluid.config.flowSpeed, 1);
    displays.viscosity.textContent = format(fluid.config.viscosity, 4);
    displays.turbulence.textContent = format(fluid.config.vorticity, 2);
    displays.reynolds.textContent = String(fluid.config.pressureIterations);
    displays.obstacleSize.textContent = format(fluid.preview.radius, 2);
}

function updateIsingLabels() {
    displays.isingSize.textContent = String(ising.config.size);
    displays.isingCoupling.textContent = format(ising.config.coupling, 2);
    displays.isingBeta.textContent = format(ising.config.beta, 2);
    displays.isingField.textContent = format(ising.config.field, 2);
    displays.isingSweeps.textContent = String(ising.config.sweepsPerSecond);
    updateCriticalIndicator();
}

function getCriticalBeta() {
    const coupling = Math.abs(ising.config.coupling);
    if (coupling < 1e-6) {
        return Number.POSITIVE_INFINITY;
    }
    return 0.44068679350977147 / coupling;
}

function getCriticalTemperature() {
    const coupling = Math.abs(ising.config.coupling);
    return 2.269185314213022 * coupling;
}

function updateCriticalIndicator() {
    const betaMin = Number(controls.ising.beta.min);
    const betaMax = Number(controls.ising.beta.max);
    const criticalBeta = getCriticalBeta();
    const clampedBeta = Number.isFinite(criticalBeta) ? clamp(criticalBeta, betaMin, betaMax) : betaMax;
    const position = ((clampedBeta - betaMin) / (betaMax - betaMin)) * 100;

    isingCritical.shell.style.setProperty('--mark-pos', `${position}%`);
    if (Number.isFinite(criticalBeta)) {
        isingCritical.text.textContent =
            `临界温度 Tc≈${format(getCriticalTemperature(), 2)}，临界逆温 βc≈${format(criticalBeta, 3)}`;
    } else {
        isingCritical.text.textContent = 'J=0 时没有有限临界点，点击刻度会跳到当前滑条上限。';
    }
}

function snapToCriticalBeta() {
    const betaMin = Number(controls.ising.beta.min);
    const betaMax = Number(controls.ising.beta.max);
    const criticalBeta = getCriticalBeta();
    const nextBeta = Number.isFinite(criticalBeta) ? clamp(criticalBeta, betaMin, betaMax) : betaMax;
    controls.ising.beta.value = String(nextBeta);
    ising.config.beta = nextBeta;
    updateIsingLabels();
}

function setActiveShape(shapeIndex) {
    fluid.preview.shape = shapeIndex;
    const { circle, square, triangle } = controls.fluid.shapeButtons;
    circle.classList.toggle('active', shapeIndex === 0);
    square.classList.toggle('active', shapeIndex === 1);
    triangle.classList.toggle('active', shapeIndex === 2);
}

function resizeAll() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    fluid.resize(width, height, dpr);
    ising.resize(width, height, dpr);
}

function updateFPS(now) {
    appState.fpsFrameCount += 1;
    if (now - appState.fpsLastUpdate < 1000) {
        return;
    }

    const fps = Math.round((appState.fpsFrameCount * 1000) / (now - appState.fpsLastUpdate));
    dom.fpsNumber.textContent = String(fps);
    dom.fpsNumber.style.color = fps >= 50 ? '#6496ff' : fps >= 30 ? '#ffb449' : '#ff6464';
    appState.fpsFrameCount = 0;
    appState.fpsLastUpdate = now;
}

function getCanvasCoords(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return null;
    }

    return {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1)
    };
}

function onFluidPointerMove(event) {
    const coords = getCanvasCoords(event, dom.fluidCanvas);
    if (!coords) {
        return;
    }
    fluid.setPreview(coords.x, coords.y, fluid.preview.radius, fluid.preview.shape);
}

function onFluidPointerDown(event) {
    const coords = getCanvasCoords(event, dom.fluidCanvas);
    if (!coords) {
        return;
    }

    if (event.button === 2) {
        event.preventDefault();
        fluid.removeNearestObstacle(coords.x, coords.y);
        return;
    }

    fluid.addObstacle(coords.x, coords.y, fluid.preview.radius, fluid.preview.shape);
}

function onIsingPointerDown(event) {
    const coords = getCanvasCoords(event, dom.isingCanvas);
    if (!coords) {
        return;
    }
    ising.poke(coords.x, coords.y);
}

controls.fluid.flowSpeed.addEventListener('input', (event) => {
    fluid.config.flowSpeed = Number(event.target.value);
    updateFluidLabels();
});

controls.fluid.viscosity.addEventListener('input', (event) => {
    fluid.config.viscosity = Number(event.target.value);
    updateFluidLabels();
});

controls.fluid.turbulence.addEventListener('input', (event) => {
    fluid.config.vorticity = Number(event.target.value);
    updateFluidLabels();
});

controls.fluid.reynolds.addEventListener('input', (event) => {
    fluid.config.pressureIterations = Number(event.target.value);
    updateFluidLabels();
});

controls.fluid.obstacleSize.addEventListener('input', (event) => {
    const radius = Number(event.target.value);
    fluid.preview.radius = radius;
    updateFluidLabels();
});

controls.fluid.showArrows.addEventListener('change', (event) => {
    fluid.config.showArrows = event.target.checked;
});

controls.fluid.showStreamlines.addEventListener('change', (event) => {
    fluid.config.showStreamlines = event.target.checked;
    if (event.target.checked) {
        fluid.resetStreamlines();
    }
});

controls.fluid.clearObstacles.addEventListener('click', () => {
    fluid.clearObstacles();
});

controls.fluid.resetFluid.addEventListener('click', () => {
    fluid.reset();
});

controls.fluid.shapeButtons.circle.addEventListener('click', () => setActiveShape(0));
controls.fluid.shapeButtons.square.addEventListener('click', () => setActiveShape(1));
controls.fluid.shapeButtons.triangle.addEventListener('click', () => setActiveShape(2));

controls.ising.size.addEventListener('input', (event) => {
    ising.setSize(Number(event.target.value));
    updateIsingLabels();
});

controls.ising.coupling.addEventListener('input', (event) => {
    ising.config.coupling = Number(event.target.value);
    updateIsingLabels();
});

isingCritical.mark.addEventListener('click', () => {
    snapToCriticalBeta();
});

controls.ising.beta.addEventListener('input', (event) => {
    ising.config.beta = Number(event.target.value);
    updateIsingLabels();
});

controls.ising.field.addEventListener('input', (event) => {
    ising.config.field = Number(event.target.value);
    updateIsingLabels();
});

controls.ising.sweeps.addEventListener('input', (event) => {
    ising.config.sweepsPerSecond = Number(event.target.value);
    updateIsingLabels();
});

controls.ising.randomize.addEventListener('click', () => {
    ising.randomize();
});

controls.ising.flip.addEventListener('click', () => {
    ising.flipAll();
});

dom.simulationSelect.addEventListener('change', (event) => {
    setMode(event.target.value);
});

dom.togglePanel.addEventListener('click', () => {
    appState.panelCollapsed = !appState.panelCollapsed;
    dom.controlsPanel.classList.toggle('collapsed', appState.panelCollapsed);
    dom.togglePanel.textContent = appState.panelCollapsed ? '☰' : '✕';
    dom.togglePanel.title = appState.panelCollapsed ? '展开面板' : '收起面板';
});

dom.fluidCanvas.addEventListener('pointermove', onFluidPointerMove);
dom.fluidCanvas.addEventListener('pointerdown', onFluidPointerDown);
dom.fluidCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
dom.isingCanvas.addEventListener('pointerdown', onIsingPointerDown);

window.addEventListener('resize', resizeAll);

updateFluidLabels();
updateIsingLabels();
setActiveShape(0);
resizeAll();
setMode(appState.mode);

function frame(now) {
    const dt = clamp((now - appState.lastFrameTime) / 1000, 0.001, 0.033);
    appState.lastFrameTime = now;

    if (appState.mode === 'fluid') {
        fluid.update(dt);
    } else {
        ising.update(dt);
    }

    updateFPS(now);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
