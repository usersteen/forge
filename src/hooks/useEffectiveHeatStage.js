import useForgeStore from "../store/useForgeStore";
import { getHeatStage } from "../utils/heat";

const selectEffectiveHeat = (s) =>
  s.demoHeatStage !== null ? s.demoHeatStage : getHeatStage(s.streak);

export default function useEffectiveHeatStage() {
  return useForgeStore(selectEffectiveHeat);
}
