import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { FsEntry, SessionMessage, UiPane } from 'claude-code'

const REPO = '/repo'

type Engine = Parameters<TestBody>[0]

const PANE = {
  plugin: 'matt-flow',
  component: 'Pane',
  requestId: 'matt-flow',
  props: {
    title: '✦ Matt 導航',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

const SETUP_FILE = 'docs/agents/issue-tracker.md'
// The mattpocock/skills repo, set up with the local markdown tracker.
const SKILLS_REPO = {
  [SETUP_FILE]: '# Issue tracker: Local Markdown\n',
  '.claude-plugin/plugin.json': '{ "name": "mattpocock-skills" }',
}
const GITHUB = { [SETUP_FILE]: '# Issue tracker: GitHub\n' }

type World = {
  // Paths relative to REPO, and their text.
  files?: Record<string, string>
  // What an earlier version left in the store for this project.
  stored?: unknown
  // Other projects' progress in the same store, by their roots.
  others?: Record<string, unknown>
}

const DAY = 86_400_000

// Stands for the engine beneath the plugin. The files given predate the
// session; those `write` adds come later, newer than anything the plugin timed.
const engine = (on: Parameters<TestBody>[1], { files = SKILLS_REPO, stored, others = {} }: World = {}) => {
  const disk = new Map(Object.entries(files).map(([path, text]) => [path, { text, mtimeMs: 0 }]))
  const rel = (path: string) => (path.startsWith(`${REPO}/`) ? path.slice(REPO.length + 1) : path)
  const filled: { text: string; mode?: string }[] = []
  const suggested: string[] = []
  const toasts: string[] = []
  const panes: UiPane[] = []
  on('command.register', () => ({ value: { command: 'matt-flow' } }))
  on('ui.open', (_, e) => {
    panes.push({ id: e.id, title: e.title ?? '', isShown: true, isFocused: false, isPlaced: true })

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    panes.splice(panes.findIndex(pane => pane.id === e.id), 1)

    return { value: undefined }
  })
  on('ui.panes', () => ({ value: panes }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 50_000, window: 200_000 }, rateLimits: [] } }))
  let now = 1
  on('clock.now', () => ({ value: now }))
  // The conversation the model holds: a test compacts, clears or rewinds it by hand.
  const conversation: SessionMessage[] = []
  on('session.messages', () => ({ value: conversation }))
  on('fs.read', (_, e) => ({ value: disk.get(rel(e.path))?.text ?? '' }))
  on('fs.exists', (_, e) => ({ value: disk.has(rel(e.path)) }))
  on('fs.list', (_, e) => {
    const dir = `${rel(e.path)}/`
    const entries = new Map<string, FsEntry>()
    for (const [path, { mtimeMs }] of disk) {
      if (!path.startsWith(dir)) continue
      const [name = '', ...rest] = path.slice(dir.length).split('/')
      const isDir = rest.length > 0
      entries.set(name, { name, kind: isDir ? 'dir' : 'file', size: 0, mtimeMs: isDir ? 0 : mtimeMs, isLink: false })
    }

    return { value: [...entries.values()] }
  })
  // The plugin's one store file, which every session of the plugin reads and writes.
  const store = new Map<string, unknown>([
    ...(stored === undefined ? [] : [[`progress:${REPO}`, stored] as const]),
    ...Object.entries(others).map(([root, saved]) => [`progress:${root}`, saved] as const),
  ])
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))

    return { value: undefined }
  })
  on('prompt.fill', (_, e) => {
    filled.push({ text: e.text, mode: e.mode })

    return { isFilled: true }
  })
  on('prompt.suggest', (_, e) => {
    suggested.push(e.text)

    return { isShown: true }
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('tool.call', () => ({ result: {} }))

  return {
    filled,
    suggested,
    toasts,
    store,
    conversation,
    write: (path: string, text = '') => void disk.set(path, { text, mtimeMs: 2 }),
    // Moves the clock to `ms`.
    at: (ms: number) => void (now = ms),
  }
}

const start = ($: Engine) => $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

const turnEnds = ($: Engine) =>
  $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' })

// The text of the pane's first Text matching `pattern`, on the terminal.
const seen = async ($: Engine, pattern: RegExp) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text: pattern })
  await ui.unmount()

  return found?.text
}

// The person typing `/name`, as the engine raises it.
const typed = ($: Engine, name: string) =>
  $.prompt.submit({ text: `/${name}`, command: { name, args: '' }, wait: false, origin: { kind: 'composer' } })

