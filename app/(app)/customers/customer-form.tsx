"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { upsertCustomerAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

type ImportedBalanceDraft = {
  id: string;
  classTypeId: string;
  remainingCredits: string;
  originalCredits: string;
  expiryDate: string;
  notes: string;
};

type CustomerFormProps = {
  redirectTo: string;
  classTypes?: Array<{
    id: string;
    name: string;
  }>;
  initialValues?: {
    id?: string;
    fullName?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    tags?: string[];
    status?: "ACTIVE" | "INACTIVE";
  };
};

function createImportedBalanceDraft(): ImportedBalanceDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    classTypeId: "",
    remainingCredits: "",
    originalCredits: "",
    expiryDate: "",
    notes: "Imported from previous system",
  };
}

export function CustomerForm({ redirectTo, classTypes = [], initialValues }: CustomerFormProps) {
  const [state, action] = useActionState(upsertCustomerAction, INITIAL_FORM_STATE);
  const isCreateMode = !initialValues?.id;
  const [importedBalances, setImportedBalances] = useState<ImportedBalanceDraft[]>([]);
  const importedBalancesJson = useMemo(
    () =>
      JSON.stringify(
        importedBalances
          .filter((balance) => balance.classTypeId && balance.remainingCredits !== "")
          .map((balance) => ({
            classTypeId: balance.classTypeId,
            remainingCredits: Number(balance.remainingCredits),
            originalCredits:
              balance.originalCredits === "" ? undefined : Number(balance.originalCredits),
            expiryDate: balance.expiryDate || undefined,
            notes: balance.notes.trim() || undefined,
          })),
      ),
    [importedBalances],
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="importedBalancesJson" value={importedBalancesJson} />

      <FormMessage state={state} />

      <Field label="Full name" htmlFor="fullName" error={state.fieldErrors?.fullName?.[0]}>
        <Input id="fullName" name="fullName" defaultValue={initialValues?.fullName ?? ""} />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone?.[0]}>
          <Input id="phone" name="phone" defaultValue={initialValues?.phone ?? ""} />
        </Field>

        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues?.email ?? ""}
          />
        </Field>
      </div>

      <Field label="Tags" htmlFor="tags" hint="Comma-separated" error={state.fieldErrors?.tags?.[0]}>
        <Input id="tags" name="tags" defaultValue={initialValues?.tags?.join(", ") ?? ""} />
      </Field>

      <Field label="Status" htmlFor="status" error={state.fieldErrors?.status?.[0]}>
        <Select id="status" name="status" defaultValue={initialValues?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </Field>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" defaultValue={initialValues?.notes ?? ""} />
      </Field>

      {isCreateMode && classTypes.length ? (
        <div className="surface-inset rounded-[24px] p-4 md:p-5">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Onboarding</p>
              <h3 className="font-display text-[1.4rem] leading-none tracking-[-0.04em] text-ink">
                Starting balances
              </h3>
            </div>
            <Badge tone="outline">{importedBalances.length}</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {importedBalances.length ? (
              importedBalances.map((balance, index) => (
                <div key={balance.id} className="list-row-quiet space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">Balance {index + 1}</p>
                    <button
                      type="button"
                      className="text-sm font-medium text-muted transition hover:text-ink"
                      onClick={() =>
                        setImportedBalances((current) =>
                          current.filter((entry) => entry.id !== balance.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Class type">
                      <Select
                        value={balance.classTypeId}
                        onChange={(event) =>
                          setImportedBalances((current) =>
                            current.map((entry) =>
                              entry.id === balance.id
                                ? { ...entry, classTypeId: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="">Select class type</option>
                        {classTypes.map((classType) => (
                          <option key={classType.id} value={classType.id}>
                            {classType.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Remaining sessions">
                      <Input
                        type="number"
                        min={0}
                        value={balance.remainingCredits}
                        onChange={(event) =>
                          setImportedBalances((current) =>
                            current.map((entry) =>
                              entry.id === balance.id
                                ? { ...entry, remainingCredits: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Original sessions">
                      <Input
                        type="number"
                        min={0}
                        value={balance.originalCredits}
                        onChange={(event) =>
                          setImportedBalances((current) =>
                            current.map((entry) =>
                              entry.id === balance.id
                                ? { ...entry, originalCredits: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </Field>

                    <Field label="Expiry date">
                      <Input
                        type="date"
                        value={balance.expiryDate}
                        onChange={(event) =>
                          setImportedBalances((current) =>
                            current.map((entry) =>
                              entry.id === balance.id
                                ? { ...entry, expiryDate: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Notes">
                    <Textarea
                      value={balance.notes}
                      onChange={(event) =>
                        setImportedBalances((current) =>
                          current.map((entry) =>
                            entry.id === balance.id ? { ...entry, notes: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">No starting balances.</p>
            )}
          </div>

          <button
            type="button"
            className="mt-4 text-sm font-semibold text-accent-strong transition hover:text-ink"
            onClick={() =>
              setImportedBalances((current) => [...current, createImportedBalanceDraft()])
            }
          >
            Add starting balance
          </button>
        </div>
      ) : null}

      <div className="action-dock">
        <div className="action-dock-panel">
          <SubmitButton className="w-full md:w-auto" size="lg" pendingLabel="Saving...">
            {initialValues?.id ? "Save" : "Create customer"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
