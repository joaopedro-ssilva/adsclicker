'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FEED_KINDS, LOG_LEVELS, LOG_RANGES } from '@/shared/api';
import type { AdminActivityEntry, AdminLogEntry, AdminTrafficHour, ApiErrorCode, FeedItem, LogLevel, LogRange } from '@/shared/api';
import { api } from '@/shared/apiClient';
import type { ApiResult } from '@/shared/apiClient';
import { feedAction } from '@/ui/game/panel/comunidade/feedText';
import { Badge, Button, Panel } from '@/ui/kit';

const RANGE_LABEL: Record<LogRange, string> = { '1h': '1 h', '24h': '24 h', '7d': '7 dias', all: 'Tudo' };
const LEVEL_TONE: Record<LogLevel, 'neutral' | 'warn' | 'bad'> = { info: 'neutral', warn: 'warn', error: 'bad' };
const SEARCH_DELAY_MS = 300;

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const hourFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', hour: '2-digit' });

interface Page<E> {
  entries: E[];
  nextBefore: string | number | null;
}

interface Feed<E, P extends Page<E>> {
  first: P | null;
  entries: E[];
  nextBefore: string | number | null;
  loading: boolean;
  error: { code: ApiErrorCode; message: string } | null;
  reload: () => void;
  loadMore: () => void;
}

