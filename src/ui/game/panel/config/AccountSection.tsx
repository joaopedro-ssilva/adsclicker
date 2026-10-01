import { useState } from 'react';
import { useCloud } from '@/game/cloud';
import { Button } from '@/ui/kit';
import { SyncStatus } from '../../cloud/SyncStatus';
import { Section } from '../lib/Section';
import { LoginForm } from './LoginForm';
import { NicknameForm } from './NicknameForm';
import { PasswordForm } from './PasswordForm';

type Panel = 'password' | 'login' | null;

/** Account in the settings tab: pick a nickname, protect with a password, sign in elsewhere, sign out. */
export function AccountSection() {
  const me = useCloud((store) => store.me);
  const status = useCloud((store) => store.status);
  const unavailable = useCloud((store) => store.unavailable);
  const logout = useCloud((store) => store.logout);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);

  const signOut = async () => {
    setLoggingOut(true);
    setLogoutFailed(false);
    await logout();
    setLoggingOut(false);
    setLogoutFailed(useCloud.getState().me !== null);
  };

  const loginEntry = (
    <Button size="sm" variant="ghost" data-qa="account-open-login" onClick={() => setPanel('login')}>
      Já tenho conta
    </Button>
  );

  let body;
  if (unavailable) {
    body = null; // the status line already says it, in one line
  } else if (me && panel === 'login') {
    body = <LoginForm onDone={() => setPanel(null)} onCancel={() => setPanel(null)} />;
  } else if (!me) {
    body = (
      <p className="setting-hint">
        {status === 'offline'
          ? 'Sem conexão com a nuvem. Quando ela voltar, você poderá escolher um apelido aqui.'
          : 'Conectando à nuvem…'}
      </p>
    );
  } else if (!me.nickname) {
    body = (
      <>
        <NicknameForm onPasswordFailed={setNotice} />
        {loginEntry}
      </>
    );
  } else {
    body = (
      <>
        <div className="account-identity">
          <p className="setting-hint">Você joga como</p>
          <p className="account-nickname" data-qa="account-nickname">
            {me.nickname}
          </p>
          {!me.ranked && me.unrankedReason ? <p className="setting-hint">{me.unrankedReason}</p> : null}
        </div>

        {notice && !me.hasPassword ? (
          <p className="save-warning" role="alert">
            Apelido salvo, mas a senha não: {notice}
          </p>
        ) : null}

        {panel === 'password' ? (
          <PasswordForm
            change={me.hasPassword}
            onDone={() => {
              setPanel(null);
              setNotice(null);
            }}
            onCancel={() => setPanel(null)}
          />
        ) : (
          <>
            <p className="setting-hint">
              {me.hasPassword
                ? 'Ao sair, o progresso continua neste aparelho.'
                : 'Com uma senha você joga a mesma conta em outro aparelho.'}
            </p>
            <div className="account-actions">
              <Button size="sm" variant="secondary" data-qa="account-open-password" onClick={() => setPanel('password')}>
                {me.hasPassword ? 'Trocar senha' : 'Proteger com senha'}
              </Button>
              {me.hasPassword ? (
                <Button size="sm" variant="ghost" disabled={loggingOut} data-qa="account-logout" onClick={signOut}>
                  Sair
                </Button>
              ) : null}
            </div>
          </>
        )}
        {logoutFailed ? (
          <p className="save-warning" data-tone="bad" role="alert">
            Não foi possível sair agora. Tente de novo.
          </p>
        ) : null}
        {!me.hasPassword && panel === null ? loginEntry : null}
      </>
    );
  }

  return (
    <Section title="Conta">
      <div className="setting-group account" data-qa="account">
        <SyncStatus />
        {body}
      </div>
    </Section>
  );
}