test('a set-up project starts the beginner at grilling, on every surface', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /設定專案/ }))?.text).toBe('✔ 1. 設定專案')
    expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 2. 把想法問清楚')
    await ui.unmount()
  }
})

test('progress saved by 0.2 carries over: its steps passed, its rounds finished features', async ($, on) => {
  engine(on, { stored: { level: 'intermediate', done: ['grill', 'spec'], rounds: 2 } })
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /把想法問清楚/ }))?.text).toBe('✔ 2. 把想法問清楚')
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 4. 切成任務卡')
  expect(await ui.find({ type: 'Text', text: /已完成 2 個功能/ })).toBeDefined()
  // Its spec passed with no folder on record to name the feature by.
  expect((await ui.find({ type: 'Text', text: /進行中/ }))?.text).toBe('功能進行中')
  await ui.unmount()
})

test('progress 0.2 left on a finished round loads as a finished feature, not a stuck one', async ($, on) => {
  engine(on, { stored: { level: 'beginner', done: ['setup', 'grill', 'build', 'review', 'retro'], rounds: 1 } })
  await start($)

  expect(await seen($, /已完成/)).toMatch(/已完成 2 個功能/)
  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')
  expect(await seen($, /▶/)).toBe('▶ 2. 把想法問清楚')
})

test('a skill the person types moves the guide on', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'mattpocock-skills:grill-with-docs')

  expect(await seen($, /▶/)).toBe('▶ 3. 動手做')
})

test('the pane is a dashboard on every surface: the card offers skip and stuck, nothing that runs or passes a step', async ($, on) => {
  engine(on)
  await start($)
  await turnEnds($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'skip' })).toBeDefined()
    expect(await ui.find({ key: 'stuck' })).toBeDefined()
    expect(await ui.find({ key: 'fill' })).toBeUndefined()
    expect(await ui.find({ key: 'mark' })).toBeUndefined()
    expect(await ui.find({ key: 'level-expert' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /50k \/ 150k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /已完成 0 個功能/ })).toBeDefined()
    await ui.unmount()
  }
})

test('skip on the pane works like /matt-flow skip, and a skipped step looks unlike a passed one', async ($, on) => {
  const { toasts } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'skip' })
  expect(toasts.at(-1)).toBe('↷ 跳過「動手做」→ 下一步 /code-review')
  expect((await ui.find({ type: 'Text', text: /把想法問清楚/ }))?.text).toBe('✔ 2. 把想法問清楚')
  expect((await ui.find({ type: 'Text', text: /動手做/ }))?.text).toBe('↷ 3. 動手做（跳過）')
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 4. 檢查')
  await ui.unmount()
})

test('stuck puts /ask-matt with where the person is into the prompt box, keeping their draft', async ($, on) => {
  const { filled } = engine(on)
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'stuck' })
  expect(filled).toEqual([
    {
      text: '/ask-matt 我在 Matt 導航的「新手」流程，卡在「把想法問清楚」(/grill-with-docs)。沒有跳過步驟。現在會被擋：改程式碼（Edit、Write、NotebookEdit）。我遇到的狀況是：',
      mode: 'insert',
    },
  ])
  await ui.unmount()
})

test('in a project the rail is quiet in, stuck tells /ask-matt nothing is locked', async ($, on) => {
  const { filled } = engine(on, { files: {} })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'stuck' })
  expect(filled.at(-1)?.text).toBe(
    '/ask-matt 我在 Matt 導航的「新手」流程，卡在「設定專案」(/setup-matt-pocock-skills)。沒有跳過步驟。現在沒有會被擋的動作。我遇到的狀況是：',
  )
  await ui.unmount()
})

test('stuck tells /ask-matt the steps skipped, what is locked, and how long the project has been left', async ($, on) => {
  const { filled, at } = engine(on)
  at(0)
  await start($)
  await typed($, 'grill-with-docs')
  await flow($, 'skip')
  at(4 * DAY)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'stuck' })
  expect(filled.at(-1)?.text).toBe(
    '/ask-matt 我在 Matt 導航的「新手」流程，卡在「檢查」(/code-review)。跳過了「動手做」。現在會被擋：git commit。4 天沒動。我遇到的狀況是：',
  )
  await ui.unmount()
})

