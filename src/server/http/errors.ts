import type { ApiErrorCode } from '@/shared/api';

const STATUS: Record<ApiErrorCode, number> = {
  unavailable: 503,
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  rate_limited: 429,
  nickname_taken: 409,
  wrong_credentials: 401,
  not_found: 404,
  internal: 500,
};

/** Default pt-BR messages, safe to show as they are. */
export const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unavailable: 'O servidor está indisponível no momento. Seu jogo continua salvo neste aparelho.',
  invalid: 'Os dados enviados são inválidos.',
  unauthorized: 'Você precisa estar conectado para fazer isso.',
  forbidden: 'Você não tem permissão para fazer isso.',
  rate_limited: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.',
  nickname_taken: 'Esse apelido já está em uso.',
  wrong_credentials: 'Apelido ou senha incorretos.',
  not_found: 'Não encontrado.',
  internal: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
};

/** Thrown anywhere under a route handler; the wrapper turns it into the error body of the contract. */
export class ApiFailure extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ApiErrorCode, message: string = DEFAULT_MESSAGE[code], retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.status = STATUS[code];
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
