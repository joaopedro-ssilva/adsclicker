import type { FeedItem } from '@/shared/api';
import { Section } from '../lib/Section';
import { feedAction } from './feedText';
import { relativeTime } from './relativeTime';

interface FeedSectionProps {
  feed: FeedItem[];
  now: number;
}

export function FeedSection({ feed, now }: FeedSectionProps) {
  const items = [...feed].sort((a, b) => b.at - a.at).slice(0, 30);
  return (
    <Section title="Acontecendo agora">
      {items.length === 0 ? (
        <p className="community-note">Nada por aqui ainda. Forme uma turma ou contrate um professor e apareça no mural.</p>
      ) : (
        <ul className="community-feed" data-qa="community-feed">
          {items.map((item) => (
            <li key={item.id} className="community-feed-item" data-kind={item.kind}>
              <span className="community-feed-text">
                <strong>{item.nickname}</strong> {feedAction(item)}
              </span>
              <time className="community-feed-time" dateTime={new Date(item.at).toISOString()}>
                {relativeTime(item.at, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
