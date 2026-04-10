import type { FormState } from "@/lib/validation";

export function FormMessage({ state }: { state?: FormState }) {
  if (!state?.message) {
    return null;
  }

  return (
    <div
      className={`rounded-[22px] border px-4 py-3.5 text-sm leading-6 ${
        state.ok
          ? "border-transparent bg-sage-soft/86 text-sage shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
          : "border-transparent bg-danger-soft/86 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
      }`}
    >
      {state.message}
    </div>
  );
}
