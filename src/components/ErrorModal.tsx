"use client";

import { Modal } from "./ui/Modal";

/** Generic error modal - single OK button, Escape/backdrop-click both
 * dismiss. Use for any failed action whose message deserves more attention
 * than an inline red line (e.g. a blocked action with a specific reason,
 * like a scheduling conflict). */
export function ErrorModal({
  open, title = "Something went wrong", message, onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      // z-[60]: must sit above whatever modal/panel triggered the error.
      overlayClassName="z-[60]"
      panelClassName="panel w-full max-w-sm p-5 space-y-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-rose-400 text-lg leading-none mt-0.5">⚠</span>
        <div>
          <h3 className="text-sm font-bold text-rose-300">{title}</h3>
          <p className="text-sm text-gray-300 mt-1">{message}</p>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <button onClick={onClose} className="btn-gold px-4 py-1.5 text-sm">
          OK
        </button>
      </div>
    </Modal>
  );
}