test('inside a feature the person started, a skill the model runs through the Skill tool moves the guide on too', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:code-review' })

  expect(await seen($, /▶/)).toBe('▶ 5. 複盤')
})

test('only the person starts a feature: a skill the model runs with none under way starts nothing', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:grilling' })

  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')
  expect(await seen($, /▶/)).toBe('▶ 2. 把想法問清楚')
})

test('a later step typed before building moves nothing: building is not skipped, code stays locked', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'code-review')

  expect(await seen($, /▶/)).toBe('▶ 3. 動手做')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/implement/)
})

test('/retro typed with no feature under way starts nothing and finishes nothing', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'retro')

  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')
  expect(await seen($, /已完成/)).toMatch(/已完成 0 個功能/)
})

test('changing level while building goes on past the new level\'s building, code still open', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'level-expert' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 6. 開 PR 附證據')
  await ui.unmount()
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
})

test('an expert building in parallel who turns beginner goes on to code-review', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'expert' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets', 'implement-spec']) await typed($, skill)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'level-beginner' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 4. 檢查')
  await ui.unmount()
})

test('the expert level builds in parallel', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'level-expert' })
  expect(await ui.find({ type: 'Text', text: /\/implement-spec/ })).toBeDefined()
  await ui.unmount()
})

test('a flow skill starts a feature, and the retro ends it: it counts, and the next starts from grilling', async ($, on) => {
  engine(on)
  await start($)
  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')

  await typed($, 'grill-with-docs')
  expect(await seen($, /進行中/)).toBe('功能進行中')
  for (const skill of ['implement', 'code-review', 'retro']) await typed($, skill)

  expect(await seen($, /已完成/)).toMatch(/已完成 1 個功能/)
  expect(await seen($, /▶/)).toBe('▶ 2. 把想法問清楚')
  expect(await seen($, /把想法問清楚/)).toBe('▶ 2. 把想法問清楚')
  expect(await seen($, /收尾/)).toMatch(/收尾中/)
})

test('after the retro, code stays open for the wrap-up until the person ends it', async ($, on) => {
  const { toasts } = engine(on)
  await start($)
  for (const skill of ['grill-with-docs', 'implement', 'code-review', 'retro']) await typed($, skill)

  expect(toasts.at(-1)).toBe('🎉 功能結束，已完成 1 個功能 → 收尾：改完環境輸入 /matt-flow end，下一個從 /grill-with-docs 開始')
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
  // Grilling the model runs for a triage meanwhile starts nothing and leaves the wrap-up be.
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:grilling' })
  expect(await seen($, /收尾/)).toMatch(/收尾中/)
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
  expect(await flow($, 'end')).toBe('收尾結束 → 下一步 /grill-with-docs')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/grill-with-docs/)
})

test('the next feature ends the wrap-up', async ($, on) => {
  engine(on)
  await start($)
  for (const skill of ['grill-with-docs', 'implement', 'code-review', 'retro', 'grill-with-docs']) await typed($, skill)

  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/implement/)
})

test('a single-turn step hands over: a toast now, the next command suggested when the turn ends', async ($, on) => {
  const { suggested, toasts } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')

  expect(toasts.at(-1)).toBe('✔ 動手做 通過 → 下一步 /code-review')
  expect(suggested).toEqual([])
  await turnEnds($)
  expect(suggested).toEqual(['/code-review'])
})

test('a step that takes many turns hands over once done, not on starting: nothing is suggested', async ($, on) => {
  const { suggested, toasts } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await turnEnds($)

  expect(toasts).toEqual(['▶ 開始「把想法問清楚」：問題問完之後，下一步 /implement'])
  expect(suggested).toEqual([])
})

test('only the person typing /implement passes building: the model running tdd or implement does not', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')

  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:implement' })
  expect(await seen($, /▶/)).toBe('▶ 3. 動手做')
  await typed($, 'mattpocock-skills:implement')
  expect(await seen($, /▶/)).toBe('▶ 4. 檢查')
})

