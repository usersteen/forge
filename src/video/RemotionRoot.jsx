import { Composition } from "remotion";
import { ForgeSocialThemeCycle } from "./ForgeSocialThemeCycle";

export function RemotionRoot() {
  return (
    <Composition
      id="ForgeSocialThemeCycle"
      component={ForgeSocialThemeCycle}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
