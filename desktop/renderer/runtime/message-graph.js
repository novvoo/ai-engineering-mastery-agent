import {
  buildLifecycleGraph,
  buildToolRuntimeCollections,
  createConversationGroups,
} from './runtime-details.js';

export function isCompletedConversationGroup(group = {}) {
  if (group.status) {
    return ['completed', 'failed', 'stopped'].includes(group.status);
  }
  const primary = group.primaryMessage || group.primary;
  if (!primary) {
    return false;
  }
  if (primary.isStreaming || primary.type === 'assistant_stream') {
    return primary.streamComplete === true;
  }
  if (primary.type === 'agent') {
    return primary.event === 'agent:complete' || primary.streamComplete === true;
  }
  return ['user', 'result', 'success', 'error', 'warning', 'plan'].includes(primary.type);
}

export function resolveTurnVisibility({
  group = {},
  isCurrent = false,
  userPreference = 'unset',
} = {}) {
  if (group.status === 'running' || group.status === 'waiting') {
    return { state: 'expanded', reason: 'attention-required' };
  }
  if (userPreference === 'expanded') {
    return { state: 'expanded', reason: 'user-expanded' };
  }
  if (userPreference === 'collapsed') {
    return { state: 'collapsed', reason: 'user-collapsed' };
  }
  if (isCurrent) {
    return { state: 'expanded', reason: 'current-turn' };
  }
  if (isCompletedConversationGroup(group)) {
    return { state: 'collapsed', reason: 'historical-terminal' };
  }
  return { state: 'expanded', reason: 'non-terminal' };
}

export function computeNextCollapsedGroups({
  groups = [],
  previousCollapsed = new Set(),
  userExpandedGroupIds = new Set(),
  userCollapsedGroupIds = new Set(),
  activeGroupId = groups.at(-1)?.id,
} = {}) {
  const next = new Set(previousCollapsed);
  let changed = false;

  for (const group of groups) {
    const userPreference = userExpandedGroupIds.has(group.id)
      ? 'expanded'
      : userCollapsedGroupIds.has(group.id)
        ? 'collapsed'
        : 'unset';
    const visibility = resolveTurnVisibility({
      group,
      isCurrent: group.id === activeGroupId,
      userPreference,
    });
    const shouldCollapse = visibility.state === 'collapsed';

    if (shouldCollapse && !next.has(group.id)) {
      next.add(group.id);
      changed = true;
    } else if (!shouldCollapse && next.delete(group.id)) {
      changed = true;
    }
  }

  return changed ? next : previousCollapsed;
}

export function buildMessageDisplayGraph(messages = []) {
  return createConversationGroups(messages).map((group) => {
    const runtimeDetails = group.runtimeDetails || [];
    return {
      ...group,
      lifecycleGraph: buildLifecycleGraph(runtimeDetails),
      toolCollections: group.toolCollections || buildToolRuntimeCollections(runtimeDetails),
      isCompleted: isCompletedConversationGroup(group),
    };
  });
}

