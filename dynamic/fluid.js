// WebGL2 Turbulent Flow Simulation
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) alert('WebGL2不支持');

gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

const config = {
    flowSpeed: 2.5,
    viscosity: 0.0005,
    turbulenceIntensity: 0.3,
    reynoldsNumber: 3000,
    showArrows: true,
    showStreamlines: true,
    obstacleShape: 0  // 0=circle, 1=square, 2=triangle
};

const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, radius: 0.05 };

// 动态障碍物数组：每个障碍物有 {x, y, radius, shape}
const obstacles = [];

// Shaders
const vs = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const advectFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_dissipation;
void main() {
    vec2 coord = v_uv - u_dt * texture(u_velocity, v_uv).xy * u_texel;
    outColor = u_dissipation * texture(u_source, coord);
}`;

const divergenceFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
    float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.0)).x;
    float R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.0)).x;
    float T = texture(u_velocity, v_uv + vec2(0.0, u_texel.y)).y;
    float B = texture(u_velocity, v_uv - vec2(0.0, u_texel.y)).y;
    outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const pressureFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texel;
void main() {
    float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
    float R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
    float T = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
    float B = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
    float div = texture(u_divergence, v_uv).x;
    outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const gradientFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
    float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
    float R = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
    float T = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
    float B = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
    vec2 vel = texture(u_velocity, v_uv).xy - vec2(R - L, T - B) * 0.5;
    outColor = vec4(vel, 0.0, 1.0);
}`;

const splatFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_target;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;
void main() {
    vec2 p = v_uv - u_point;
    float splat = exp(-dot(p, p) / u_radius);
    outColor = vec4(texture(u_target, v_uv).xyz + splat * u_color, 1.0);
}`;

const vorticityFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
    float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0.0)).y;
    float R = texture(u_velocity, v_uv + vec2(u_texel.x, 0.0)).y;
    float T = texture(u_velocity, v_uv + vec2(0.0, u_texel.y)).x;
    float B = texture(u_velocity, v_uv - vec2(0.0, u_texel.y)).x;
    outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const curlFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_strength;
void main() {
    float L = texture(u_curl, v_uv - vec2(u_texel.x, 0.0)).x;
    float R = texture(u_curl, v_uv + vec2(u_texel.x, 0.0)).x;
    float T = texture(u_curl, v_uv + vec2(0.0, u_texel.y)).x;
    float B = texture(u_curl, v_uv - vec2(0.0, u_texel.y)).x;
    float C = texture(u_curl, v_uv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force = force / (length(force) + 0.0001) * u_strength * C * vec2(1.0, -1.0);
    vec2 vel = texture(u_velocity, v_uv).xy + force * u_dt;
    outColor = vec4(vel * 0.999, 0.0, 1.0);
}`;

const displayFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_texture;
void main() {
    vec3 color = pow(texture(u_texture, v_uv).rgb, vec3(1.0 / 2.2));
    outColor = vec4(color, 1.0);
}`;

const turbulenceSourceFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform float u_time;
uniform float u_intensity;
uniform float u_flow_speed;
void main() {
    vec2 vel = texture(u_velocity, v_uv).xy;
    
    // 持续从左侧注入湍流
    float leftInflow = smoothstep(0.0, 0.1, v_uv.x);
    float noise = sin(v_uv.y * 20.0 + u_time * 2.0) * cos(v_uv.y * 15.0 + u_time * 3.0);
    
    // 基础流场：从左到右
    vec2 baseFlow = vec2(u_flow_speed, noise * u_intensity * 0.3);
    
    // 在流场中加入湍流扰动
    float turbulence1 = sin(v_uv.x * 10.0 + u_time) * cos(v_uv.y * 8.0 - u_time * 1.5);
    float turbulence2 = sin(v_uv.x * 6.0 - u_time * 0.8) * cos(v_uv.y * 12.0 + u_time * 1.2);
    vec2 turbulenceForce = vec2(turbulence2, turbulence1) * u_intensity * 0.2;
    
    // 混合
    vel = mix(vel, baseFlow + turbulenceForce, 1.0 - leftInflow * 0.95);
    
    outColor = vec4(vel, 0.0, 1.0);
}`;

const obstacleFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform vec2 u_obstacle_pos;
uniform float u_obstacle_radius;
uniform float u_obstacle_shape; // 鼠标障碍物形状
uniform sampler2D u_obstacleData; // 存储障碍物信息的纹理
uniform int u_numObstacles;
uniform float u_aspectRatio; // 屏幕宽高比

