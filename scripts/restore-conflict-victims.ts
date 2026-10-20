/**
 * Script de Auditoria e Remediação: Vítimas de Falso Positivo em Conflito Multi-Aparelho.
 *
 * Identifica jogadores que foram removidos do ranking (flagged: true) devido ao bug de
 * validação de tempo durante resolução forçada de conflito (force: true).
 *
 * Uso:
 *   # Visualizar contas afetadas sem alterar nada (Dry Run):
 *   npx tsx scripts/restore-conflict-victims.ts
 *
 *   # Executar a restauração em lote:
 *   npx tsx scripts/restore-conflict-victims.ts --apply
 *
 *   # Restaurar um jogador específico:
 *   npx tsx scripts/restore-conflict-victims.ts --apply --player-id=<UUID>
 *   npx tsx scripts/restore-conflict-victims.ts --apply --nickname=<NICKNAME>
 */

import { eq, sql } from 'drizzle-orm';
import { createDb } from '@/server/db/client';
import { players, serverLogs } from '@/server/db/schema';

interface CandidateRow extends Record<string, unknown> {
  id: string;
  nickname: string | null;
  flag_reason: string | null;
  last_seen_at: Date;
  suspect_count: string;
  flag_detail: unknown;
}

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgres://adsclicker:adsclicker@localhost:5439/adsclicker';

  const apply = process.argv.includes('--apply');
  const playerIdArg = process.argv.find((arg) => arg.startsWith('--player-id='))?.split('=')[1];
  const nicknameArg = process.argv.find((arg) => arg.startsWith('--nickname='))?.split('=')[1];

  console.log('='.repeat(70));
  console.log(' AdsClicker - Remediação de Falsos Positivos de Ranking (Conflito)');
  console.log('='.repeat(70));
  console.log(`Modo: ${apply ? 'APPLY (alterações serão gravadas)' : 'DRY RUN (somente leitura)'}`);

  const { sql: client, db } = createDb(url, { max: 1 });

  try {
    let query;
    if (playerIdArg) {
      query = sql<CandidateRow>`
        SELECT 
          p.id,
          p.nickname,
          p.flag_reason,
          p.last_seen_at,
          COUNT(l.id)::text AS suspect_count,
          MAX(l.detail::text) AS flag_detail
        FROM players p
        LEFT JOIN server_logs l ON l.player_id = p.id AND l.kind = 'sync_suspect'
        WHERE p.id = ${playerIdArg}::uuid
          AND p.flagged = true
          AND p.banned = false
        GROUP BY p.id, p.nickname, p.flag_reason, p.last_seen_at;
      `;
    } else if (nicknameArg) {
      query = sql<CandidateRow>`
        SELECT 
          p.id,
          p.nickname,
          p.flag_reason,
          p.last_seen_at,
          COUNT(l.id)::text AS suspect_count,
          MAX(l.detail::text) AS flag_detail
        FROM players p
        LEFT JOIN server_logs l ON l.player_id = p.id AND l.kind = 'sync_suspect'
        WHERE LOWER(p.nickname) = LOWER(${nicknameArg})
          AND p.flagged = true
          AND p.banned = false
        GROUP BY p.id, p.nickname, p.flag_reason, p.last_seen_at;
      `;
    } else {
      query = sql<CandidateRow>`
        SELECT 
          p.id,
          p.nickname,
          p.flag_reason,
          p.last_seen_at,
          COUNT(l.id)::text AS suspect_count,
          MAX(l.detail::text) AS flag_detail
        FROM players p
        JOIN server_logs l ON l.player_id = p.id
        WHERE p.flagged = true
          AND p.banned = false
          AND p.test_account = false
          AND l.kind = 'sync_suspect'
          AND l.detail->>'force' = 'true'
        GROUP BY p.id, p.nickname, p.flag_reason, p.last_seen_at;
      `;
    }

    const result = await db.execute<CandidateRow>(query);
    const candidates = result as unknown as CandidateRow[];

    if (!candidates || candidates.length === 0) {
      console.log('\nNenhum jogador elegível para restauração encontrado com os critérios fornecidos.');
      return;
    }

    console.log(`\nJogadores encontrados: ${candidates.length}\n`);
    for (const c of candidates) {
      console.log(`- ID: ${c.id}`);
      console.log(`  Apelido: ${c.nickname ?? '(sem apelido)'}`);
      console.log(`  Motivo do Flag: ${c.flag_reason ?? '(não especificado)'}`);
      console.log(`  Último Acesso: ${c.last_seen_at}`);
      console.log(`  Logs de suspeita: ${c.suspect_count}`);
      console.log('-'.repeat(50));
    }

    if (!apply) {
      console.log('\n[Aviso] Execute com a flag "--apply" para efetuar a restauração no banco de dados.');
      return;
    }

    console.log('\nIniciando restauração...');
    let restoredCount = 0;

    for (const c of candidates) {
      await db.transaction(async (tx) => {
        await tx
          .update(players)
          .set({
            flagged: false,
            flagReason: null,
          })
          .where(eq(players.id, c.id));

        await tx.insert(serverLogs).values({
          level: 'info',
          kind: 'admin_unflag',
          message: 'Restauração automática: falso positivo em resolução de conflito multi-aparelho',
          playerId: c.id,
          nickname: c.nickname,
          route: 'scripts/restore-conflict-victims',
          detail: {
            automated: true,
            previousReason: c.flag_reason,
            restoredAt: new Date().toISOString(),
          },
        });
      });

      restoredCount++;
      console.log(`✓ Conta restaurada com sucesso: ${c.nickname ?? c.id}`);
    }

    console.log(`\nConcluído! ${restoredCount} jogador(es) restaurado(s) ao ranking.`);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('Erro na execução da restauração:', err);
  process.exit(1);
});
