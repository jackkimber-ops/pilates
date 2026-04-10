"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { INITIAL_FORM_STATE } from "@/lib/validation";
import { loginAction } from "@/app/(auth)/login/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="next" value={next ?? "/"} />

      <FormMessage state={state} />

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="phuong@reform.local"
          autoFocus
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
        />
      </Field>

      <SubmitButton className="w-full justify-center" size="lg" pendingLabel="Signing in...">
        Sign in
        <ArrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
