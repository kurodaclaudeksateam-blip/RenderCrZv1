import { Environment, Lightformer, Sky } from '@react-three/drei';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/** Cielo convertido en mapa de entorno: da reflejos al metal, vidrio y racks sin bajar ningún HDRI. */
export function SkyEnvironment() {
  return (
    <Environment resolution={256} environmentIntensity={0.35}>
      <Sky sunPosition={[80, 50, 40]} turbidity={6} rayleigh={1.2} />
      <Lightformer form="rect" intensity={2} position={[60, 50, 30]} scale={[30, 30, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.4} color="#6b7c4b" position={[0, -10, 0]} rotation-x={Math.PI / 2} scale={[200, 200, 1]} />
    </Environment>
  );
}

/**
 * Post-procesado cinematográfico: sombras de contacto (AO) en esquinas y bajo racks,
 * resplandor en anuncios LED, tone mapping ACES, algo más de contraste y un viñeteado suave.
 */
export function Effects({ walk }: { walk: boolean }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={walk ? 0.9 : 2.5} distanceFalloff={walk ? 0.5 : 1} intensity={walk ? 3 : 5} quality="high" />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.1} intensity={0.45} radius={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0.02} contrast={0.12} />
      <HueSaturation saturation={0.12} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  );
}
