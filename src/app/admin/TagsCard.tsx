'use client';
import { useState } from 'react';
import type { AdminTag, AdminTagCreate } from '@/shared/api';
import { api } from '@/shared/apiClient';
import { Badge, Button, Panel } from '@/ui/kit';
import { TagBadge } from '@/ui/game/panel/comunidade/TagBadge';
import { ActionResultText } from './ActionResultText';
import { NEW_TAG, TagForm } from './TagForm';
import type { AdminTagsState } from './useAdminTags';
import { useApiAction } from './useApiAction';

interface TagsCardProps {
  catalog: AdminTagsState;
  /** A tag was deleted: the player list drops it too. */
  onDeleted: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The tag catalogue: create, edit and delete tags. Giving them to players is in each player's "Gerenciar". */
export function TagsCard({ catalog, onDeleted }: TagsCardProps) {
  const { busy, message, run } = useApiAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminTag | null>(null);
  const { tags, error } = catalog;

  const create = async (values: AdminTagCreate) => {
    const done = await run(() => api.admin.createTag(values), `Tag "${values.label}" criada.`);
    if (done) {
      setCreating(false);
      catalog.reload();
    }
  };

  const update = async (tag: AdminTag, values: AdminTagCreate) => {
    const done = await run(() => api.admin.updateTag(tag.id, values), `Tag "${values.label}" salva.`);
    if (done) {
      setEditing(null);
      catalog.reload();
    }
  };

  const remove = async (tag: AdminTag) => {
    setDeleting(null);
    const done = await run(
      () => api.admin.deleteTag(tag.id),
      `Tag "${tag.label}" apagada${tag.holders > 0 ? ` e tirada de ${plural(tag.holders, 'jogador', 'jogadores')}` : ''}.`,
    );
    if (done) {
      catalog.reload();
      onDeleted();
    }
  };

  return (
    <Panel className="admin-card admin-tags" data-qa="admin-tags">
      <div className="admin-card-head">
        <h2>Tags</h2>
        {!creating ? (
          <Button size="sm" variant="primary" disabled={busy} data-qa="admin-tag-new" onClick={() => setCreating(true)}>
            Nova tag
          </Button>
        ) : null}
      </div>
      <p className="admin-hint">
        Tags aparecem ao lado do apelido. As visíveis a todos ficam no ranking, no mural e na linha do próprio jogador; as de admin só
        aparecem aqui. Para dar ou tirar uma tag, abra &quot;Gerenciar&quot; no jogador. Tags valem para sempre, inclusive depois do reset de
        lançamento.
      </p>

      {creating ? <TagForm initial={NEW_TAG} submitLabel="Criar tag" busy={busy} onSubmit={create} onCancel={() => setCreating(false)} /> : null}

      {error && !tags ? (
        <p className="admin-result" role="alert" data-tone="bad">
          {error.message}
        </p>
      ) : null}

      {tags ? (
        tags.length === 0 ? (
          <p className="muted">Nenhuma tag ainda.</p>
        ) : (
          <ul className="admin-tag-list">
            {tags.map((tag) => (
              <li key={tag.id} className="admin-tag-item" data-qa="admin-tag-item">
                {editing === tag.id ? (
                  <TagForm
                    initial={tag}
                    submitLabel="Salvar"
                    busy={busy}
                    onSubmit={(values) => update(tag, values)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="admin-tag-summary">
                      <TagBadge tags={[{ ...tag, adminOnly: tag.visibility === 'admin' }]} />
                      <span className="admin-tag-meta">
                        <Badge tone={tag.visibility === 'public' ? 'good' : 'neutral'}>{tag.visibility === 'public' ? 'Visível a todos' : 'Só admin'}</Badge>
                        {tag.single ? <Badge tone="accent">Exclusiva</Badge> : null}
                        <span className="muted">{plural(tag.holders, 'jogador', 'jogadores')}</span>
                      </span>
                      {tag.description ? <p className="admin-tag-description">{tag.description}</p> : null}
                    </div>
                    <div className="admin-action-buttons">
                      <Button size="sm" variant="secondary" disabled={busy} data-qa={`admin-tag-edit-${tag.id}`} onClick={() => setEditing(tag.id)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} data-qa={`admin-tag-delete-${tag.id}`} onClick={() => setDeleting(tag)}>
                        Apagar
                      </Button>
                    </div>
                  </>
                )}
                {deleting?.id === tag.id ? (
                  <div className="admin-confirm" role="alertdialog" aria-label="Confirmar exclusão da tag">
                    <p>
                      Apagar a tag &quot;{tag.label}&quot;?{' '}
                      {tag.holders > 0 ? `Ela sai de ${plural(tag.holders, 'jogador', 'jogadores')}. ` : ''}Não dá para desfazer.
                    </p>
                    <div className="admin-action-buttons">
                      <Button size="sm" variant="danger" disabled={busy} data-qa="admin-tag-delete-yes" onClick={() => remove(tag)}>
                        Sim, apagar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : !error ? (
        <p className="muted">Carregando tags...</p>
      ) : null}

      <ActionResultText message={message} />
    </Panel>
  );
}
