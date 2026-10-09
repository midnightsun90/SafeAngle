import lifting from "../../public/demo/lifting.png";
import seatedWork from "../../public/demo/seated-work.png";
import pushingCart from "../../public/demo/pushing-cart.png";
import type { VideoNumber } from "@/components/VideoFilesProvider";

export const demoImages = {
  1: lifting,
  2: seatedWork,
  3: pushingCart,
} satisfies Record<VideoNumber, typeof lifting>;
