// The three variant angles, generated alongside the main prompt. `key` is the
// output/storage key, `label` is shown as a tab on the project page, `angle`
// is the instruction handed to the model.
export const GENERAL_VARIANTS = [
  {
    key: "variant_a",
    label: "Knapp & direkt",
    angle:
      "A tight, minimal version, the shortest prompt that still fully specifies the task. Strip every non-essential word; no role-play, no padding.",
  },
  {
    key: "variant_b",
    label: "Ausführlich & geführt",
    angle:
      "A thorough, guided version, richer context, explicit step-by-step instructions, and a short example of the desired output so the assistant has a target to match.",
  },
  {
    key: "variant_c",
    label: "Rollenbasiert",
    angle:
      "A persona-driven version, open by casting the assistant as a specific named expert, give it quality criteria, and ask it to self-check against them before answering.",
  },
] as const;
