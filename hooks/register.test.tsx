import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

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

// Stands for the engine beneath the plugin: a set-up skills repo, nothing stored yet.
const engine = (on: Parameters<TestBody>[1]) => {
  const filled: string[] = []
  on('command.register', () => ({ value: { command: 'matt-flow' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('fs.read', () => ({ value: '{ "name": "mattpocock-skills" }' }))
  on('fs.exists', () => ({ value: true }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)

    return { isFilled: true }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))

  return filled
}

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

test('a skill run moves the guide on, and the button types the next command', async ($, on) => {
  const filled = engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })
  await $.skill.prompt({ skill: 'mattpocock-skills:grill-with-docs', text: 'grill' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 3. 動手做')
  await ui.press({ key: 'fill' })
  expect(filled).toEqual(['/implement'])
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

test('a finished round offers the next one', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: REPO, surface: 'terminal', isInteractive: true })
  for (const skill of ['grill-with-docs', 'implement', 'code-review', 'retro']) {
    await $.skill.prompt({ skill, text: skill })
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /這一輪完成了/ })).toBeDefined()
  await ui.press({ key: 'again' })
  expect((await ui.find({ type: 'Text', text: /▶/ }))?.text).toBe('▶ 2. 把想法問清楚')
  await ui.unmount()
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