test('on the local tracker, spec and tickets pass on their files, written since the feature started', async ($, on) => {
  const { suggested, write } = engine(on, {
    files: { ...SKILLS_REPO, '.scratch/old/spec.md': '', '.scratch/old/issues/01-a.md': '' },
    stored: { level: 'intermediate' },
  })
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'to-spec')
  await turnEnds($)
  expect(await seen($, /▶/)).toBe('▶ 3. 寫成規格書')

  write('.scratch/rail/spec.md')
  await turnEnds($)
  expect(await seen($, /▶/)).toBe('▶ 4. 切成任務卡')
  expect(await seen($, /進行中/)).toBe('功能「rail」進行中')
  expect(suggested.at(-1)).toBe('/to-tickets')

  await typed($, 'to-tickets')
  await turnEnds($)
  expect(await seen($, /▶/)).toBe('▶ 4. 切成任務卡')
  write('.scratch/rail/issues/01-state-shape.md')
  await turnEnds($)
  expect(await seen($, /▶/)).toBe('▶ 5. 動手做')
})

test('an old feature\'s ticket touched before this feature has a spec does not pass its tickets', async ($, on) => {
  const { write } = engine(on, { files: { ...SKILLS_REPO, '.scratch/old/issues/01-a.md': '' }, stored: { level: 'intermediate' } })
  await start($)
  await typed($, 'grill-with-docs')
  write('.scratch/old/issues/01-a.md', 'Status: done')
  await turnEnds($)
  expect(await seen($, /切成任務卡/)).toBe('○ 4. 切成任務卡')

  write('.scratch/rail/spec.md')
  await turnEnds($)
  expect(await seen($, /▶/)).toBe('▶ 4. 切成任務卡')
})

test('a step outside the level passes quietly: no toast, nothing offered', async ($, on) => {
  const { suggested, toasts } = engine(on, { files: GITHUB })
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  const shown = toasts.length
  await typed($, 'to-spec')
  await turnEnds($)

  expect(toasts.length).toBe(shown)
  expect(suggested).toEqual(['/code-review'])
})

test('on the GitHub tracker, spec and tickets pass when their skills run', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets']) await typed($, skill)

  expect(await seen($, /▶/)).toBe('▶ 5. 動手做')
  // The spec passed, though no folder names the feature.
  expect(await seen($, /進行中/)).toBe('功能進行中')
})

test('a project set up this turn hands over to grilling', async ($, on) => {
  const { suggested, write } = engine(on, { files: {} })
  await start($)
  await typed($, 'setup-matt-pocock-skills')
  write(SETUP_FILE, '# Issue tracker: Local Markdown\n')
  await turnEnds($)

  expect(suggested).toEqual(['/grill-with-docs'])
  expect(await seen($, /▶/)).toBe('▶ 2. 把想法問清楚')
})

test('a project never set up stays quiet: skills there start nothing', async ($, on) => {
  const { suggested, toasts } = engine(on, { files: {} })
  await start($)
  await typed($, 'grill-with-docs')
  await turnEnds($)

  expect(toasts).toEqual([])
  expect(suggested).toEqual([])
  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')
})

// Claude editing `path` under REPO, or outside it when absolute.
const edit = ($: Engine, path: string) =>
  $.tool.call({ tool: 'Edit', file_path: path.startsWith('/') ? path : `${REPO}/${path}`, old_string: 'a', new_string: 'b' })

test('with no feature under way, code is locked: the denial names /grill-with-docs, and offers it', async ($, on) => {
  const { suggested } = engine(on)
  await start($)

  const denied = (await edit($, 'hooks/register.tsx')).deny
  expect(denied).toMatch(/把想法問清楚/)
  expect(denied).toMatch(/\/grill-with-docs/)
  expect(denied).toMatch(/停下來交棒/)
  expect(denied).toMatch(/Bash/)
  expect((await $.tool.call({ tool: 'Write', file_path: `${REPO}/src/new.ts`, content: '' })).deny).toBeDefined()
  expect(
    (await $.tool.call({ tool: 'NotebookEdit', notebook_path: `${REPO}/play.ipynb`, new_source: '' })).deny,
  ).toBeDefined()
  await turnEnds($)
  expect(suggested).toEqual(['/grill-with-docs'])
})

test('during a feature, the denial names the next step on the way to building', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  await typed($, 'grill-with-docs')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/to-spec/)

  await typed($, 'to-spec')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/to-tickets/)
})

test('code unlocks once the person types /implement', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/implement/)

  await typed($, 'implement')
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
})

test('markdown, docs, the tracker folder and files outside the project are never locked', async ($, on) => {
  engine(on)
  await start($)

  for (const path of ['GLOSSARY.md', 'docs/adr/0001.ts', '.scratch/rail/notes.txt', '/elsewhere/app.ts']) {
    expect((await edit($, path)).deny).toBeUndefined()
  }
})

