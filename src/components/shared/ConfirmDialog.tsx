"use client";

import { AlertModal, Button } from "@dejesumensaje/converge-ds-experimental";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headline: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm = error-colored primary. */
  destructive?: boolean;
  onConfirm: () => void;
};

// Standard confirm/cancel dialog over the DS AlertModal, so destructive actions
// (e.g. discarding a price edit) explain what will happen before proceeding.
export function ConfirmDialog({
  open,
  onOpenChange,
  headline,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
}: Props) {
  return (
    <AlertModal
      open={open}
      onOpenChange={onOpenChange}
      variant="alert"
      headline={headline}
      description={description}
      footer={
        <div className="flex w-full justify-center gap-2">
          <Button variant="secondary" autoFocus onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            error={destructive}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    />
  );
}
