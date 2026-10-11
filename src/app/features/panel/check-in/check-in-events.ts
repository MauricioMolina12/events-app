/**
 * Cross-tab signal that a scan assigned new turns.
 *
 * The door usually runs the scanner in one tab (or device) and the desk keeps the
 * dashboard open in another. A `BroadcastChannel` lets the dashboard refresh right after a
 * scan in the same browser without polling faster; other devices still get the change on
 * the dashboard's regular refresh. Only a hint travels here: the numbers are always
 * re-read from the server.
 */

const CHANNEL_NAME = 'bt-events:check-in';

export interface CheckInNotice {
  readonly type: 'checked-in';
  readonly eventId: string;
}

export function announceCheckIn(eventId: string): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: 'checked-in', eventId } satisfies CheckInNotice);
  channel.close();
}

/** Returns the unsubscribe function. */
export function listenCheckIns(onNotice: (notice: CheckInNotice) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (message: MessageEvent<CheckInNotice>) => {
    if (message.data?.type === 'checked-in') {
      onNotice(message.data);
    }
  };
  return () => channel.close();
}