test('a project never set up locks nothing', async ($, on) => {
  engine(on, { files: {} })
  await start($)

  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
})

const bash = ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command })

test('a beginner building cannot commit until code-review runs, then every later commit goes', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')

  expect((await bash($, 'git commit -m "wip"')).deny).toMatch(/code-review/)
  expect((await bash($, `git -C ${REPO} commit -m "wip"`)).deny).toMatch(/code-review/)
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:code-review' })
  expect((await bash($, 'git commit -m "feat"')).deny).toBeUndefined()
  expect((await bash($, 'git commit -m "fix review"')).deny).toBeUndefined()
})

test('an intermediate building waits for code-review too, the person typing it counts', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets', 'implement']) await typed($, skill)

  expect((await bash($, 'git commit -m "wip"')).deny).toMatch(/code-review/)
  await typed($, 'code-review')
  expect((await bash($, 'git commit -m "feat"')).deny).toBeUndefined()
})

test('a denied commit offers /code-review, and each /implement the person types wants its own review', async ($, on) => {
  const { suggested } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  await turnEnds($)

  const offered = suggested.length
  expect((await bash($, 'git commit -m "wip"')).deny).toBeDefined()
  await turnEnds($)
  expect(suggested.slice(offered)).toEqual(['/code-review'])
  await typed($, 'code-review')
  expect((await bash($, 'git commit -m "first"')).deny).toBeUndefined()
  await typed($, 'implement')
  expect((await bash($, 'git commit -m "second"')).deny).toMatch(/code-review/)
})

test('commits outside building, and Bash that does not commit, always go', async ($, on) => {
  engine(on)
  await start($)
  expect((await bash($, 'git commit -m "docs"')).deny).toBeUndefined()

  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  for (const command of ['git status', 'git log --grep commit', 'npm test']) {
    expect((await bash($, command)).deny).toBeUndefined()
  }
})

test('the expert commits freely: /implement-spec reviews its own work', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'expert' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets', 'implement-spec']) await typed($, skill)

  expect((await bash($, 'git commit -m "wip"')).deny).toBeUndefined()
})

test('a subagent finishing does not take the hand-over meant for the person', async ($, on) => {
  const { suggested } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  await $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId: 's', reason: 'answer', agentId: 'a1' })
  expect(suggested).toEqual([])

  await turnEnds($)
  expect(suggested).toEqual(['/code-review'])
})

test('a subagent running code-review does not unlock the commit', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:code-review', agentId: 'a1' })

  expect((await bash($, 'git commit -m "wip"')).deny).toMatch(/code-review/)
})

test('below expert, /implement-spec lets its subagents commit; the main thread still waits for code-review', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'implement-spec')

  expect((await $.tool.call({ tool: 'Bash', command: 'git commit -m "ticket"', agentId: 'a1' })).deny).toBeUndefined()
  expect((await bash($, 'git commit -m "merge"')).deny).toMatch(/code-review/)
})

test('a gate that breaks still holds code and commits, and lets everything else go', async ($, on) => {
  let isBroken = false
  // Once broken, progress reads back as a corrupt state would.
  on('state.get', { plugin: 'matt-flow', key: 'progress' }, (_, e, next) =>
    isBroken ? ({ value: null, version: 1 } as never) : next(e),
  )
  engine(on)
  await start($)
  isBroken = true

  expect((await edit($, 'src/app.ts')).deny).toMatch(/關卡出錯/)
  expect((await bash($, 'git commit -m "wip"')).deny).toMatch(/關卡出錯/)
  expect((await edit($, 'README.md')).deny).toBeUndefined()
  expect((await bash($, 'ls')).deny).toBeUndefined()
})

// A prompt the person types; resolves the context the model reads beside it.
const said = async ($: Engine, text: string) =>
  (await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })).context ?? []

// What rides along with the person's next prompt, as one text.
const rail = async ($: Engine) => (await said($, 'hi')).join()

test('with no feature, the rail says code is locked behind /grill-with-docs, what still goes, and the rules', async ($, on) => {
  engine(on)
  await start($)

  const text = await rail($)
  expect(text).toMatch(/還沒有進行中的功能/)
  expect(text).toMatch(/新手/)
  expect(text).toMatch(/下一步：把想法問清楚（\/grill-with-docs）/)
  expect(text).toMatch(/改程式碼（Edit.*\/grill-with-docs/)
  expect(text).toMatch(/仍可以：讀檔、跑測試、改 markdown/)
  expect(text).not.toMatch(/git commit/)
  expect(text).toMatch(/停下來/)
  expect(text).toMatch(/除了下一步的指令和 \/matt-flow，不要主動建議流程指令/)
  expect(text).toMatch(/\/ask-matt/)
  expect(text).toMatch(/Bash/)
})

