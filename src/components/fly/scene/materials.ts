import * as THREE from 'three';
import { WORLD } from '../engine/world';

/**
 * Uniforms every form shares. Phase 2 drives `uRim` from the music: the bass
 * lights the edges of the world.
 */
export interface FormUniforms {
  uRim: { value: number };
  uRimColor: { value: THREE.Color };
  uDeep: { value: number };
  uGlide: { value: number };
}

export function createFormUniforms(rimColor: string): FormUniforms {
  return {
    uRim: { value: 0.22 },
    uRimColor: { value: new THREE.Color(rimColor) },
    uDeep: { value: 0.42 },
    uGlide: { value: WORLD.glideSlope },
  };
}

/**
 * The stone of the world: flat-shaded Lambert, darkening with depth below the
 * glide line and catching a rim of light at its edges.
 *
 * Flat shading matters here beyond the look: forms are sheared along the glide,
 * and three's instanced normals do not survive a shear. Flat shading takes the
 * normal from the surface itself, so the light is right.
 */
export function createFormMaterial(uniforms: FormUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uGlide;
        varying float vFlyHeight;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 flyWorld = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          flyWorld = instanceMatrix * flyWorld;
        #endif
        flyWorld = modelMatrix * flyWorld;
        vFlyHeight = flyWorld.y - uGlide * flyWorld.z;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRim;
        uniform vec3 uRimColor;
        uniform float uDeep;
        varying float vFlyHeight;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= mix( uDeep, 1.0, smoothstep( -70.0, 14.0, vFlyHeight ) );
        float flyFacing = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
        outgoingLight += uRimColor * pow( 1.0 - flyFacing, 3.0 ) * uRim;
        #include <opaque_fragment>`,
      );
  };
  return material;
}
