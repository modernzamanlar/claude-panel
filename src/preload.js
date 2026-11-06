// Arayüzün ana süreçle konuştuğu tek kapı (contextIsolation açık).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    refresh: () => ipcRenderer.invoke('sessions:refresh'),
    load: (id, limit) => ipcRenderer.invoke('session:load', id, limit),
    subagent: (id, toolId, agentId) => ipcRenderer.invoke('session:subagent', id, toolId, agentId),
    onChanged: cb => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('sessions:changed', h);
      return () => ipcRenderer.removeListener('sessions:changed', h);
    },
  },
  changes: { // oturumun değiştirdiği dosyalar, fark ve dosya bazında geri alma
    list: id => ipcRenderer.invoke('changes:list', id),
    diff: (id, p) => ipcRenderer.invoke('changes:diff', id, p),
    revert: (id, p, opts) => ipcRenderer.invoke('changes:revert', id, p, opts),
  },
  workspace: {
    load: () => ipcRenderer.invoke('workspace:load'),
    save: data => ipcRenderer.invoke('workspace:save', data),
    saveSync: data => ipcRenderer.sendSync('workspace:saveSync', data),
  },
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    pickDir: () => ipcRenderer.invoke('update:pickDir'),
    resetDir: () => ipcRenderer.invoke('update:resetDir'),
    onState: cb => { const h = (_e, st) => cb(st); ipcRenderer.on('update:state', h); return () => ipcRenderer.removeListener('update:state', h); },
  },
  mirror: {
    info: () => ipcRenderer.invoke('mirror:info'),
    open: () => ipcRenderer.invoke('mirror:open'),
    onStatus: cb => { const h = (_e, st) => cb(st); ipcRenderer.on('mirror:status', h); return () => ipcRenderer.removeListener('mirror:status', h); },
  },
  fs: {
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
    listDesktop: () => ipcRenderer.invoke('fs:listDesktop'),
    reveal: p => ipcRenderer.invoke('shell:reveal', p),
    showInFolder: p => ipcRenderer.invoke('shell:showItem', p),
    pickFiles: cwd => ipcRenderer.invoke('dialog:pickFiles', cwd),
    describeFiles: paths => ipcRenderer.invoke('fs:describeFiles', paths),
    recentMedia: dir => ipcRenderer.invoke('fs:recentMedia', dir),
    saveAnnotated: (data, name) => ipcRenderer.invoke('img:saveAnnotated', data, name),
    listFiles: (dir, query) => ipcRenderer.invoke('fs:listFiles', dir, query),
    pathForFile: file => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  },
  claude: {
    connectors: () => ipcRenderer.invoke('claude:connectors'),
    auth: () => ipcRenderer.invoke('claude:auth'),
    login: () => ipcRenderer.invoke('claude:login'),
    remote: opts => ipcRenderer.invoke('claude:remote', opts),
    mcpList: cwd => ipcRenderer.invoke('claude:mcpList', cwd),
    context: opts => ipcRenderer.invoke('claude:context', opts),
    control: () => ipcRenderer.invoke('claude:control'),
    installDesktop: () => ipcRenderer.invoke('claude:installDesktop'),
  },
  ccfg: {
    list: cwd => ipcRenderer.invoke('ccfg:list', cwd),
    read: (key, cwd) => ipcRenderer.invoke('ccfg:read', key, cwd),
    write: (key, cwd, text, o) => ipcRenderer.invoke('ccfg:write', key, cwd, text, o),
    note: (scope, cwd, note) => ipcRenderer.invoke('ccfg:note', scope, cwd, note),
    extras: cwd => ipcRenderer.invoke('ccfg:extras', cwd),
    openAgent: (scope, file, cwd) => ipcRenderer.invoke('ccfg:openAgent', scope, file, cwd),
    exportMd: (name, text) => ipcRenderer.invoke('ccfg:export', name, text),
  },
  rewind: {
    files: opts => ipcRenderer.invoke('rewind:files', opts),
    worktreeInfo: (dir, name) => ipcRenderer.invoke('git:worktreeInfo', dir, name),
  },
  run: {
    start: opts => ipcRenderer.invoke('run:start', opts),
    stop: runId => ipcRenderer.invoke('run:stop', runId),
    stopTask: (runId, taskId) => ipcRenderer.invoke('run:stopTask', runId, taskId),
    respond: (runId, requestId, response) => ipcRenderer.invoke('run:respond', runId, requestId, response),
    active: () => ipcRenderer.invoke('run:active'),
    onEvent: cb => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('run:event', h);
      return () => ipcRenderer.removeListener('run:event', h);
    },
  },
  cmd: {
    list: cwd => ipcRenderer.invoke('cmd:list', cwd),
  },
  screen: {
    onStopped: cb => { const h = (_e, p) => cb(p); ipcRenderer.on('screen:stopped', h); return () => ipcRenderer.removeListener('screen:stopped', h); },
  },
  search: {
    query: q => ipcRenderer.invoke('search:query', q),
    onProgress: cb => { const h = (_e, p) => cb(p); ipcRenderer.on('search:progress', h); return () => ipcRenderer.removeListener('search:progress', h); },
  },
  onMenu: cb => { const h = (_e, p) => cb(p); ipcRenderer.on('menu', h); return () => ipcRenderer.removeListener('menu', h); },
  info: () => ipcRenderer.invoke('app:info'),
  app: {
    badge: (n, icon, flash) => ipcRenderer.send('app:badge', n, icon, !!flash),
    focus: () => ipcRenderer.send('app:focus'),
    dictate: () => ipcRenderer.invoke('app:dictate'),
  },
  platform: ((process.argv || []).find(a => a.startsWith('--cp-platform=')) || '').slice(14) || process.platform,
  home: ((process.argv || []).find(a => a.startsWith('--cp-home=')) || '').slice(10),   // "~" ile yazılan medya yollarını tekilleştirmek için
  setTheme: (dark, look) => ipcRenderer.send('win:theme', !!dark, String(look || '')),
});
