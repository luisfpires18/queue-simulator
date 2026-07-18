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
}
