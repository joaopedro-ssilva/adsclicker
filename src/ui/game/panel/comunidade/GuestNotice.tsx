import { Button } from '@/ui/kit';
import { useUi } from '../../shared/uiStore';

/** Opens the Config tab and puts the cursor in the account form, where a nickname and a password are created. */
export function openAccountFlow() {
  useUi.getState().setTab('config');
  // The Config tab mounts on the next render: wait for it, then bring the form into view.
  window.setTimeout(() => {
    const field = document.querySelector<HTMLInputElement>('[data-qa="account-nickname-input"]');
    const target = field ?? document.querySelector<HTMLElement>('[data-qa="account"]');
    target?.scrollIntoView({ block: 'center' });
    field?.focus({ preventScroll: true });
  }, 60);
}

/** Shown to a player without a nickname: the way into the rankings is an account. */
export function GuestNotice() {
  return (
    <div className="community-guest" role="note" data-qa="community-guest-notice">
      <p>
        <strong>Você ainda não aparece nos rankings.</strong> Para entrar na disputa, crie uma conta com apelido e senha.
      </p>
      <Button size="sm" onClick={openAccountFlow} data-qa="community-create-account">
        Criar conta
      </Button>
    </div>
  );
}
