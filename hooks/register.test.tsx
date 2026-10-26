import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

const REPO = '/repo'

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
}

// Stands for the engine beneath the plugin. The files given predate the
// session; those `write` adds come later, newer than anything the plugin timed.
const engine = (on: Parameters<TestBody>[1], { files = SKILLS_REPO, stored }: World = {}) => {
  const disk = new Map(Object.entries(files).map(([path, text]) => [path, { text, mtimeMs: 0 }]))
  const rel = (path: string) => (path.startsWith(`${REPO}/`) ? path.slice(REPO.length + 1) : path)
  const filled: string[] = []
  const suggested: string[] = []
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'matt-flow' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('clock.now', () => ({ value: 1 }))
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
  on('store.get', () => ({ value: stored }))
  on('store.set', () => ({ value: undefined }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)

    return { isFilled: true }
  })
  on('prompt.suggest', (_, e) => {
    suggested.push(e.text)

    return { isShown: true }
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))

  return { filled, suggested, toasts, write: (path: string, text = '') => void disk.set(path, { text, mtimeMs: 2 }) }
}

const start = ($: Parameters<TestBody>[0]) => $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })

const turnEnds = ($: Parameters<TestBody>[0]) =>
  $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId: 't', reason: 'answer' })

// The text of the pane's first Text matching `pattern`, on the terminal.
const seen = async ($: Parameters<TestBody>[0], pattern: RegExp) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text: pattern })
  await ui.unmount()

  return found?.text
}

// The person typing `/name`, as the engine raises it.
const typed = ($: Parameters<TestBody>[0], name: string) =>
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
  await ui.unmount()
})

test('a skill run moves the guide on, and the button types the next command', async ($, on) => {
  const { filled } = engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })
  await typed($, 'mattpocock-skills:grill-with-docs')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 3. 動手做')
  await ui.press({ key: 'fill' })
  expect(filled).toEqual(['/implement'])
  await ui.unmount()
})

test('a skill the model runs through the Skill tool moves the guide on too', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:grill-with-docs' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 3. 動手做')
  await ui.unmount()
})

test('the expert track builds in parallel', async ($, on) => {
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
  expect(await seen($, /進行中/)).toBe('功能進行中，還沒有規格')
  for (const skill of ['implement', 'code-review', 'retro']) await typed($, skill)

  expect(await seen($, /已完成/)).toMatch(/已完成 1 個功能/)
  expect(await seen($, /▶/)).toBe('▶ 2. 把想法問清楚')
  expect(await seen($, /把想法問清楚/)).toBe('▶ 2. 把想法問清楚')
  expect(await seen($, /進行中/)).toBe('還沒有進行中的功能')
})

test('a passed step hands over: a toast now, the next command suggested when the turn ends', async ($, on) => {
  const { suggested, toasts } = engine(on)
  await start($)
  await typed($, 'grill-with-docs')

  expect(toasts).toEqual(['✔ 把想法問清楚 通過 → 下一步 /implement'])
  expect(suggested).toEqual([])
  await turnEnds($)
  expect(suggested).toEqual(['/implement'])
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

test('on the GitHub tracker, spec and tickets pass when their skills run', async ($, on) => {
  engine(on, { files: GITHUB, stored: { level: 'intermediate' } })
  await start($)
  for (const skill of ['grill-with-docs', 'to-spec', 'to-tickets']) await typed($, skill)

  expect(await seen($, /▶/)).toBe('▶ 5. 動手做')
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