test("the rail lets Claude name Matt's ways in when no feature is under way or the person asks what to do", async ($, on) => {
  engine(on)
  await start($)

  const text = await rail($)
  expect(text).toMatch(/沒有進行中的功能、或人問該怎麼辦時，可以點名 Matt 的入口/)
  for (const entry of ['/triage', '/diagnosing-bugs', '/wayfinder', '/improve-codebase-architecture', '/to-questionnaire']) {
    expect(text).toContain(entry)
  }
})

test('once the spec is written, the rail names the feature and points at /to-tickets', async ($, on) => {
  const { write } = engine(on, { stored: { level: 'intermediate' } })
  await start($)
  await typed($, 'grill-with-docs')
  await typed($, 'to-spec')
  write('.scratch/rail/spec.md')
  await turnEnds($)

  const text = await rail($)
  expect(text).toMatch(/「rail」/)
  expect(text).toMatch(/進階/)
  expect(text).toMatch(/下一步：切成任務卡（\/to-tickets）/)
  expect(text).toMatch(/改程式碼（Edit.*\/to-tickets/)
})

test('while building, the rail locks only the commit, until code-review runs', async ($, on) => {
  engine(on)
  await start($)
  await typed($, 'grill-with-docs')

  const text = (await typed($, 'implement')).context?.join()
  expect(text).not.toMatch(/改程式碼（Edit/)
  expect(text).not.toMatch(/仍可以/)
  expect(text).toMatch(/git commit.*code-review/)
  expect((await typed($, 'code-review')).context?.join()).toMatch(/現在會被擋的動作：沒有/)
})

