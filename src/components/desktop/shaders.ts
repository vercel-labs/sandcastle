const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Subtle gradient with slow-moving noise distortion
const AURORA_FRAGMENT = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_light;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.08;

    float wave1 = sin(uv.x * 2.5 + t) * 0.12;
    float wave2 = sin(uv.x * 4.0 - t * 0.7 + 1.5) * 0.08;
    float wave3 = sin(uv.x * 6.0 + t * 0.5 + 3.0) * 0.05;
    float center = 0.55 + wave1 + wave2 + wave3;

    float dist = abs(uv.y - center);
    float glow = exp(-dist * 5.0) * 0.25;
    float glow2 = exp(-dist * 15.0) * 0.15;

    float base = mix(0.02, 0.95, u_light);
    float highlight = mix(0.25, 0.75, u_light);

    float v = glow + glow2;
    vec3 col = vec3(base + v * (highlight - base));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Soft drifting blobs — like vercel.com hero
const MESH_GRADIENT_FRAGMENT = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_light;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.1;

    vec2 p1 = vec2(0.3 + sin(t * 0.7) * 0.2, 0.3 + cos(t * 0.5) * 0.2);
    vec2 p2 = vec2(0.7 + cos(t * 0.6) * 0.2, 0.7 + sin(t * 0.8) * 0.2);
    vec2 p3 = vec2(0.5 + sin(t * 0.9 + 2.0) * 0.25, 0.5 + cos(t * 0.4 + 1.0) * 0.25);

    float d1 = length(uv - p1);
    float d2 = length(uv - p2);
    float d3 = length(uv - p3);

    float w1 = 1.0 / (d1 * d1 + 0.02);
    float w2 = 1.0 / (d2 * d2 + 0.02);
    float w3 = 1.0 / (d3 * d3 + 0.02);
    float wt = w1 + w2 + w3;

    // Dark: blobs are lighter gray on black
    // Light: blobs are darker gray on white
    float v1 = mix(0.14, 0.88, u_light);
    float v2 = mix(0.08, 0.92, u_light);
    float v3 = mix(0.18, 0.85, u_light);

    float v = (v1 * w1 + v2 * w2 + v3 * w3) / wt;
    vec3 col = vec3(v);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Horizontal lines with gentle undulation
const WAVES_FRAGMENT = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_light;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.15;

    float base = mix(0.02, 0.96, u_light);
    float lineColor = mix(0.20, 0.82, u_light);

    vec3 col = vec3(base);

    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float freq = 1.5 + fi * 0.8;
      float speed = 0.3 + fi * 0.08;
      float amp = 0.02 / (1.0 + fi * 0.2);

      float wave = sin(uv.x * freq + t * speed + fi * 1.5) * amp;
      float center = 0.1 + fi * 0.1 + wave;
      float d = abs(uv.y - center);
      float line = exp(-d * 60.0) * 0.12;

      col += vec3(lineColor - base) * line;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Slowly morphing simplex noise — organic texture
const NOISE_FLOW_FRAGMENT = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_light;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float t = u_time * 0.1;

    float n1 = snoise(uv * 2.5 + vec2(t, t * 0.7));
    float n2 = snoise(uv * 4.0 - vec2(t * 0.5, t * 0.3));
    float n3 = snoise(uv * 6.0 + vec2(t * 0.3, -t * 0.4));

    float n = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
    float normalized = n * 0.5 + 0.5;

    float base = mix(0.02, 0.96, u_light);
    float range = mix(0.14, -0.06, u_light);

    float v = base + normalized * range;
    vec3 col = vec3(v);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Slow radial ripple — concentric circles emanating from center
const RIPPLE_FRAGMENT = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_light;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 center = vec2(0.5, 0.5);
    float t = u_time * 0.2;

    float dist = length(uv - center);

    float ring1 = sin(dist * 20.0 - t * 2.0) * 0.5 + 0.5;
    float ring2 = sin(dist * 14.0 - t * 1.5 + 1.0) * 0.5 + 0.5;
    float combined = (ring1 * 0.6 + ring2 * 0.4);

    float fade = 1.0 - smoothstep(0.0, 0.7, dist);
    combined *= fade * 0.14;

    float base = mix(0.02, 0.96, u_light);
    float v = base + combined * mix(1.0, -1.0, u_light);

    gl_FragColor = vec4(vec3(v), 1.0);
  }
`;

export const SHADER_SOURCES: Record<string, { vertex: string; fragment: string }> = {
  aurora: { vertex: VERTEX_SHADER, fragment: AURORA_FRAGMENT },
  "mesh-gradient": { vertex: VERTEX_SHADER, fragment: MESH_GRADIENT_FRAGMENT },
  waves: { vertex: VERTEX_SHADER, fragment: WAVES_FRAGMENT },
  "noise-flow": { vertex: VERTEX_SHADER, fragment: NOISE_FLOW_FRAGMENT },
  ripple: { vertex: VERTEX_SHADER, fragment: RIPPLE_FRAGMENT },
};
