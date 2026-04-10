"use server";

import { redirect } from "next/navigation";
import { signInWithPassword } from "@/lib/auth/session";
import { INITIAL_FORM_STATE, type FormState, fromZodError, loginSchema } from "@/lib/validation";

function getSafeRedirectTarget(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0 || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

export async function loginAction(_: FormState = INITIAL_FORM_STATE, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const user = await signInWithPassword(parsed.data.email, parsed.data.password);

  if (!user) {
    return {
      ok: false,
      message: "Invalid email or password.",
    };
  }

  redirect(getSafeRedirectTarget(formData.get("next")));
}
