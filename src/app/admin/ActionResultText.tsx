import type { ActionMessage } from './useApiAction';

/** The inline outcome of an admin action. Always rendered so screen readers get the live region early. */
export function ActionResultText({ message }: { message: ActionMessage | null }) {
  return (
    <p className="admin-result" role="status" data-tone={message?.tone}>
      {message?.text}
    </p>
  );
}
