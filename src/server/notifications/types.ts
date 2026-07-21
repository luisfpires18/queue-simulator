export interface NotificationMessage {
  title: string;
  body: string;
  url: string;
}

export interface NotificationDefinition<TPayload> {
  type: string;
  // Reads this type's slice of the user's NotificationPreference.settings JSON
  // (settings[type]) and decides whether payload should notify that user.
  matches(settings: any, payload: TPayload): boolean;
  build(payload: TPayload): NotificationMessage;
  // Id of the user who caused the event, if any — excluded from recipients.
  excludeUserId?(payload: TPayload): string | undefined;

  // ---- settings-UI metadata (added for the recruitment types) ----
  // Human label and one-line explanation, so the profile Notifications tab can
  // render a toggle per type from this registry instead of hardcoding each
  // one. Optional so the pre-existing group_created entry (which has its own
  // bespoke controls) is unaffected.
  label?: string;
  description?: string;

  // "broadcast" types fan out to every opted-in user (notify()) and are
  // off unless the user opts in. "direct" types are the consequence of an
  // action the recipient is party to — an application they sent, a listing
  // they own — so they are sent via notifyUserTyped() and default to ON,
  // with this registry entry providing the opt-OUT.
  delivery?: "broadcast" | "direct";
}
