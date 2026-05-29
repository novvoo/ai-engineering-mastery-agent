const BUILTIN_COMMANDS = [
  { name: '/help', description: 'Show help' },
  { name: '/clear', description: 'Clear the screen' },
  { name: '/menu', description: 'Open interactive menu' },
  { name: '/task', description: 'Manage tasks' },
  { name: '/schedule', description: 'Manage schedules' },
  { name: '/subagent', description: 'Manage subagents' },
  { name: '/git', description: 'Run git helpers' },
  { name: '/mcp', description: 'Manage MCP servers' },
  { name: '/security', description: 'Inspect security policy' },
  { name: '/experience', description: 'Search experience memory' },
  { name: '/compress', description: 'Compress text' },
  { name: '/reason', description: 'Inspect reasoning candidates' },
  { name: '/auto', description: 'Manage automations' },
  { name: '/stats', description: 'Show statistics' },
  { name: '/status', description: 'Show status' },
  { name: '/tools', description: 'List tools' },
  { name: '/list', description: 'List tools' },
  { name: '/debug', description: 'Toggle debug logging' },
  { name: '/model', description: 'Switch model' },
];

export function toolNameToSlashCommand(name) {
  return `/${name.replace(/_/g, '-')}`;
}

export function buildSlashCommandSuggestions(skillTools = []) {
  const seen = new Set();
  const commands = [];

  for (const command of BUILTIN_COMMANDS) {
    seen.add(command.name);
    commands.push(command);
  }

  for (const tool of skillTools) {
    const name = toolNameToSlashCommand(tool.name);
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    commands.push({
      name,
      description: tool.description || `Run ${tool.name}`,
    });
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterSlashCommandSuggestions(commands, input, limit = 8) {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/') || /\s/.test(trimmed)) {
    return [];
  }

  return commands
    .filter(command => command.name.startsWith(trimmed))
    .slice(0, limit);
}
