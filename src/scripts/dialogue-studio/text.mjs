/**
 * Flattens a Minecraft text component for previews. `lookup(key)` returns the written text or '';
 * `fallback(key)` is tried when that is empty, and the result is flagged so it can be shown as a stand-in.
 */
export function flatten(value, lookup, fallback = null) {
  if (typeof value === 'string') return { text: value, missing: false, key: null };
  if (Array.isArray(value)) {
    const parts = value.map(item => flatten(item, lookup, fallback));
    return { text: parts.map(part => part.text).join(''), missing: parts.some(part => part.missing), fallback: parts.some(part => part.fallback), key: parts.find(part => part.key)?.key ?? null };
  }
  if (!value || typeof value !== 'object') return { text: '', missing: false, key: null };
  const extra = Array.isArray(value.extra) ? flatten(value.extra, lookup, fallback) : null;
  if (typeof value.translate === 'string') {
    const written = lookup(value.translate);
    if (written.trim()) return { text: written + (extra?.text ?? ''), missing: !!extra?.missing, key: value.translate };
    const other = fallback?.(value.translate) ?? '';
    if (other.trim()) return { text: other + (extra?.text ?? ''), missing: true, fallback: true, key: value.translate };
    return { text: '', missing: true, key: value.translate };
  }
  if (typeof value.text === 'string') return { text: value.text + (extra?.text ?? ''), missing: !!extra?.missing, key: null };
  return { text: '', missing: false, key: null, rich: true };
}

export const shortType = type => String(type ?? '').split(':').pop();

const ISSUE_ZH = [
  [/destination is not linked/, '没有连到任何节点'],
  [/destination does not exist/, '跳转目标不存在'],
  [/a non-ending state needs a choice/, '非结束节点至少需要一个选项'],
  [/no reachable end_dialogue state/, '走不到任何结束节点'],
  [/unreachable from start/, '从起点到不了这里'],
  [/initial-state actions are not executed/, '起始节点的行为在打开对话时不会执行'],
  [/expected a Minecraft text component/, '不是有效的 Minecraft 文本组件'],
  [/start_at must name an existing state/, 'start_at 指向的节点不存在'],
  [/singular action is retired/, '单数 action 已废弃，请用 actions'],
  [/requirement needs a namespaced type/, '条件缺少带命名空间的 type'],
  [/player_level requires integer value/, 'player_level 的 value 必须是整数'],
];

/** Validator findings, phrased for the panel: the node is already known, so only the problem is shown. */
export function describeIssue(issue, t) {
  const detail = issue.message.includes(': ') ? issue.message.slice(issue.message.indexOf(': ') + 2) : issue.message;
  const zh = t('en', 'zh') === 'zh' ? ISSUE_ZH.find(([pattern]) => pattern.test(issue.message))?.[1] : null;
  const text = zh ?? detail.replace(/\.$/, '');
  return issue.choice !== null && issue.choice !== undefined ? `${t('Reply', '选项')} ${issue.choice + 1}: ${text}` : text;
}