/** Loads page one for the current filters (and again on `reload`), then appends older pages on demand. */
function useFeed<E, P extends Page<E>>(
  key: string,
  fetchPage: (before: string | undefined, signal: AbortSignal) => Promise<ApiResult<P>>,
): Feed<E, P> {
  const [first, setFirst] = useState<P | null>(null);
  const [more, setMore] = useState<E[]>([]);
  const [nextBefore, setNextBefore] = useState<string | number | null>(null);
  const [settled, setSettled] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Feed<E, P>['error']>(null);
  const [version, setVersion] = useState(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    controller.current = ctl;
    void fetchRef.current(undefined, ctl.signal).then((result) => {
      if (ctl.signal.aborted) return;
      setSettled(`${key}|${version}`);
      if (result.ok) {
        setFirst(result.data);
        setMore([]);
        setNextBefore(result.data.nextBefore);
        setError(null);
      } else {
        setError(result.error);
      }
    });
    return () => ctl.abort();
  }, [key, version]);

  const loadMore = useCallback(() => {
    const ctl = controller.current;
    if (!ctl || nextBefore === null) return;
    setLoadingMore(true);
    void fetchRef.current(String(nextBefore), ctl.signal).then((result) => {
      if (ctl.signal.aborted) return;
      setLoadingMore(false);
      if (result.ok) {
        setMore((current) => [...current, ...result.data.entries]);
        setNextBefore(result.data.nextBefore);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [nextBefore]);

  const loading = loadingMore || settled !== `${key}|${version}`;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { first, entries: first ? [...first.entries, ...more] : [], nextBefore, loading, error, reload, loadMore };
}

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

function errorText(error: NonNullable<Feed<unknown, Page<unknown>>['error']>): string {
  if (error.code === 'unavailable') return 'O servidor está fora do ar ou sem banco de dados configurado.';
  if (error.code === 'unauthorized' || error.code === 'forbidden') return 'Sessão de admin inválida. Saia e entre de novo.';
  return error.message;
}

function RangeButtons({ range, onChange }: { range: LogRange; onChange: (range: LogRange) => void }) {
  return (
    <div className="admin-presets" role="group" aria-label="Período">
      {LOG_RANGES.map((value) => (
        <Button key={value} size="sm" variant={range === value ? 'primary' : 'secondary'} aria-pressed={range === value} onClick={() => onChange(value)}>
          {RANGE_LABEL[value]}
        </Button>
      ))}
    </div>
  );
}

function Footer<E, P extends Page<E>>({ feed, empty }: { feed: Feed<E, P>; empty: string }) {
  return (
    <>
      {feed.error ? (
        <p className="admin-result" role="alert" data-tone="bad">
          {errorText(feed.error)}
        </p>
      ) : null}
      {feed.first && feed.entries.length === 0 && !feed.loading ? <p className="admin-empty">{empty}</p> : null}
      {feed.nextBefore !== null ? (
        <div className="admin-pager">
          <Button size="sm" variant="secondary" onClick={feed.loadMore} disabled={feed.loading} data-qa="admin-log-more">
            {feed.loading ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Traffic({ traffic }: { traffic: AdminTrafficHour[] }) {
  const accepted = traffic.reduce((sum, hour) => sum + hour.accepted, 0);
  const rejected = traffic.reduce((sum, hour) => sum + hour.rejected, 0);
  return (
    <div className="admin-traffic" data-qa="admin-traffic">
      <p className="admin-hint">
        Tráfego por hora (últimas 24 h): {accepted} syncs aceitos, {rejected} recusados.
      </p>
      {traffic.length === 0 ? (
        <p className="admin-hint">Ainda sem contagem.</p>
      ) : (
        <ol className="admin-traffic-hours">
          {traffic.map((hour) => (
            <li key={hour.hour}>
              <span className="admin-traffic-time">{hourFormat.format(hour.hour)}h</span>
              <strong>{hour.accepted}</strong> ok
              {hour.rejected > 0 ? <span className="admin-traffic-bad"> · {hour.rejected} recus.</span> : null}
              <span className="admin-hint"> · {hour.players} jog.</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: AdminLogEntry }) {
  const hasDetail = entry.detail !== null && entry.detail !== undefined;
  return (
    <li className="admin-log-row" data-level={entry.level}>
      <details>
        <summary>
          <time className="admin-log-time" dateTime={new Date(entry.at).toISOString()}>
            {timeFormat.format(entry.at)}
          </time>
          <Badge tone={LEVEL_TONE[entry.level]}>{entry.level}</Badge>
          <code className="admin-log-kind">{entry.kind}</code>
          <span className="admin-log-message">{entry.message}</span>
        </summary>
        <dl className="admin-log-meta">
          {entry.nickname ? (
            <div>
              <dt>Jogador</dt>
              <dd>{entry.nickname}</dd>
            </div>
          ) : null}
          {entry.playerId ? (
            <div>
              <dt>Id</dt>
              <dd>{entry.playerId}</dd>
            </div>
          ) : null}
          {entry.route ? (
            <div>
              <dt>Rota</dt>
              <dd>{entry.route}</dd>
            </div>
          ) : null}
        </dl>
        {hasDetail ? <pre className="admin-log-detail">{JSON.stringify(entry.detail, null, 2)}</pre> : null}
      </details>
    </li>
  );
}

function LogsView() {
  const [range, setRange] = useState<LogRange>('1h');
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const q = useDebounced(text);

  const feed = useFeed<AdminLogEntry, Awaited<ReturnType<typeof api.admin.logs>> extends ApiResult<infer D> ? D : never>(
    `${range}|${level}|${kind}|${q}`,
    (before, signal) => {
      const query: Record<string, string> = { range };
      if (level) query.level = level;
      if (kind) query.kind = kind;
      if (q) query.q = q;
      if (before) query.before = before;
      return api.admin.logs(query, signal);
    },
  );
  const kinds = feed.first?.kinds ?? [];

  return (
    <>
      {feed.first ? <Traffic traffic={feed.first.traffic} /> : null}
      <div className="admin-filters">
        <RangeButtons range={range} onChange={setRange} />
        <label className="admin-filter">
          <span className="sr-only">Nível</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as LogLevel | '')} aria-label="Nível">
            <option value="">Todos os níveis</option>
            {LOG_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-filter">
          <span className="sr-only">Tipo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {kind && !kinds.includes(kind) ? <option value={kind}>{kind}</option> : null}
            {kinds.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <input type="search" placeholder="Buscar mensagem, apelido, rota" aria-label="Buscar" value={text} onChange={(event) => setText(event.target.value)} />
        <Button size="sm" variant="ghost" onClick={feed.reload} disabled={feed.loading} data-qa="admin-log-reload">
          Atualizar
        </Button>
      </div>
      <ul className="admin-log-list" aria-busy={feed.loading}>
        {feed.entries.map((entry) => (
          <LogRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <Footer feed={feed} empty="Nenhum registro neste período." />
      {feed.first ? (
        <p className="admin-hint">
          Guardamos os registros por {feed.first.retentionDays} dias ou até {feed.first.maxRows.toLocaleString('pt-BR')} linhas, o que vier primeiro. Cada
          sync aceito não vira linha: aparece só no tráfego por hora.
        </p>
      ) : null}
    </>
  );
}

function activityText(entry: AdminActivityEntry): string {
  if (!(FEED_KINDS as readonly string[]).includes(entry.kind)) return entry.kind;
  const item: FeedItem = { id: entry.id, nickname: entry.nickname ?? '', kind: entry.kind as FeedItem['kind'], detail: entry.detail, at: entry.at };
  return feedAction(item);
}

function ActivityView() {
  const [range, setRange] = useState<LogRange>('1h');
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const q = useDebounced(text);

  const feed = useFeed<AdminActivityEntry, Awaited<ReturnType<typeof api.admin.activity>> extends ApiResult<infer D> ? D : never>(
    `${range}|${kind}|${q}`,
    (before, signal) => {
      const query: Record<string, string> = { range };
      if (kind) query.kind = kind;
      if (q) query.q = q;
      if (before) query.before = before;
      return api.admin.activity(query, signal);
    },
  );

  return (
    <>
      <div className="admin-filters">
        <RangeButtons range={range} onChange={setRange} />
        <label className="admin-filter">
          <span className="sr-only">Tipo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {FEED_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <input type="search" placeholder="Buscar por apelido" aria-label="Buscar por apelido" value={text} onChange={(event) => setText(event.target.value)} />
        <Button size="sm" variant="ghost" onClick={feed.reload} disabled={feed.loading} data-qa="admin-activity-reload">
          Atualizar
        </Button>
      </div>
      <ul className="admin-log-list" aria-busy={feed.loading}>
        {feed.entries.map((entry) => (
          <li key={entry.id} className="admin-log-row admin-activity-row">
            <time className="admin-log-time" dateTime={new Date(entry.at).toISOString()}>
              {timeFormat.format(entry.at)}
            </time>
            <span className="admin-log-message">
              <strong>{entry.nickname ?? `(sem apelido ${entry.playerId.slice(0, 8)})`}</strong> {activityText(entry)}
            </span>
          </li>
        ))}
      </ul>
      <Footer feed={feed} empty="Nenhuma atividade neste período." />
      {feed.first ? (
        <p className="admin-hint">
          O jogo mostra só as 30 mais recentes; aqui está tudo o que foi guardado: {feed.first.retentionDays} dias ou até{' '}
          {feed.first.maxRows.toLocaleString('pt-BR')} eventos. O reset de lançamento apaga este histórico.
        </p>
      ) : null}
    </>
  );
}

/** What happened on the server (errors, rejected saves, account and admin actions) and what the class did. */
export function LogsCard() {
  const [view, setView] = useState<'logs' | 'activity'>('logs');
  return (
    <Panel className="admin-card" data-qa="admin-logs-card">
      <div className="admin-card-head">
        <h2>Logs</h2>
        <div className="admin-presets" role="group" aria-label="Visão">
          <Button size="sm" variant={view === 'logs' ? 'primary' : 'secondary'} aria-pressed={view === 'logs'} onClick={() => setView('logs')}>
            Servidor
          </Button>
          <Button size="sm" variant={view === 'activity' ? 'primary' : 'secondary'} aria-pressed={view === 'activity'} onClick={() => setView('activity')}>
            Atividades
          </Button>
        </div>
      </div>
      {view === 'logs' ? <LogsView /> : <ActivityView />}
    </Panel>
  );
}
