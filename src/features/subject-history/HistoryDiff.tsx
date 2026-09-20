import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../utils/theme';
import { useSubjectColors, getReadableTextColor } from '../../utils/subjectColors';
import { tokenizeWaniKaniMnemonic } from '../../utils/wanikaniMnemonic';
import { answerDetails, canonical, formatValue, type HistoryChange } from '../../../shared/subject-history/model';
import { diffTokens } from '../../../shared/subject-history/diff';

export function HistoryDiff({ change, labels, subjectType, archived = false }: { change: HistoryChange; labels: Record<string, string>; subjectType: string; archived?: boolean }) {
  const { theme } = useTheme();
  const colors = useSubjectColors();
  const mnemonic = /mnemonic|hint/.test(change.field);
  const tokens = (value: unknown) => mnemonic && typeof value === 'string' ? tokenizeWaniKaniMnemonic(value) : [{ text: formatValue(change.field, value, labels), type: 'text' }];
  const diff = diffTokens(tokens(change.before), tokens(change.archivedOnly ? change.before : change.after));
  const composition = change.field.endsWith('_subject_ids');
  const answers = ['meanings', 'readings', 'auxiliary_meanings', 'auxiliary_readings'].includes(change.field);
  return <View style={[styles.panel, { borderColor: theme.border }]}>{(change.archivedOnly ? ['before'] as const : ['before', 'after'] as const).map(side => {
    const value = change[side];
    const other = change[side === 'before' ? 'after' : 'before'];
    const items = Array.isArray(value) ? value : [];
    const others = Array.isArray(other) ? other : [];
    const changedStyle = { backgroundColor: theme.isDark ? (side === 'before' ? '#492928' : '#1e3c30') : (side === 'before' ? '#fce8e6' : '#e2f2e8'), color: theme.isDark ? (side === 'before' ? '#ffc0b8' : '#b6ebc9') : (side === 'before' ? '#8d2523' : '#205c38') };
    return <View key={side} style={[styles.version, side === 'after' && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textLight }]}>{archived ? (side === 'before' ? 'Pre-2019 archive' : 'Saved version') : (side === 'before' ? 'Before · − removed' : 'After · + added')}</Text>
      {change.archivedOnly ? <Text style={{ color: theme.textLight, marginBottom: 12 }}>Archived text only. This field has no equivalent in the current API.</Text> : null}
      {composition && items.length ? <View style={styles.tiles}>{items.map((id, index) => {
        const name = labels[String(id)] ?? `Subject #${id}`;
        const [character, meaning] = name.includes(' — ') ? name.split(' — ') : ['', name];
        const changed = !others.includes(id);
        const color = change.field === 'component_subject_ids' && subjectType === 'kanji' ? colors.radical : colors.kanji;
        return <View key={`${id}:${index}`} style={[styles.tile, changed && { backgroundColor: changedStyle.backgroundColor }]}>
          <Text style={[styles.glyph, { backgroundColor: color, color: getReadableTextColor(color) }]}>{character || '◇'}</Text>
          <Text style={[styles.tileLabel, { color: changed ? changedStyle.color : theme.textColor }]}>{changed ? (side === 'before' ? '− ' : '+ ') : ''}{meaning}</Text>
        </View>;
      })}</View> : answers && items.length ? <View style={styles.answers}>{items.map((item, index) => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const changed = !others.some(other => canonical(other) === canonical(item));
        return <View key={index} style={[styles.answer, changed && { backgroundColor: changedStyle.backgroundColor }]}><Text style={[styles.role, { color: theme.textLight }]}>{row.primary ? 'Primary' : 'primary' in row ? 'Alternative' : 'Answer'}</Text><Text style={[styles.answerText, { color: changed ? changedStyle.color : theme.textColor }]}>{changed ? (side === 'before' ? '− ' : '+ ') : ''}{String(row.meaning ?? row.reading ?? item)}</Text>{answerDetails(row) ? <Text style={{ color: changed ? changedStyle.color : theme.textLight, fontSize: 12 }}>{answerDetails(row)}</Text> : null}</View>;
      })}</View> : <Text selectable style={[styles.prose, { color: theme.textColor }]}>{diff[side].map((part, index) => {
        const color = part.type === 'radical' ? colors.radical : part.type === 'kanji' ? colors.kanji : part.type === 'vocabulary' ? colors.vocabulary : part.type === 'reading' ? theme.textColor : null;
        return <Text key={index} style={[color ? { backgroundColor: color, color: part.type === 'reading' ? theme.backgroundColor : getReadableTextColor(color), fontWeight: '700' } : null, part.type === 'em' && { fontStyle: 'italic' }, part.changed && { ...changedStyle, textDecorationLine: side === 'before' ? 'line-through' : 'underline' }]}>{part.text}</Text>;
      })}</Text>}
    </View>;
  })}</View>;
}
const styles = StyleSheet.create({ panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' }, version: { padding: 16 }, label: { fontSize: 12, marginBottom: 14 }, prose: { fontSize: 16, lineHeight: 28 }, tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tile: { alignItems: 'center', padding: 10, borderRadius: 6, gap: 8, maxWidth: 140 }, glyph: { fontSize: 28, textAlign: 'center', width: 48, height: 48, lineHeight: 48, borderRadius: 6 }, tileLabel: { fontSize: 13, textAlign: 'center' }, answers: { gap: 8 }, answer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 8, borderRadius: 4 }, role: { fontSize: 12, minWidth: 65 }, answerText: { fontSize: 18, fontWeight: '600' } });
