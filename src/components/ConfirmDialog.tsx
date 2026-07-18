"use client";

/** Generic yes/no confirmation modal — used before destructive actions. */
export function ConfirmDialog({
  open, title, message, confirmLabel = "Yes", cancelLabel = "No", danger = true, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="panel w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost px-3 py-1.5 text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? "btn bg-rose-600 text-white hover:brightness-110 px-3 py-1.5 text-sm" : "btn-gold px-3 py-1.5 text-sm"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