// 检查点是否在障碍物内（考虑纵横比）
bool inObstacle(vec2 pos, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = pos - center;
    p.x *= aspectRatio; // 校正横向拉伸
    
    if (shape < 0.5) { // circle
        return length(p) < radius;
    } else if (shape < 1.5) { // square
        vec2 d = abs(p);
        return d.x < radius && d.y < radius;
    } else { // triangle (equilateral, pointing up)
        float h = radius * 1.732; // height = radius * sqrt(3)
        float halfBase = radius * 0.577; // radius / sqrt(3)
        
        if (p.y < -radius || p.y > h * 0.5 - radius) return false;
        
        float yFromBase = p.y + radius;
        float maxX = halfBase * (1.0 - yFromBase / h);
        
        return abs(p.x) < maxX;
    }
}

// 计算点到形状边缘的距离（用于绕流效果，考虑纵横比）
// 返回到边缘的绝对距离，内部为正，外部也为正
float distToShape(vec2 pos, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = pos - center;
    p.x *= aspectRatio; // 校正横向拉伸
    
    if (shape < 0.5) { // circle
        return abs(length(p) - radius); // 到圆边缘的距离
    } else if (shape < 1.5) { // square
        // 使用box SDF
        vec2 d = abs(p) - vec2(radius);
        float boxSDF = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        return abs(boxSDF); // 转换为绝对距离
    } else { // triangle (equilateral, pointing up)
        float h = radius * 1.732; // height
        float halfBase = radius * 0.577;
        
        // 三角形的三个顶点（底边中心在原点下方radius处）
        vec2 p0 = vec2(-halfBase, -radius); // 左下
        vec2 p1 = vec2(halfBase, -radius);  // 右下
        vec2 p2 = vec2(0.0, h - radius);     // 顶部
        
        // 计算到三条边的距离
        vec2 e0 = p1 - p0; vec2 v0 = p - p0;
        vec2 e1 = p2 - p1; vec2 v1 = p - p1;
        vec2 e2 = p0 - p2; vec2 v2 = p - p2;
        
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        
        float d = min(min(dot(pq0, pq0), dot(pq1, pq1)), dot(pq2, pq2));
        return sqrt(d);
    }
}

