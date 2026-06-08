import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraPreset, RenderNode, SectorId } from "../domain/types";
import { CapitalMapScene } from "./CapitalMapScene";

interface HunterSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}

export function HunterScene(props: HunterSceneProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      className="hunter-canvas"
      camera={{ position: [9, 9.5, 12], fov: 45 }}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#10151b"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow />
      <CapitalMapScene
        nodes={props.nodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={props.selectedSectorId}
        onSelectSector={props.onSelectSector}
        orbitControlsRef={orbitControlsRef}
      />
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}
