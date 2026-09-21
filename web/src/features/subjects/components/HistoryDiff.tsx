import { BookOpen, Languages, Network, List } from 'lucide-react';
import { tokenizeMnemonic } from '@/lib/wanikani/mnemonic';
import { answerDetails, canonical, fieldLabel, formatValue, type HistoryChange } from '../../../../../shared/subject-history/model';
import { diffTokens } from '../../../../../shared/subject-history/diff';
import styles from './subject-history.module.css';

export function HistoryDiff({ change, labels, subjectType, archived = false }: { change: HistoryChange; labels: Record<string, string>; subjectType: string; archived?: boolean }) {
  const composition = change.field.endsWith('_subject_ids');
  const answers = ['meanings', 'readings', 'auxiliary_meanings', 'auxiliary_readings'].includes(change.field);
  const mnemonic = /mnemonic|hint/.test(change.field);
  const Icon = composition ? Network : mnemonic ? BookOpen : answers ? Languages : List;
  const tokens = (value: unknown) => mnemonic && typeof value === 'string' ? tokenizeMnemonic(value) : [{ text: formatValue(change.field, value, labels), type: 'text' }];
  const diff = diffTokens(tokens(change.before), tokens(change.archivedOnly ? change.before : change.after));
  return <section className={styles.section} aria-label={fieldLabel(change.field)}>
    <h3><Icon size={18} aria-hidden />{fieldLabel(change.field)}</h3>
    {change.archivedOnly ? <p className={styles.coverage}>Archived text only. This field has no equivalent in the current API.</p> : null}
    <div className={styles.comparison}>{(change.archivedOnly ? ['before'] as const : ['before', 'after'] as const).map(side => {
      const value = change[side];
      const other = change[side === 'before' ? 'after' : 'before'];
      const items = Array.isArray(value) ? value : [];
      const others = Array.isArray(other) ? other : [];
      return <div key={side} className={styles.version} data-side={side}>
        <div className={styles.versionLabel}>{archived ? (side === 'before' ? 'Pre-2019 archive' : 'Saved version') : (side === 'before' ? 'Before' : 'After')}</div>
        {composition && items.length ? <div className={styles.components}>{items.map((id, index) => {
          const name = labels[String(id)] ?? `Subject #${id}`;
          const [character, meaning] = name.includes(' — ') ? name.split(' — ') : ['', name];
          const changed = !others.includes(id);
          return <div key={`${id}:${index}`} className={styles.component} data-changed={changed}>
            <span className={styles.componentCharacter} data-kind={change.field === 'component_subject_ids' && subjectType === 'kanji' ? 'radical' : 'kanji'}>{character || '◇'}</span>
            <span>{meaning}</span>{changed ? <span className={styles.changeSign} aria-label={side === 'before' ? 'Removed' : 'Added'}>{side === 'before' ? '−' : '+'}</span> : null}
          </div>;
        })}</div> : answers && items.length ? <ul className={styles.answers}>{items.map((item, index) => {
          const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
          const changed = !others.some(other => canonical(other) === canonical(item));
          return <li key={index} data-changed={changed}><span className={styles.answerRole}>{row.primary ? 'Primary' : 'primary' in row ? 'Alternative' : 'Answer'}</span><strong lang={change.field.includes('reading') ? 'ja' : undefined}>{String(row.meaning ?? row.reading ?? item)}</strong>{answerDetails(row) ? <em>{answerDetails(row)}</em> : null}{changed ? <span className={styles.changeSign}>{side === 'before' ? '−' : '+'}</span> : null}</li>;
        })}</ul> : <p className={styles.prose}>{diff[side].map((part, index) => {
          const content = <span data-mnemonic-kind={part.type}>{part.text}</span>;
          return part.changed ? side === 'before' ? <del key={index}>{content}</del> : <ins key={index}>{content}</ins> : <span key={index}>{content}</span>;
        })}</p>}
      </div>;
    })}</div>
  </section>;
}
