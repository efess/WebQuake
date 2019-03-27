export const vshAlias = 
`uniform vec3 uOrigin;
uniform mat3 uAngles;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
uniform vec3 uLightVec;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
varying float vLightDot;
void main(void)
{
  vec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aTexCoord;
  vLightDot = dot(aNormal, uLightVec);
}`

export const fshAlias =
`precision mediump float;
uniform float uGamma;
uniform float uAmbientLight;
uniform float uShadeLight;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
varying float vLightDot;
void main(void)
{
  vec4 texture = texture2D(tTexture, vTexCoord);
  gl_FragColor = vec4(texture.rgb * mix(1.0, vLightDot * uShadeLight + uAmbientLight, texture.a), 1.0);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshBrush =
`uniform vec3 uOrigin;
uniform mat3 uAngles;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
attribute vec3 aPosition;
attribute vec4 aTexCoord;
attribute vec4 aLightStyle;
varying vec4 vTexCoord;
varying vec4 vLightStyle;
void main(void)
{
  vec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aTexCoord;
  vLightStyle = aLightStyle;
}`

export const fshBrush =
`precision mediump float;
uniform float uGamma;
uniform sampler2D tTexture;
uniform sampler2D tLightmap;
uniform sampler2D tDlight;
uniform sampler2D tLightStyle;
varying vec4 vTexCoord;
varying vec4 vLightStyle;
void main(void)
{
  vec4 texture = texture2D(tTexture, vTexCoord.xy);
  gl_FragColor = vec4(texture.rgb *
    mix(1.0, dot(texture2D(tLightmap, vTexCoord.zw), vec4(
      texture2D(tLightStyle, vec2(vLightStyle.x, 0.0)).a,
      texture2D(tLightStyle, vec2(vLightStyle.y, 0.0)).a,
      texture2D(tLightStyle, vec2(vLightStyle.z, 0.0)).a,
      texture2D(tLightStyle, vec2(vLightStyle.w, 0.0)).a)
    * 43.828125) + texture2D(tDlight, vTexCoord.zw).a, texture.a), 1.0);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshCharacter =
`uniform vec2 uCharacter;
uniform vec2 uDest;
uniform mat4 uOrtho;
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main(void)
{
  gl_Position = uOrtho * vec4(aPosition * 8.0 + uDest, 0.0, 1.0);
  vTexCoord = (aPosition + uCharacter) * 0.0625;
}`

export const fshCharacter = 
`precision mediump float;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
void main(void)
{
  gl_FragColor = texture2D(tTexture, vTexCoord);
}`

export const vshDlight =
`uniform vec3 uOrigin;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
uniform float uRadius;
attribute vec3 aPosition;
varying float vAlpha;
void main(void)
{
  vec3 position = aPosition * 0.35 * uRadius + uViewAngles * (uOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vAlpha = aPosition.y * -0.2;
}`

export const fshDlight =
`precision mediump float;
uniform float uGamma;
varying float vAlpha;
void main(void)
{
  gl_FragColor = vec4(pow(1.0, uGamma), pow(0.5, uGamma), 0.0, vAlpha);
}`

export const vshFill =
`uniform mat4 uOrtho;
attribute vec2 aPosition;
attribute vec4 aColor;
varying vec4 vColor;
void main(void)
{
  gl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);
  vColor = aColor;
}`

export const fshFill =
`precision mediump float;
varying vec4 vColor;
void main(void)
{
  gl_FragColor = vColor;
}`

export const vshParticle =
`uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
uniform float uScale;
attribute vec3 aOrigin;
attribute vec2 aCoord;
attribute float aScale;
attribute vec3 aColor;
varying vec2 vCoord;
varying vec3 vColor;
void main(void)
{
  vec2 point = aCoord * aScale;
  vec3 position = vec3(point.x, 0.0, point.y) + uViewAngles * (aOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vCoord = aCoord;
  vColor = aColor;
}`

export const fshParticle =
`precision mediump float;
uniform float uGamma;
varying vec2 vCoord;
varying vec3 vColor;
void main(void)
{
  gl_FragColor = vec4(vColor, 1.0 - smoothstep(0.75, 1.0, length(vCoord)));
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshPic =
`uniform mat4 uOrtho;
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(void)
{
  gl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);
  vTexCoord = aTexCoord;
}`

export const fshPic =
`precision mediump float;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
void main(void)
{
  gl_FragColor = texture2D(tTexture, vTexCoord);
}`

export const vshPicTranslate =
`uniform mat4 uOrtho;
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(void)
{
  gl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);
  vTexCoord = aTexCoord;
}`

export const fshPicTranslate =
`precision mediump float;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform sampler2D tTexture;
uniform sampler2D tTrans;
varying vec2 vTexCoord;
void main(void)
{
  vec4 texture = texture2D(tTexture, vTexCoord);
  vec4 trans = texture2D(tTrans, vTexCoord);
  gl_FragColor = vec4(mix(mix(texture.rgb, uTop * trans.x, trans.y), uBottom * trans.z, trans.w), texture.a);
}`

export const vshPlayer =
`uniform vec3 uOrigin;
uniform mat3 uAngles;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
uniform vec3 uLightVec;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
varying float vLightDot;
void main(void)
{
  vec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aTexCoord;
  vLightDot = dot(aNormal, uLightVec);
}`

export const fshPlayer =
`precision mediump float;
uniform float uGamma;
uniform float uAmbientLight;
uniform float uShadeLight;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform sampler2D tTexture;
uniform sampler2D tPlayer;
varying vec2 vTexCoord;
varying float vLightDot;
void main(void)
{
  vec4 texture = texture2D(tTexture, vTexCoord);
  vec4 player = texture2D(tPlayer, vTexCoord);
  gl_FragColor = vec4(
    mix(mix(texture.rgb, uTop * (1.0 / 191.25) * player.x, player.y), uBottom * (1.0 / 191.25) * player.z, player.w)
    * mix(1.0, vLightDot * uShadeLight + uAmbientLight, texture.a), 1.0);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshSky =
`uniform mat3 uViewAngles;
uniform mat4 uPerspective;
uniform vec3 uScale;
attribute vec3 aPosition;
varying vec2 vTexCoord;
void main(void)
{
  vec3 position = uViewAngles * (aPosition * uScale * 18918.0);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aPosition.xy * uScale.xy * 1.5;
}`

export const fshSky =
`precision mediump float;
uniform float uGamma;
uniform vec2 uTime;
uniform sampler2D tSolid;
uniform sampler2D tAlpha;
varying vec2 vTexCoord;
void main(void)
{
  vec4 alpha = texture2D(tAlpha, vTexCoord + uTime.x);
  gl_FragColor = vec4(mix(texture2D(tSolid, vTexCoord + uTime.y).rgb, alpha.rgb, alpha.a), 1.0);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshSkyChain =
`uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
attribute vec3 aPosition;
void main(void)
{
  vec3 position = uViewAngles * (aPosition - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
}`

export const fshSkyChain = 
`precision mediump float;
void main(void)
{
}`

export const vshSprite =
`uniform vec4 uRect;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(void)
{
  vec3 position = uViewAngles * (aPosition - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aTexCoord;
}`

export const fshSprite =
`precision mediump float;
uniform float uGamma;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
void main(void)
{
  gl_FragColor = texture2D(tTexture, vTexCoord);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshTurbulent =
`uniform vec3 uOrigin;
uniform mat3 uAngles;
uniform vec3 uViewOrigin;
uniform mat3 uViewAngles;
uniform mat4 uPerspective;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(void)
{
  vec3 position = uViewAngles * (uAngles * aPosition + uOrigin - uViewOrigin);
  gl_Position = uPerspective * vec4(position.xz, -position.y, 1.0);
  vTexCoord = aTexCoord;
}`

export const fshTurbulent =
`precision mediump float;
uniform float uGamma;
uniform float uTime;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
void main(void)
{
  gl_FragColor = vec4(texture2D(tTexture, vTexCoord + vec2(sin(vTexCoord.t * 3.141593 + uTime), sin(vTexCoord.s * 3.141593 + uTime)) * 0.125).rgb, 1.0);
  gl_FragColor.r = pow(gl_FragColor.r, uGamma);
  gl_FragColor.g = pow(gl_FragColor.g, uGamma);
  gl_FragColor.b = pow(gl_FragColor.b, uGamma);
}`

export const vshWarp =
`uniform mat4 uOrtho;
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(void)
{
  gl_Position = uOrtho * vec4(aPosition, 0.0, 1.0);
  vTexCoord = aTexCoord;
}`

export const fshWarp =
`precision mediump float;
uniform float uTime;
uniform sampler2D tTexture;
varying vec2 vTexCoord;
void main(void)
{
  gl_FragColor = texture2D(tTexture, vTexCoord + vec2(sin(vTexCoord.t * 15.70796 + uTime) * 0.003125, sin(vTexCoord.s * 9.817477 + uTime) * 0.005));
}`