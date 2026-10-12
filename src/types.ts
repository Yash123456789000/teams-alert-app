/** One Teams alert as received in an FCM data payload. */
export type AlertPayload = {
  /** Locally generated id; doubles as the CallKeep call UUID. */
  uuid: string;
  sender: string;
  message: string;
  receivedAt: number;
};

export type Settings = {
  backendUrl: string;
  secret: string;
};

export type RegistrationStatus =
  | 'unregistered'
  | 'registering'
  | 'registered'
  | 'error';

export type RegistrationState = {
  status: RegistrationStatus;
  /** Error text for 'error', or a hint for 'unregistered'. */
  message?: string;
};

export type Route =
  | {name: 'home'}
  | {name: 'settings'}
  | {name: 'incoming'; alert: AlertPayload}
  | {name: 'alert'; alert: AlertPayload};