function getOverviewMessageText(message = {}) {
  if (!message) {
    return '';
  }
  const candidates = [
    message.answer,
    message.finalAnswer,
    message.content,
    message.message,
    message.text,
    message.result,
  ];
  for (const candidate of candidates) {
    const text = toSearchText(candidate).replace(/\s+/g, ' ').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function clampOverviewText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getToolOverviewStep(collection = {}) {
  const target = collection.args?.path
    || collection.args?.file
    || collection.args?.query
    || collection.request?.target
    || '';
  const label = collection.statusText || target || collection.toolName || '工具调用';
  return clampOverviewText(label, 120);
}

export function buildExecutionOverviewProjection(messages = []) {
  const groups = buildMessageDisplayGraph(messages);
  const turns = groups.map((group, index) => {
    const tools = group.toolCollections || [];
    const runningTool = [...tools].reverse().find((tool) => (
      ['running', 'pending', 'waiting'].includes(String(tool.phase || '').toLowerCase())
    ));
    const failedToolCount = tools.filter((tool) => (
      String(tool.phase || '').toLowerCase() === 'failed'
    )).length;
    const completedToolCount = tools.filter((tool) => (
      String(tool.phase || '').toLowerCase() === 'completed'
    )).length;
    const responseMessage = group.responseMessage
      || [...(group.responseMessages || [])].reverse().find((message) => message.type !== 'plan')
      || null;
    const latestMessage = [...(group.messages || [])].reverse()[0] || null;

    return {
      id: group.id,
      correlationId: group.correlationId,
      status: group.status,
      isCurrent: index === groups.length - 1,
      requestPreview: clampOverviewText(getOverviewMessageText(group.requestMessage), 160),
      responsePreview: clampOverviewText(getOverviewMessageText(responseMessage), 220),
      currentStep: runningTool
        ? getToolOverviewStep(runningTool)
        : group.status === 'waiting'
          ? clampOverviewText(getOverviewMessageText(latestMessage), 120)
          : '',
      toolCollections: tools,
      toolProgress: {
        total: tools.length,
        completed: completedToolCount,
        running: tools.length - completedToolCount - failedToolCount,
        failed: failedToolCount,
      },
      timestamp: Number(latestMessage?.timestamp || latestMessage?.createdAt || 0) || null,
    };
  });
  const activeTurn = [...turns].reverse().find((turn) => (
    turn.status === 'running' || turn.status === 'waiting'
  )) || turns.at(-1) || null;

  return {
    turns,
    activeTurnId: activeTurn?.id || null,
    totals: {
      running: turns.filter((turn) => turn.status === 'running' || turn.status === 'waiting').length,
      completed: turns.filter((turn) => turn.status === 'completed').length,
      failed: turns.filter((turn) => turn.status === 'failed' || turn.status === 'stopped').length,
    },
  };
}

function toSearchText(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function messageMatchesViewQuery(
  message = {},
  { filter = 'all', searchQuery = '' } = {},
) {
  if (filter !== 'all' && message.type !== filter) {
    return false;
  }

  const query = String(searchQuery || '').trim().toLocaleLowerCase();
  if (!query) {
    return true;
  }

  return [
    message.content,
    message.message,
    message.toolName,
    message.event,
    message.payloadSummary,
    message.args,
    message.result,
    message.error,
  ].some((value) => toSearchText(value).toLocaleLowerCase().includes(query));
}

function getTurnTimestamp(group = {}) {
  const candidates = [
    group.requestMessage,
    ...(group.primaryMessages || []),
    ...(group.messages || []),
  ];
  for (const message of candidates) {
    const timestamp = Number(message?.timestamp || message?.createdAt);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }
  return null;
}

export function buildMessageViewProjection(
  messages = [],
  {
    filter = 'all',
    searchQuery = '',
    formatTimelineLabel = (timestamp) => new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  } = {},
) {
  const query = { filter, searchQuery };
  const allGroups = buildMessageDisplayGraph(messages);
  const groups = [];
  let matchingMessageCount = 0;

  for (const group of allGroups) {
    const matches = (group.messages || []).filter((message) => (
      messageMatchesViewQuery(message, query)
    ));
    if (matches.length === 0) {
      continue;
    }
    matchingMessageCount += matches.length;
    groups.push({
      ...group,
      queryMatchCount: matches.length,
    });
  }

  const bucketsByKey = new Map();
  for (const group of groups) {
    const timestamp = getTurnTimestamp(group);
    const minute = timestamp == null ? null : Math.floor(timestamp / 60000) * 60000;
    const key = minute == null ? 'undated' : String(minute);
    let bucket = bucketsByKey.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: minute == null ? '未标记时间' : formatTimelineLabel(minute),
        groups: [],
      };
      bucketsByKey.set(key, bucket);
    }
    bucket.groups.push(group);
  }

  return {
    allGroups,
    groups,
    timelineBuckets: [...bucketsByKey.values()],
    activeGroupId: allGroups.at(-1)?.id || null,
    matchingMessageCount,
    totalMessageCount: Array.isArray(messages) ? messages.length : 0,
    hasMatches: groups.length > 0,
  };
}
