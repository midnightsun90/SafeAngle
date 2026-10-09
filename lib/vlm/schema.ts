import { VLM_JOINTS } from "./contract.ts";

const point = { anyOf: [
  { type: "object", additionalProperties: false, required: ["x", "y"], properties: {
    x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 },
  } },
  { type: "null" },
] };
export const VLM_OUTPUT_FORMAT = {
  type: "json_schema", name: "safeangle_selected_joints", strict: true,
  schema: { type: "object", additionalProperties: false, required: VLM_JOINTS,
    properties: Object.fromEntries(VLM_JOINTS.map(name => [name, point])),
  },
} as const;