void main() {
    vec2 vel = texture(u_velocity, v_uv).xy;
    
    // 鼠标障碍物（使用形状参数）
    bool inMouseObstacle = inObstacle(v_uv, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio);
    float distToMouse = distToShape(v_uv, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio);
    
    // 检查所有动态障碍物
    bool inDynamicObstacle = false;
    float minDist = 1000.0;
    vec2 nearestCenter = vec2(0.0);
    float nearestRadius = 0.0;
    float nearestShape = 0.0;
    
    for (int i = 0; i < 32; i++) { // 最多32个障碍物
        if (i >= u_numObstacles) break;
        
        // 从纹理读取障碍物数据 (x, y, radius, shape)
        vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
        vec2 center = obstacleData.xy;
        float radius = obstacleData.z;
        float shape = obstacleData.w;
        
        if (inObstacle(v_uv, center, radius, shape, u_aspectRatio)) {
            inDynamicObstacle = true;
        }
        
        float dist = distToShape(v_uv, center, radius, shape, u_aspectRatio);
        if (dist < minDist) {
            minDist = dist;
            nearestCenter = center;
            nearestRadius = radius;
            nearestShape = shape;
        }
    }
    
    // 在所有障碍物内部，速度为0
    if (inMouseObstacle || inDynamicObstacle) {
        vel = vec2(0.0);
    }
    // 障碍物边界处产生绕流（使用更小的影响范围）
    else {
        // 根据形状调整影响范围（从边缘向外延伸的距离）
        float mouseInfluenceRange = (u_obstacle_shape < 0.5) ? u_obstacle_radius * 0.3 : u_obstacle_radius * 0.2;
        float dynamicInfluenceRange = (nearestShape < 0.5) ? nearestRadius * 0.3 : nearestRadius * 0.2;
        
        // 检查是否在鼠标障碍物影响范围内（distToMouse已经是到边缘的距离）
        if (distToMouse < mouseInfluenceRange) {
            vec2 toObstacle = v_uv - u_obstacle_pos;
            // 应用纵横比校正
            toObstacle.x *= u_aspectRatio;
            
            // 计算切向量（垂直于径向）
            vec2 tangent = vec2(-toObstacle.y, toObstacle.x);
            if (length(toObstacle) > 0.001) {
                tangent = normalize(tangent);
            }
            
            // 绕流因子：越靠近障碍物边缘，绕流效果越强
            float flowFactor = 1.0 - smoothstep(0.0, mouseInfluenceRange, distToMouse);
            
            // 混合切向速度和原始速度
            float velMag = length(vel);
            vel = mix(vel, tangent * velMag * 1.2, flowFactor * 0.8);
        }
        
        // 检查是否在动态障碍物影响范围内（minDist已经是到边缘的距离）
        if (minDist < dynamicInfluenceRange && nearestRadius > 0.0) {
            vec2 toObstacle = v_uv - nearestCenter;
            // 应用纵横比校正
            toObstacle.x *= u_aspectRatio;
            
            vec2 tangent = vec2(-toObstacle.y, toObstacle.x);
            if (length(toObstacle) > 0.001) {
                tangent = normalize(tangent);
            }
            
            // 绕流因子：越靠近障碍物边缘，绕流效果越强
            float flowFactor = 1.0 - smoothstep(0.0, dynamicInfluenceRange, minDist);
            
            float velMag = length(vel);
            vel = mix(vel, tangent * velMag * 1.2, flowFactor * 0.8);
        }
    }
    
    outColor = vec4(vel, 0.0, 1.0);
}`;
const velocityVisualizationFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform sampler2D u_streamlines;
uniform float u_time;
uniform vec2 u_obstacle_pos;
uniform float u_obstacle_radius;
uniform float u_obstacle_shape; // 鼠标障碍物形状
uniform sampler2D u_obstacleData;
uniform int u_numObstacles;
uniform float u_show_arrows;
uniform float u_show_streamlines;
uniform float u_aspectRatio; // 屏幕宽高比

// 检查点是否在障碍物内（考虑纵横比）
bool inObstacle(vec2 pos, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = pos - center;
    p.x *= aspectRatio; // 校正横向拉伸
    
    if (shape < 0.5) { // circle
        return length(p) < radius;
    } else if (shape < 1.5) { // square
        vec2 d = abs(p);
        return d.x < radius && d.y < radius;
    } else { // triangle (equilateral, pointing up)
        float h = radius * 1.732; // height = radius * sqrt(3)
        float halfBase = radius * 0.577; // radius / sqrt(3)
        
        if (p.y < -radius || p.y > h * 0.5 - radius) return false;
        
        float yFromBase = p.y + radius;
        float maxX = halfBase * (1.0 - yFromBase / h);        return abs(p.x) < maxX;
    }
}

// 计算点到形状边缘的距离（考虑纵横比）
float distToEdge(vec2 pos, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = pos - center;
    p.x *= aspectRatio; // 校正横向拉伸
    
    if (shape < 0.5) { // circle
        return abs(length(p) - radius);
    } else if (shape < 1.5) { // square
        vec2 d = abs(p);
        // 到方形边缘的距离
        vec2 toEdge = d - vec2(radius);
        float outsideDist = length(max(toEdge, 0.0));
        float insideDist = min(max(toEdge.x, toEdge.y), 0.0);
        float dist = outsideDist + insideDist;
        return abs(dist);
    } else { // triangle
        float h = radius * 1.732;
        float halfBase = radius * 0.577;
        
        // 三角形的三个顶点（底边中心在原点下方radius处）
        vec2 p0 = vec2(-halfBase, -radius); // 左下
        vec2 p1 = vec2(halfBase, -radius);  // 右下
        vec2 p2 = vec2(0.0, h - radius);     // 顶部
        
        // 计算到三条边的距离
        vec2 e0 = p1 - p0; vec2 v0 = p - p0;
        vec2 e1 = p2 - p1; vec2 v1 = p - p1;
        vec2 e2 = p0 - p2; vec2 v2 = p - p2;
        
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        
        float d = min(min(dot(pq0, pq0), dot(pq1, pq1)), dot(pq2, pq2));
        return sqrt(d);
    }
}

// SDF for arrow shape (returns signed distance)
float sdArrow(vec2 p) {
    // Shaft: rectangle (shorter and thinner)
    vec2 shaftSize = vec2(0.15, 0.04);
    vec2 d1 = abs(p - vec2(0.075, 0.0)) - shaftSize;
    float shaft = max(d1.x, d1.y);
    
    // Head: triangle pointing right (smaller)
    vec2 hp = p - vec2(0.225, 0.0);
    float headLen = 0.12;
    float headWidth = 0.11;
    
    // Triangle edges
    float d2 = dot(hp, normalize(vec2(headLen, headWidth))) - headLen * 0.92;
    float d3 = dot(hp, normalize(vec2(headLen, -headWidth))) - headLen * 0.92;
    float d4 = -hp.x;
    
    float head = max(max(d2, d3), d4);
    
    return min(shaft, head);
}

void main() {
    vec2 vel = texture(u_velocity, v_uv).xy;
    float speed = length(vel);
    
    // 背景：用颜色表示速度强度
    vec3 color = vec3(0.0);
    
    // 颜色映射：蓝色(慢) -> 青色 -> 绿色 -> 黄色 -> 红色(快)
    float normalizedSpeed = smoothstep(0.0, 1.5, speed);
    if (normalizedSpeed < 0.25) {
        color = mix(vec3(0.0, 0.0, 0.2), vec3(0.0, 0.5, 1.0), normalizedSpeed * 4.0);
    } else if (normalizedSpeed < 0.5) {
        color = mix(vec3(0.0, 0.5, 1.0), vec3(0.0, 1.0, 0.5), (normalizedSpeed - 0.25) * 4.0);
    } else if (normalizedSpeed < 0.75) {
        color = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 1.0, 0.0), (normalizedSpeed - 0.5) * 4.0);
    } else {
        color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.2, 0.0), (normalizedSpeed - 0.75) * 4.0);
    }
    
    // 检查是否在障碍物内（鼠标障碍物）
    bool inMouseObstacle = inObstacle(v_uv, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio);
    float distToMouse = distToEdge(v_uv, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio);
    
    // 检查所有动态障碍物
    bool inDynamicObstacle = false;
    float minEdgeDist = 1000.0;
    
    for (int i = 0; i < 32; i++) {
        if (i >= u_numObstacles) break;
        
        vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
        vec2 center = obstacleData.xy;
        float radius = obstacleData.z;
        float shape = obstacleData.w;
        
        if (inObstacle(v_uv, center, radius, shape, u_aspectRatio)) {
            inDynamicObstacle = true;
            // 使用形状相关的边缘距离计算
            float edgeDist = distToEdge(v_uv, center, radius, shape, u_aspectRatio);
            minEdgeDist = min(minEdgeDist, edgeDist);
        }
    }
    
    bool isInObstacle = inMouseObstacle || inDynamicObstacle;
    
    // 计算最近的障碍物边缘距离（用于抗锯齿）- 全部使用纵横比校正
    float obstacleEdgeDist = 1000.0;
    
    // 鼠标障碍物的边缘距离（使用统一的distToEdge函数）
    obstacleEdgeDist = min(obstacleEdgeDist, distToEdge(v_uv, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio));
    
    // 动态障碍物的边缘距离
    for (int i = 0; i < 32; i++) {
        if (i >= u_numObstacles) break;
        vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
        float edgeDist = distToEdge(v_uv, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio);
        obstacleEdgeDist = min(obstacleEdgeDist, edgeDist);
    }
    
    // 抗锯齿：在边缘附近平滑过渡
    float pixelSize = length(fwidth(v_uv)); // 屏幕像素大小
    float aaWidth = pixelSize * 2.0; // 抗锯齿宽度
    float obstacleMask = smoothstep(aaWidth, 0.0, obstacleEdgeDist);
    
    // 在障碍物内显示精美的渐变填充
    if (isInObstacle) {
        // 计算从中心到当前点的距离（用于创建径向渐变）
        vec2 toCenter;
        float centerDist;
        float maxDist;
        
        // 判断是在哪个障碍物内，计算对应的中心距离
        if (inMouseObstacle) {
            toCenter = v_uv - u_obstacle_pos;
            toCenter.x *= u_aspectRatio;
            centerDist = length(toCenter);
            maxDist = u_obstacle_radius;
        } else {
            // 找到最近的动态障碍物中心
            centerDist = 1000.0;
            maxDist = 0.05;
            for (int i = 0; i < 32; i++) {
                if (i >= u_numObstacles) break;
                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                if (inObstacle(v_uv, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                    toCenter = v_uv - obstacleData.xy;
                    toCenter.x *= u_aspectRatio;
                    centerDist = length(toCenter);
                    maxDist = obstacleData.z;
                    break;
                }
            }
        }
        
        // 归一化距离：0（中心）到 1（边缘）
        float normalizedDist = clamp(centerDist / maxDist, 0.0, 1.0);
        
        // 定义更美观的配色：深蓝色到浅蓝灰色渐变
        vec3 centerColor = vec3(0.18, 0.24, 0.35);    // 深蓝灰色（中心）
        vec3 midColor = vec3(0.28, 0.38, 0.52);       // 中蓝色（中间）
        vec3 edgeColor = vec3(0.42, 0.55, 0.72);      // 浅蓝色（接近边缘）
        vec3 highlightColor = vec3(0.55, 0.70, 0.90); // 亮蓝色（边缘高光）
        
        // 创建多层渐变
        vec3 obstacleColor;
        if (normalizedDist < 0.5) {
            // 中心到中间的渐变
            obstacleColor = mix(centerColor, midColor, normalizedDist * 2.0);
        } else {
            // 中间到边缘的渐变
            obstacleColor = mix(midColor, edgeColor, (normalizedDist - 0.5) * 2.0);
        }
        
        // 边缘高光效果（在非常接近边缘时）
        float edgeHighlight = smoothstep(0.85, 1.0, normalizedDist);
        obstacleColor = mix(obstacleColor, highlightColor, edgeHighlight * 0.6);
        
        // 应用抗锯齿混合
        color = mix(color, obstacleColor, obstacleMask);
    } else {
        // 在障碍物外部应用轻微的阴影效果
        float shadowDist = 0.01; // 阴影范围
        float shadow = smoothstep(shadowDist, 0.0, obstacleEdgeDist);
        vec3 shadowColor = vec3(0.08, 0.10, 0.15); // 深色阴影
        color = mix(color, shadowColor, shadow * 0.3);
        
        // 绘制箭头（只在障碍物外，可开关）
        if (u_show_arrows > 0.5) {
            vec2 gridSize = vec2(60.0, 40.0);
            vec2 cellCenter = (floor(v_uv * gridSize) + 0.5) / gridSize;
            
            // 检查网格中心点是否在鼠标障碍物内（使用形状判断）
            bool cellInObstacle = inObstacle(cellCenter, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio);
            
            // 检查动态障碍物
            for (int i = 0; i < 32; i++) {
                if (i >= u_numObstacles) break;
                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(i, 0), 0);
                if (inObstacle(cellCenter, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                    cellInObstacle = true;
                    break;
                }
            }
        
        if (!cellInObstacle) {
            vec2 cellVel = texture(u_velocity, cellCenter).xy;
            float cellSpeed = length(cellVel);
            
            if (cellSpeed > 0.015) {
                vec2 dir = normalize(cellVel);
                
                // 转换到以网格中心为原点的坐标系
                vec2 localPos = (v_uv - cellCenter) * gridSize;
                
                // 旋转到箭头坐标系（箭头指向+X方向）
                float angle = atan(dir.y, dir.x);
                mat2 rot = mat2(cos(-angle), -sin(-angle), sin(-angle), cos(-angle));
                vec2 rotated = rot * localPos;
                
                // 使用SDF计算到箭头的距离
                float dist = sdArrow(rotated);
                
                // 抗锯齿：smoothstep过渡（更窄的过渡带）
                float aa = 0.02;
                float arrowAlpha = 1.0 - smoothstep(-aa, aa, dist);
                
                // 应用箭头颜色（白色半透明，更优雅）
                if (arrowAlpha > 0.01) {
                    vec3 arrowColor = vec3(0.95, 0.95, 0.98); // 略带蓝的白色
                    color = mix(color, arrowColor, arrowAlpha * 0.9);
                }
            }
        }
        }
        
        // 绘制预计算的流线（从texture读取，可开关）
        if (u_show_streamlines > 0.5) {
            float streamlineValue = texture(u_streamlines, v_uv).r;
            if (streamlineValue > 0.01) {
                vec3 lineColor = vec3(1.0, 1.0, 0.85); // 淡黄色流线
                color = mix(color, lineColor, streamlineValue * 0.7);
            }
        }
    }
    
    outColor = vec4(color, 1.0);
}`;

const streamlineFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_velocity;
uniform sampler2D u_oldStreamlines;
uniform vec2 u_obstacle_pos;
uniform float u_obstacle_radius;
uniform float u_obstacle_shape; // 鼠标障碍物形状
uniform sampler2D u_obstacleData;
uniform int u_numObstacles;
uniform int u_startLine;
uniform float u_aspectRatio;

// 检查点是否在障碍物内（考虑纵横比）
bool inObstacle(vec2 pos, vec2 center, float radius, float shape, float aspectRatio) {
    vec2 p = pos - center;
    p.x *= aspectRatio; // 校正横向拉伸
    
    if (shape < 0.5) { // circle
        return length(p) < radius;
    } else if (shape < 1.5) { // square
        vec2 d = abs(p);
        return d.x < radius && d.y < radius;
    } else { // triangle (equilateral, pointing up)
        float h = radius * 1.732; // height = radius * sqrt(3)
        float halfBase = radius * 0.577; // radius / sqrt(3)
        
        if (p.y < -radius || p.y > h * 0.5 - radius) return false;
        
        float yFromBase = p.y + radius;
        float maxX = halfBase * (1.0 - yFromBase / h);
        
        return abs(p.x) < maxX;
    }
}

void main() {
    // 保留旧的流线（轻微衰减以实现增量更新）
    float streamlineAlpha = texture(u_oldStreamlines, v_uv).r * 0.98;
    
    float lineWidth = 0.002;
    
    // 每帧只更新10条流线
    for (int i = 0; i < 10; i++) {
        int lineIndex = u_startLine + i;
        if (lineIndex >= 50) break;
        
        float startY = float(lineIndex) / 49.0;
        
        // 从左侧追踪流线，直到出屏幕为止
        vec2 pos = vec2(0.02, startY);
        float minDist = 1000.0;
        
        // 动态追踪直到真正出屏幕
        for (int step = 0; step < 500; step++) {
            // 先检查是否出界
            if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
                break;
            }
            
            // 计算当前像素到流线的距离
            float dist = length(v_uv - pos);
            minDist = min(minDist, dist);
            
            // 获取速度
            vec2 vel = texture(u_velocity, pos).xy;
            float speed = length(vel);
            
            // 如果速度太小，停止追踪
            if (speed < 0.001) break;
            
            // 检查是否进入鼠标障碍物（使用形状判断）
            if (inObstacle(pos, u_obstacle_pos, u_obstacle_radius, u_obstacle_shape, u_aspectRatio)) break;
            
            // 检查是否进入动态障碍物
            bool hitObstacle = false;
            for (int j = 0; j < 32; j++) {
                if (j >= u_numObstacles) break;
                vec4 obstacleData = texelFetch(u_obstacleData, ivec2(j, 0), 0);
                if (inObstacle(pos, obstacleData.xy, obstacleData.z, obstacleData.w, u_aspectRatio)) {
                    hitObstacle = true;
                    break;
                }
            }
            if (hitObstacle) break;
            
            // 自适应步长：归一化方向
            pos += normalize(vel) * 0.003;
        }
        
        // 如果当前像素接近流线，更新强度
        if (minDist < lineWidth) {
            float lineIntensity = 1.0 - smoothstep(0.0, lineWidth, minDist);
            streamlineAlpha = max(streamlineAlpha, lineIntensity);
        }
    }
    
    outColor = vec4(streamlineAlpha, 0.0, 0.0, 1.0);
}`;

// Utility functions
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

function createProgram(vsSource, fsSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    return program;
}

function createFBO(w, h, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, fbo, width: w, height: h };
}

function createDoubleFBO(w, h, internalFormat, format, type) {
    return {
        read: createFBO(w, h, internalFormat, format, type),
        write: createFBO(w, h, internalFormat, format, type),
        swap() { const temp = this.read; this.read = this.write; this.write = temp; }
    };
}

// Initialize
const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

const programs = {
    advect: createProgram(vs, advectFS),
    divergence: createProgram(vs, divergenceFS),
    pressure: createProgram(vs, pressureFS),
    gradient: createProgram(vs, gradientFS),
    splat: createProgram(vs, splatFS),
    vorticity: createProgram(vs, vorticityFS),
    curl: createProgram(vs, curlFS),
    turbulenceSource: createProgram(vs, turbulenceSourceFS),
    obstacle: createProgram(vs, obstacleFS),
    streamline: createProgram(vs, streamlineFS),
    display: createProgram(vs, velocityVisualizationFS)
};

let velocity, pressure, divergence, curl, streamlines;
let needsStreamlineUpdate = true;
let simFrameCount = 0;
let currentStreamlineIndex = 0;
let obstacleDataTexture, obstacleDataArray;

// 创建障碍物数据纹理
function createObstacleDataTexture() {
    obstacleDataArray = new Float32Array(32 * 4); // 最多32个障碍物，每个4个float (x, y, radius, shape)
    obstacleDataTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, obstacleDataTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 32, 1, 0, gl.RGBA, gl.FLOAT, obstacleDataArray);
}

// 更新障碍物数据纹理
function updateObstacleDataTexture() {
    // 先清零所有数据
    obstacleDataArray.fill(0);
    
    // 填充实际障碍物数据
    for (let i = 0; i < obstacles.length && i < 32; i++) {
        const obs = obstacles[i];
        obstacleDataArray[i * 4 + 0] = obs.x;
        obstacleDataArray[i * 4 + 1] = obs.y;
        obstacleDataArray[i * 4 + 2] = obs.radius;
        obstacleDataArray[i * 4 + 3] = obs.shape; // shape already is 0, 1, or 2
    }
    gl.bindTexture(gl.TEXTURE_2D, obstacleDataTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 32, 1, gl.RGBA, gl.FLOAT, obstacleDataArray);
}

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
        const w = Math.floor(canvas.width / 2);
    const h = Math.floor(canvas.height / 2);
    velocity = createDoubleFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    pressure = createDoubleFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    divergence = createFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    curl = createFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    streamlines = createDoubleFBO(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    needsStreamlineUpdate = true;
    currentStreamlineIndex = 0;
    
    if (!obstacleDataTexture) {
        createObstacleDataTexture();
    }
}

function blit(program, source, dest, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo);
    gl.viewport(0, 0, dest.width, dest.height);
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    if (source) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
    }
    let unit = 1;
    for (const [name, value] of Object.entries(uniforms)) {
        const loc = gl.getUniformLocation(program, name);
        if (!loc) continue;
        if (typeof value === 'number') {
            // 检查uniform名称，整数类型用uniform1i
            if (name.includes('Line') || name.includes('Index') || name.includes('num') || name.includes('Num')) {
                gl.uniform1i(loc, Math.floor(value));
            } else {
                gl.uniform1f(loc, value);
            }
        } else if (Array.isArray(value)) {
            if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
            else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
        } else if (value.texture) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, value.texture);
            gl.uniform1i(loc, unit);
            unit++;
        } else if (value instanceof WebGLTexture) {
            // 直接传递WebGLTexture
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, value);
            gl.uniform1i(loc, unit);
            unit++;
        }
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function step(dt) {
    const texel = [1 / velocity.read.width, 1 / velocity.read.height];
    const time = performance.now() * 0.001;
    
    // 1. 注入持续的湍流
    blit(programs.turbulenceSource, velocity.read.texture, velocity.write, {
        u_time: time,
        u_intensity: config.turbulenceIntensity,
        u_flow_speed: config.flowSpeed
    });
    velocity.swap();
    
    // 2. 应用障碍物
    const aspectRatio = canvas.width / canvas.height;
    blit(programs.obstacle, velocity.read.texture, velocity.write, {
        u_obstacle_pos: [mouse.x, mouse.y],
        u_obstacle_radius: mouse.radius,
        u_obstacle_shape: config.obstacleShape,
        u_obstacleData: obstacleDataTexture,
        u_numObstacles: obstacles.length,
        u_aspectRatio: aspectRatio
    });
    velocity.swap();
    
    // 3. 计算涡度并应用涡度力
    blit(programs.vorticity, velocity.read.texture, curl, { u_texel: texel });
    blit(programs.curl, null, velocity.write, {
        u_velocity: velocity.read,
        u_curl: curl,
        u_texel: texel,
        u_dt: dt,
        u_strength: config.reynoldsNumber * 0.0001
    });
    velocity.swap();
    
    // 4. 速度对流
    blit(programs.advect, null, velocity.write, {
        u_velocity: velocity.read,
        u_source: velocity.read,
        u_texel: texel,
        u_dt: dt,
        u_dissipation: 1.0 - config.viscosity
    });
    velocity.swap();
    
    // 5. 计算散度
    blit(programs.divergence, velocity.read.texture, divergence, { u_texel: texel });
    
    // 6. 压力求解（Jacobi迭代 - 优化为16次提升性能）
    for (let i = 0; i < 16; i++) {
        blit(programs.pressure, null, pressure.write, {
            u_pressure: pressure.read,
            u_divergence: divergence,
            u_texel: texel
        });
        pressure.swap();
    }
    
    // 7. 压力梯度减法（使速度场无散）
    blit(programs.gradient, null, velocity.write, {
        u_pressure: pressure.read,
        u_velocity: velocity.read,
        u_texel: texel
    });
    velocity.swap();
}

function render() {
    step(0.016);
    
    const aspectRatio = canvas.width / canvas.height;
    
    // 每帧增量更新10条流线（仅在开启时）
    if (config.showStreamlines) {
        blit(programs.streamline, null, streamlines.write, {
            u_velocity: velocity.read,
            u_oldStreamlines: streamlines.read,
            u_obstacle_pos: [mouse.x, mouse.y],
            u_obstacle_radius: mouse.radius,
            u_obstacle_shape: config.obstacleShape,
            u_obstacleData: obstacleDataTexture,
            u_numObstacles: obstacles.length,
            u_startLine: currentStreamlineIndex,
            u_aspectRatio: aspectRatio
        });
        streamlines.swap();
        
        // 循环更新：50条流线，每次10条，5帧完成一轮
        currentStreamlineIndex = (currentStreamlineIndex + 10) % 50;
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(programs.display);
    const posLoc = gl.getAttribLocation(programs.display, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture);
    gl.uniform1i(gl.getUniformLocation(programs.display, 'u_velocity'), 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, streamlines.read.texture);
    gl.uniform1i(gl.getUniformLocation(programs.display, 'u_streamlines'), 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, obstacleDataTexture);
    gl.uniform1i(gl.getUniformLocation(programs.display, 'u_obstacleData'), 2);
    
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_time'), performance.now() * 0.001);
    gl.uniform2f(gl.getUniformLocation(programs.display, 'u_obstacle_pos'), mouse.x, mouse.y);
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_obstacle_radius'), mouse.radius);
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_obstacle_shape'), config.obstacleShape);
    gl.uniform1i(gl.getUniformLocation(programs.display, 'u_numObstacles'), obstacles.length);
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_show_arrows'), config.showArrows ? 1.0 : 0.0);
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_show_streamlines'), config.showStreamlines ? 1.0 : 0.0);
    gl.uniform1f(gl.getUniformLocation(programs.display, 'u_aspectRatio'), aspectRatio);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    updateFPS();
    requestAnimationFrame(render);
}

// Events
let lastMouseMoveTime = 0;
const mouseThrottle = 16; // 约60fps

canvas.addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - lastMouseMoveTime < mouseThrottle) return;
    lastMouseMoveTime = now;
    
    const rect = canvas.getBoundingClientRect();
    mouse.px = mouse.x;
    mouse.py = mouse.y;
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = 1 - (e.clientY - rect.top) / rect.height;
});

canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    
    if (e.button === 0) {
        // Left click: add obstacle
        if (obstacles.length < 32) {
            obstacles.push({
                x: x,
                y: y,
                radius: mouse.radius,
                shape: config.obstacleShape
            });
            updateObstacleDataTexture();
        }
    } else if (e.button === 2) {
        // Right click: remove nearest obstacle
        let nearestIdx = -1;
        let nearestDist = Infinity;
        
        for (let i = 0; i < obstacles.length; i++) {
            const dx = obstacles[i].x - x;
            const dy = obstacles[i].y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist && dist < obstacles[i].radius * 1.5) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }
        
        if (nearestIdx >= 0) {
            obstacles.splice(nearestIdx, 1);
            updateObstacleDataTexture();
        }
    }
});

canvas.addEventListener('contextmenu', e => {
    e.preventDefault(); // Prevent context menu on right click
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastMouseMoveTime < mouseThrottle) return;
    lastMouseMoveTime = now;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouse.px = mouse.x;
    mouse.py = mouse.y;
    mouse.x = (touch.clientX - rect.left) / rect.width;
    mouse.y = 1 - (touch.clientY - rect.top) / rect.height;
}, { passive: false });

window.addEventListener('resize', resize);

// UI Controls with live value display
const controls = {
    flowSpeed: document.getElementById('flowSpeed'),
    viscosity: document.getElementById('viscosity'),
    turbulence: document.getElementById('turbulence'),
    reynolds: document.getElementById('reynolds'),
    obstacleSize: document.getElementById('obstacleSize'),
    showArrows: document.getElementById('showArrows'),
    showStreamlines: document.getElementById('showStreamlines')
};

const valueDisplays = {
    flowSpeed: document.getElementById('flowSpeedVal'),
    viscosity: document.getElementById('viscosityVal'),
    turbulence: document.getElementById('turbulenceVal'),
    reynolds: document.getElementById('reynoldsVal'),
    obstacleSize: document.getElementById('obstacleSizeVal')
};

// Shape selector buttons
const shapeButtons = {
    circle: document.getElementById('shapeCircle'),
    square: document.getElementById('shapeSquare'),
    triangle: document.getElementById('shapeTriangle')
};

// Set initial active state
shapeButtons.circle.classList.add('active');

// Shape button event handlers
shapeButtons.circle.addEventListener('click', () => {
    config.obstacleShape = 0;
    Object.values(shapeButtons).forEach(btn => btn.classList.remove('active'));
    shapeButtons.circle.classList.add('active');
});

shapeButtons.square.addEventListener('click', () => {
    config.obstacleShape = 1;
    Object.values(shapeButtons).forEach(btn => btn.classList.remove('active'));
    shapeButtons.square.classList.add('active');
});

shapeButtons.triangle.addEventListener('click', () => {
    config.obstacleShape = 2;
    Object.values(shapeButtons).forEach(btn => btn.classList.remove('active'));
    shapeButtons.triangle.classList.add('active');
});

controls.flowSpeed.addEventListener('input', e => {
    config.flowSpeed = parseFloat(e.target.value);
    valueDisplays.flowSpeed.textContent = config.flowSpeed.toFixed(1);
});

controls.viscosity.addEventListener('input', e => {
    config.viscosity = parseFloat(e.target.value);
    valueDisplays.viscosity.textContent = config.viscosity.toFixed(4);
});

controls.turbulence.addEventListener('input', e => {
    config.turbulenceIntensity = parseFloat(e.target.value);
    valueDisplays.turbulence.textContent = config.turbulenceIntensity.toFixed(2);
});

controls.reynolds.addEventListener('input', e => {
    config.reynoldsNumber = parseFloat(e.target.value);
    valueDisplays.reynolds.textContent = config.reynoldsNumber.toFixed(0);
});

controls.obstacleSize.addEventListener('input', e => {
    mouse.radius = parseFloat(e.target.value);
    valueDisplays.obstacleSize.textContent = mouse.radius.toFixed(2);
});

// Toggle switches
controls.showArrows.addEventListener('change', e => {
    config.showArrows = e.target.checked;
});

controls.showStreamlines.addEventListener('change', e => {
    config.showStreamlines = e.target.checked;
});

// Panel toggle
const togglePanelBtn = document.getElementById('togglePanel');
const controlsPanel = document.querySelector('.controls');
let panelCollapsed = false;

togglePanelBtn.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    controlsPanel.classList.toggle('collapsed', panelCollapsed);
    togglePanelBtn.textContent = panelCollapsed ? '☰' : '✕';
    togglePanelBtn.title = panelCollapsed ? '展开面板' : '收起面板';
});

// FPS Counter
let frameCount = 0;
let lastFpsUpdate = performance.now();
const fpsDisplay = document.getElementById('fps').querySelector('.number');

function updateFPS() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
        fpsDisplay.textContent = fps;
        fpsDisplay.style.color = fps >= 50 ? '#6496ff' : fps >= 30 ? '#ffb449' : '#ff6464';
        frameCount = 0;
        lastFpsUpdate = now;
    }
}

// Start
resize();
render();
