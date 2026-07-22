/**
 * WebGL2 Loop Soul renderer — the real-time twin of `stylize.ts`.
 *
 * Runs the same look (duotone LUT + Sobel line-art + rim + flat-green composite)
 * in a fragment shader so it's fast enough for live video (30fps). The palette,
 * LUT and default params come from `palette.ts`, so a video frame reproduces the
 * photo path's look. Deterministic (no randomness) → identical input, identical
 * output. It's a real-time APPROXIMATION of the Canvas engine (single-pass edge
 * with a slightly widened tap in place of the CPU pre-smooth+dilate) — visually
 * matched, not bit-exact.
 *
 * Usage: new GLStylizer(canvas) → render(videoEl, mask, params, mirror) per frame.
 */

import { buildLUT, DEFAULTS, ELECTRIC_BRIGHT, gammaFor, type RGB } from "./palette";

export type GLParams = {
  silhouetteStrength?: number;
  edgeStrength?: number;
  edgeColor?: RGB;
  rimStrength?: number;
  posterize?: number;
  background?: RGB;
  /** Sobel tap spread (px) — stands in for the CPU pre-smooth + dilation. */
  edgeScale?: number;
};

export type MaskInput = { data: Float32Array; width: number; height: number } | null;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform int uMirror;
void main() {
  vec2 uv = aPos * 0.5 + 0.5;
  if (uMirror == 1) uv.x = 1.0 - uv.x;
  vUv = uv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uFrame;
uniform sampler2D uMask;
uniform sampler2D uLut;
uniform vec2 uTexel;
uniform float uGamma;
uniform float uEdgeStrength;
uniform vec3 uEdgeColor;
uniform float uRimStrength;
uniform vec3 uRimColor;
uniform float uBands;
uniform vec3 uBg;
uniform int uHasMask;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  float l = luma(texture(uFrame, vUv).rgb);

  // 3x3 luminance taps → Sobel (offset by uTexel: implicit pre-smooth + weight).
  float tl = luma(texture(uFrame, vUv + uTexel * vec2(-1.0,-1.0)).rgb);
  float tc = luma(texture(uFrame, vUv + uTexel * vec2( 0.0,-1.0)).rgb);
  float tr = luma(texture(uFrame, vUv + uTexel * vec2( 1.0,-1.0)).rgb);
  float ml = luma(texture(uFrame, vUv + uTexel * vec2(-1.0, 0.0)).rgb);
  float mr = luma(texture(uFrame, vUv + uTexel * vec2( 1.0, 0.0)).rgb);
  float bl = luma(texture(uFrame, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
  float bc = luma(texture(uFrame, vUv + uTexel * vec2( 0.0, 1.0)).rgb);
  float br = luma(texture(uFrame, vUv + uTexel * vec2( 1.0, 1.0)).rgb);
  float gx = (tr + 2.0*mr + br) - (tl + 2.0*ml + bl);
  float gy = (bl + 2.0*bc + br) - (tl + 2.0*tc + tr);
  float line = clamp((length(vec2(gx, gy)) / 2.0 - 0.06) / 0.4, 0.0, 1.0);

  // Tone → posterize → brand LUT.
  float tone = pow(clamp(l, 0.0, 1.0), uGamma);
  if (uBands > 1.0) tone = floor(tone * (uBands - 1.0) + 0.5) / (uBands - 1.0);
  vec3 s = texture(uLut, vec2(tone, 0.5)).rgb;

  float conf = uHasMask == 1 ? texture(uMask, vUv).r : 1.0;

  // Contour line-art.
  s = mix(s, uEdgeColor, line * uEdgeStrength * conf);

  // Rim light from the mask gradient (4 taps).
  if (uHasMask == 1 && uRimStrength > 0.0) {
    float mL = texture(uMask, vUv + uTexel * vec2(-1.0, 0.0)).r;
    float mR = texture(uMask, vUv + uTexel * vec2( 1.0, 0.0)).r;
    float mU = texture(uMask, vUv + uTexel * vec2( 0.0,-1.0)).r;
    float mD = texture(uMask, vUv + uTexel * vec2( 0.0, 1.0)).r;
    float mg = length(vec2(mR - mL, mD - mU));
    float rim = conf > 0.12 ? clamp(mg * 1.5, 0.0, 1.0) * uRimStrength : 0.0;
    s = mix(s, uRimColor, rim);
  }

  frag = vec4(mix(uBg, s, conf), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`[pose:gl] shader compile failed: ${log}`);
  }
  return sh;
}

const norm = (c: RGB): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255];

export class GLStylizer {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private frameTex: WebGLTexture;
  private maskTex: WebGLTexture;
  private lutTex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private maskBuf: Uint8Array | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 not available on this device.");
    this.gl = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`[pose:gl] link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.prog = prog;
    gl.useProgram(prog);

    // Fullscreen triangle-pair quad.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of ["uFrame","uMask","uLut","uTexel","uGamma","uEdgeStrength","uEdgeColor","uRimStrength","uRimColor","uBands","uBg","uHasMask","uMirror"]) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1i(this.u.uFrame, 0);
    gl.uniform1i(this.u.uMask, 1);
    gl.uniform1i(this.u.uLut, 2);

    this.frameTex = this.makeTex();
    this.maskTex = this.makeTex();
    this.lutTex = this.makeTex();

    // Upload the brand LUT once (256x1 RGB8).
    const lut = buildLUT();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, lut);
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  /** Render one frame. `frame` is any TexImageSource (usually the <video>). */
  render(frame: TexImageSource, mask: MaskInput, params: GLParams = {}, mirror = false): void {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);

    // Frame texture (flip Y so the video is upright).
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frameTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    // Mask texture (R8) — MediaPipe confidence 0..1 → 0..255.
    const hasMask = !!mask && mask.data.length === mask.width * mask.height;
    if (hasMask && mask) {
      if (!this.maskBuf || this.maskBuf.length !== mask.data.length) this.maskBuf = new Uint8Array(mask.data.length);
      for (let i = 0; i < mask.data.length; i++) this.maskBuf[i] = mask.data[i] * 255;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, mask.width, mask.height, 0, gl.RED, gl.UNSIGNED_BYTE, this.maskBuf);
    }
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);

    // Uniforms (defaults from the shared palette so video == photo).
    const edgeScale = params.edgeScale ?? 1.5;
    gl.uniform2f(this.u.uTexel, edgeScale / w, edgeScale / h);
    gl.uniform1f(this.u.uGamma, gammaFor(params.silhouetteStrength ?? DEFAULTS.silhouetteStrength));
    gl.uniform1f(this.u.uEdgeStrength, params.edgeStrength ?? DEFAULTS.edgeStrength);
    gl.uniform3fv(this.u.uEdgeColor, norm(params.edgeColor ?? DEFAULTS.edgeColor));
    gl.uniform1f(this.u.uRimStrength, params.rimStrength ?? DEFAULTS.rimStrength);
    gl.uniform3fv(this.u.uRimColor, norm(ELECTRIC_BRIGHT));
    gl.uniform1f(this.u.uBands, params.posterize ?? DEFAULTS.posterize);
    gl.uniform3fv(this.u.uBg, norm(params.background ?? DEFAULTS.background));
    gl.uniform1i(this.u.uHasMask, hasMask ? 1 : 0);
    gl.uniform1i(this.u.uMirror, mirror ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.frameTex);
    gl.deleteTexture(this.maskTex);
    gl.deleteTexture(this.lutTex);
    gl.deleteProgram(this.prog);
  }
}
