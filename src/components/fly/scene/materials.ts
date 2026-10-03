import * as THREE from 'three';
import { FALL } from '@/lib/fly/rules';
import type { LiveLook } from './look';

/**
 * Uniforms every piece of stone shares. The colours are the LiveLook's own
 * objects, so a change of sky is a blend of values, never a recompile.
 */
export interface StoneUniforms {
  uPlayer: { value: THREE.Vector3 };
  /** His shadow's centre (x, his height, z): where he is, or where he was. */
  uShadow: { value: THREE.Vector3 };
  uShadowStrength: { value: number };
  uStoneLight: { value: THREE.Color };
  uStoneDark: { value: THREE.Color };
  uAccent: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  /** Edge light; the music breathes it. */
  uRim: { value: number };
  /** Stone glows as he nears it, so close is something you can see. */
  uGlow: { value: number };
  /** The last kiss: where, and how long ago (s; negative for none). */
  uKiss: { value: THREE.Vector4 };
  uArena: { value: number };
}

export function createStoneUniforms(look: LiveLook): StoneUniforms {
  return {
    uPlayer: { value: new THREE.Vector3() },
    uShadow: { value: new THREE.Vector3() },
    uShadowStrength: { value: 1 },
    uStoneLight: { value: look.colors.stoneLight },
    uStoneDark: { value: look.colors.stoneDark },
    uAccent: { value: look.colors.accent },
    uRimColor: { value: look.colors.rim },
    uRim: { value: 0.22 },
    uGlow: { value: 1 },
    uKiss: { value: new THREE.Vector4(0, 0, 0, -1) },
    uArena: { value: FALL.arena },
  };
}

/** World position into the fragment shader, for every effect below. */
function withWorldPosition(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vFlyWorld;`)
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 flyWorld = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        flyWorld = instanceMatrix * flyWorld;
      #endif
      vFlyWorld = ( modelMatrix * flyWorld ).xyz;`,
    );
}

/**
 * Anything above him melts away (dithered, so it reads as a fade): the floor
 * he just fell through must never come between him and the camera.
 */
const ABOVE_FADE = /* glsl */ `
  float flyAbove = vFlyWorld.y - uPlayer.y;
  if ( flyAbove > 0.6 ) {
    float flyFade = smoothstep( 0.6, 4.5, flyAbove );
    float flyDither = fract( 52.9829189 * fract( dot( floor( gl_FragCoord.xy ), vec2( 0.06711056, 0.00583715 ) ) ) );
    if ( flyFade > flyDither ) discard;
  }
`;

/**
 * The stone of the sky: flat-shaded Lambert lit from straight above (heaven),
 * coloured from the look, with his shadow falling on what lies below him and
 * a glow on whatever he is close to.
 *
 * Instance colours carry data, not colour: r is the shade (light to dark),
 * g is the accent share.
 */
export function createStoneMaterial(uniforms: StoneUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    withWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uPlayer;
        uniform vec3 uShadow;
        uniform float uShadowStrength;
        uniform vec3 uStoneLight;
        uniform vec3 uStoneDark;
        uniform vec3 uAccent;
        uniform vec3 uRimColor;
        uniform float uRim;
        uniform float uGlow;
        uniform vec4 uKiss;
        uniform float uArena;
        varying vec3 vFlyWorld;`,
      )
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${ABOVE_FADE}`)
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
          vec3 flyStone = mix( uStoneLight, uStoneDark, vColor.r * vColor.r );
          flyStone = mix( flyStone, uAccent, vColor.g );
          diffuseColor.rgb *= flyStone;
        #endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `
        // His shadow, cast straight down by the light above onto what lies below.
        vec3 flyFaceNormal = normalize( cross( dFdx( vFlyWorld ), dFdy( vFlyWorld ) ) );
        float flyBelow = uShadow.y - vFlyWorld.y;
        if ( flyBelow > 0.3 && abs( flyFaceNormal.y ) > 0.5 ) {
          float flyRadius = 1.1 + flyBelow * 0.016;
          float flyD = length( vFlyWorld.xz - uShadow.xz );
          float flyCore = 1.0 - smoothstep( flyRadius * 0.55, flyRadius * 1.15, flyD );
          float flyDeep = 1.0 - smoothstep( 90.0, 320.0, flyBelow );
          outgoingLight *= 1.0 - 0.62 * flyCore * flyDeep * uShadowStrength;
        }
        // Outside the arena he cannot reach; the stone there sits a little darker.
        float flyOutside = max( step( uArena, abs( vFlyWorld.x ) ), step( uArena, abs( vFlyWorld.z ) ) );
        outgoingLight *= mix( 1.0, 0.92, flyOutside );
        // Edge light.
        float flyFacing = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
        outgoingLight += uRimColor * pow( 1.0 - flyFacing, 3.0 ) * uRim;
        // The glow of being close.
        float flyNear = length( vFlyWorld - uPlayer );
        outgoingLight += uRimColor * ( 1.0 - smoothstep( 0.0, 3.6, flyNear ) ) * 0.85 * uGlow;
        // A kiss rings out across the stone it touched.
        if ( uKiss.w >= 0.0 && uKiss.w < 0.7 ) {
          float flyKiss = length( vFlyWorld - uKiss.xyz );
          float flyRing = 1.0 - smoothstep( 0.0, 1.5 + uKiss.w * 9.0, flyKiss );
          outgoingLight += uRimColor * flyRing * ( 1.0 - uKiss.w / 0.7 ) * 1.3;
        }
        #include <opaque_fragment>`,
      );
  };
  return material;
}

/** Gates: rings of light in the rim colour, fading above him like the stone. */
export function createGateMaterial(uniforms: StoneUniforms): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ fog: true });
  // The look's own colour object, not a copy, so the gates follow the sky.
  material.color = uniforms.uRimColor.value;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayer = uniforms.uPlayer;
    withWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uPlayer;\nvarying vec3 vFlyWorld;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${ABOVE_FADE}`);
  };
  return material;
}
