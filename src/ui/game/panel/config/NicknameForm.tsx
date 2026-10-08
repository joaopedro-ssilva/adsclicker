import { useState, type FormEvent } from 'react';
import { useCloud } from '@/game/cloud';
import { NICKNAME_MAX, PASSWORD_MAX, nicknameSchema, passwordSchema } from '@/shared/api';
import { Button } from '@/ui/kit';
import { AccountField } from './AccountField';
import { useAccountAction } from './useAccountAction';
import { firstIssue } from './validate';

/** Guest without a nickname: creating the account takes a nickname and a password, typed twice. */
export function NicknameForm() {
  const setNickname = useCloud((store) => store.setNickname);
  const [nickname, setNicknameValue] = useState('');
  const [password, setPasswordValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { pending, error, run } = useAccountAction();

  const nicknameIssue = nickname.length > 0 ? firstIssue(nicknameSchema, nickname) : null;
  const passwordIssue = password.length > 0 ? firstIssue(passwordSchema, password) : null;
  const confirmationIssue =
    confirmation.length > 0 && confirmation !== password ? 'As duas senhas precisam ser iguais.' : null;
  const ready =
    nickname.trim().length > 0 &&
    !nicknameIssue &&
    password.length > 0 &&
    !passwordIssue &&
    confirmation === password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    await run(() => setNickname(nickname.trim(), password));
  };

  const serverOnNickname = error && (error.code === 'nickname_taken' || error.code === 'invalid');
  const nicknameError = nicknameIssue ?? (serverOnNickname ? error.message : null);
  const formError = error && !serverOnNickname ? error.message : null;

  return (
    <form className="account-form" onSubmit={submit} noValidate data-qa="account-create-form">
      <p className="setting-label">Crie sua conta para entrar no ranking</p>
      <AccountField
        label="Apelido"
        value={nickname}
        onChange={setNicknameValue}
        autoComplete="username"
        maxLength={NICKNAME_MAX}
        error={nicknameError}
        hint="De 3 a 16 caracteres. É como os outros jogadores vão te ver."
        testId="account-nickname-input"
      />
      <AccountField
        label="Senha"
        type="password"
        value={password}
        onChange={setPasswordValue}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={passwordIssue}
        hint="De 6 a 72 caracteres. Com ela você entra em outro aparelho."
        testId="account-password-input"
      />
      <AccountField
        label="Confirme a senha"
        type="password"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        error={confirmationIssue}
        testId="account-password-confirm-input"
      />
      {formError ? (
        <p className="save-warning" data-tone="bad" role="alert">
          {formError}
        </p>
      ) : null}
      <Button size="sm" type="submit" disabled={!ready || pending} data-qa="account-save-nickname">
        {pending ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  );
}