test('the rail rides along with a prompt only when it changed', async ($, on) => {
  engine(on)
  await start($)

  expect(await rail($)).toMatch(/# matt-flow 軌道[^]*下一步：把想法問清楚/)
  expect(await said($, 'hi again')).toEqual([])
  expect((await typed($, 'grill-with-docs')).context?.join()).toMatch(/下一步：動手做/)
  expect(await said($, 'and again')).toEqual([])
})

test('while grilling, the rail names building as the next step, never as the step under way', async ($, on) => {
  engine(on)
  await start($)

  const text = (await typed($, 'grill-with-docs')).context?.join()
  expect(text).toMatch(/下一步：動手做（\/implement）/)
  expect(text).not.toMatch(/目前的步驟/)
})

const message = (role: 'user' | 'assistant', text: string): SessionMessage => ({ role, text, toolUses: [] })

test('once the conversation is compacted, the next prompt carries the rail again', async ($, on) => {
  const { conversation } = engine(on)
  await start($)
  await said($, 'hi')
  conversation.push(message('user', 'hi'), message('assistant', 'hello'))
  await turnEnds($)
  expect(await said($, 'and again')).toEqual([])

  // A compaction puts its summary first; the conversation need not get any shorter.
  conversation.splice(0, 1, message('user', 'This session is being continued from a previous conversation.'))
  expect(await rail($)).toMatch(/# matt-flow 軌道/)
})

test('a rewind or /clear takes the rail away, and the next prompt carries it again', async ($, on) => {
  const { conversation } = engine(on)
  await start($)
  await said($, 'hi')
  conversation.push(message('user', 'hi'), message('assistant', 'hello'))
  await turnEnds($)
  conversation.push(message('user', 'more'), message('assistant', 'sure'))
  await turnEnds($)

  conversation.splice(2)
  expect(await rail($)).toMatch(/# matt-flow 軌道/)
  expect(await said($, 'and again')).toEqual([])
  conversation.splice(0)
  expect(await rail($)).toMatch(/# matt-flow 軌道/)
})

test('a project never set up gets no rail beside its prompts', async ($, on) => {
  engine(on, { files: {} })
  await start($)

  expect(await said($, 'hi')).toEqual([])
})

// Progress another session of the project saved: grilling passed, building next.
const GRILLED = {
  level: 'beginner',
  steps: { grill: 'passed' },
  feature: { name: null, since: 1 },
  isReviewed: false,
  isOff: false,
  features: 0,
}

test('a turn that changed nothing leaves alone the progress another session saved', async ($, on) => {
  const { store } = engine(on)
  await start($)
  store.set(`progress:${REPO}`, GRILLED)
  await turnEnds($)

  expect(store.get(`progress:${REPO}`)).toEqual(GRILLED)
})

test('each prompt reads the progress afresh: a step another session passed shows here', async ($, on) => {
  const { store } = engine(on)
  await start($)
  store.set(`progress:${REPO}`, GRILLED)

  expect((await said($, 'hi')).join()).toMatch(/下一步：動手做/)
})

test('a session opened in a subfolder works on its project: its progress, its locks', async ($, on) => {
  engine(on, { stored: { level: 'intermediate' } })
  await $.session.start({ cwd: `${REPO}/hooks`, surface: 'terminal', isInteractive: true })

  expect((await said($, 'hi')).join()).toMatch(/等級：進階/)
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/grill-with-docs/)
})

// The person typing `/matt-flow args`; resolves the line it answers.
const flow = async ($: Engine, args = '') =>
  (
    await $.command.run({
      command: 'matt-flow',
      args,
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
  ).text

test('/matt-flow alone still opens and closes the pane; an unknown argument shows the usage', async ($, on) => {
  engine(on)
  await start($)

  expect(await flow($)).toMatch(/已打開/)
  expect(await flow($)).toMatch(/已關閉/)
  expect(await flow($, 'nope')).toMatch(/skip.*end.*off.*on/)
})

test('/matt-flow skip skips the step the flow stands on, and says what is next', async ($, on) => {
  engine(on)
  await start($)

  expect(await flow($, 'skip')).toBe('↷ 跳過「把想法問清楚」→ 下一步 /implement')
  expect(await seen($, /進行中/)).toBe('功能進行中')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/implement/)
  expect(await flow($, 'skip')).toBe('↷ 跳過「動手做」→ 下一步 /code-review')
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
})

test('/matt-flow end, or skipping the retro, ends the feature', async ($, on) => {
  engine(on)
  await start($)
  expect(await flow($, 'end')).toBe('沒有進行中的功能 → 下一步 /grill-with-docs')

  await typed($, 'grill-with-docs')
  expect(await flow($, 'end')).toBe('🎉 功能結束，已完成 1 個功能 → 下一個從 /grill-with-docs 開始')
  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')

  for (const step of ['把想法問清楚', '動手做', '檢查']) expect(await flow($, 'skip')).toMatch(step)
  expect(await flow($, 'skip')).toBe('🎉 功能結束，已完成 2 個功能 → 下一個從 /grill-with-docs 開始')
})

test('/matt-flow all lists every project with progress, the longest left first, and marks a feature left over 3 days', async ($, on) => {
  const { at } = engine(on, {
    others: {
      '/Users/me/billing': {
        level: 'intermediate',
        steps: { grill: 'passed', spec: 'passed' },
        feature: { name: 'invoices', since: 0 },
        isReviewed: false,
        isOff: false,
        features: 2,
      },
      '/Users/me/finished': { level: 'beginner', steps: {}, feature: null, isReviewed: false, isOff: false, features: 1 },
      '/private/tmp/scratch': { level: 'beginner', steps: {}, feature: null, isReviewed: false, isOff: false, features: 0 },
    },
  })
  at(5 * DAY)
  await start($)
  await typed($, 'grill-with-docs')

  expect(await flow($, 'all')).toBe(
    [
      '⚠ ~/billing · 🚀 進階 · 功能「invoices」進行中 · 下一步 /to-tickets · 5 天沒動',
      '  /repo · 🌱 新手 · 功能進行中 · 下一步 /implement · 不到 1 天沒動',
      '  ~/finished · 🌱 新手 · 還沒有進行中的功能 · 下一步 /grill-with-docs · 已完成 1 個功能',
      '最近 7 天結束的功能：沒有',
    ].join('\n'),
  )
})

test('a feature ended in the last 7 days shows under the overview, with how long it took and what it skipped', async ($, on) => {
  const { at } = engine(on)
  at(DAY)
  await start($)
  await typed($, 'grill-with-docs')
  await flow($, 'skip')
  at(3 * DAY)
  await flow($, 'end')

  const ended = async () => (await flow($, 'all'))?.split('\n').at(-1)
  expect(await ended()).toBe('最近 7 天結束的功能：/repo（2 天，跳過「動手做」）')
  at(11 * DAY)
  expect(await ended()).toBe('最近 7 天結束的功能：沒有')
})

test('a skill that moves nothing, a level change, or the rail turned off and on leaves the time the flow last moved', async ($, on) => {
  const { at } = engine(on)
  at(0)
  await start($)
  await typed($, 'grill-with-docs')
  at(4 * DAY)
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:grilling' })
  await flow($, 'off')
  await flow($, 'on')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'level-intermediate' })
  await ui.unmount()

  expect((await flow($, 'all'))?.split('\n')[0]).toBe('⚠ /repo · 🚀 進階 · 功能進行中 · 下一步 /to-spec · 4 天沒動')
})

test('/matt-flow off quiets the gates and takes the rail back in this project; on brings them back', async ($, on) => {
  engine(on)
  await start($)
  expect(await rail($)).toMatch(/# matt-flow 軌道/)

  expect(await flow($, 'off')).toMatch(/關掉了.*\/matt-flow on/)
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
  expect(await rail($)).toMatch(/先前的規矩不再適用/)
  expect(await said($, 'hi again')).toEqual([])
  await typed($, 'grill-with-docs')
  await typed($, 'implement')
  expect((await bash($, 'git commit -m "wip"')).deny).toBeUndefined()

  expect(await flow($, 'on')).toBe('軌道打開了 → 下一步 /grill-with-docs')
  expect((await edit($, 'src/app.ts')).deny).toMatch(/\/grill-with-docs/)
  expect(await rail($)).toMatch(/# matt-flow 軌道/)
})

test('in a project never set up, the subcommands say why the rail does nothing', async ($, on) => {
  engine(on, { files: {} })
  await start($)

  expect(await flow($, 'skip')).toMatch(/還沒設定.*\/setup-matt-pocock-skills/)
})

test('an intermediate building hands over both ways: the next ticket, or the retro once all are done', async ($, on) => {
  const { suggested, toasts } = engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets']) await typed($, skill)
  await turnEnds($)
  const offered = suggested.length
  const text = (await typed($, 'implement')).context?.join()
  await turnEnds($)

  expect(toasts.at(-1)).toBe('✔ 動手做 通過 → 還有任務卡就 /clear 後 /implement 下一張，都做好了再 /retro')
  expect(suggested.slice(offered)).toEqual([])
  expect(text).toMatch(/還有任務卡就 \/clear 後 \/implement 下一張，都做好了再 \/retro/)

  // The person starting the retro says every ticket is done: the next feature is offered as usual.
  await typed($, 'retro')
  await turnEnds($)
  expect(suggested.at(-1)).toBe('/grill-with-docs')
})

test("an expert's /implement-spec hands over to /pr, not to another /implement", async ($, on) => {
  const { toasts } = engine(on, { files: GITHUB, stored: { level: 'expert' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets', 'implement-spec']) await typed($, skill)

  expect(toasts.at(-1)).toBe('▶ 開始「讓 AI 並行開發」：分身都合併之後，下一步 /pr')
})

test('typing a later step runs it all the same, skipping the steps before it with a toast', async ($, on) => {
  const { toasts } = engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  await typed($, 'implement')

  expect(toasts).toEqual([
    '↷ 跳過「把想法問清楚」「寫成規格書」「切成任務卡」 · ✔ 動手做 通過 → 還有任務卡就 /clear 後 /implement 下一張，都做好了再 /retro',
  ])
  expect((await edit($, 'src/app.ts')).deny).toBeUndefined()
  // Steps run again mid-build still hand over both ways: the tickets are not all done.
  await typed($, 'to-tickets')
  expect(toasts.at(-1)).toBe(
    '▶ 開始「切成任務卡」：任務卡切好之後，還有任務卡就 /clear 後 /implement 下一張，都做好了再 /retro',
  )
})

test('an em-dash is denied inside the skills repo only', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

  const edit = (file_path: string) =>
    $.tool.call({
      tool: 'Edit',
      file_path,
      old_string: 'a',
      new_string: `a ${String.fromCharCode(0x2014)} b`,
    })

  expect((await edit(`${REPO}/README.md`)).deny).toMatch(/CLAUDE\.md/)
  expect((await edit('/elsewhere/README.md')).deny).toBeUndefined()
})
