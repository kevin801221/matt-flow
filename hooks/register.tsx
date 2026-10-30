import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register } from 'claude-code'

import type { Level, Progress, StepState } from '../types'

const PANE = 'matt-flow'
const TITLE = '✦ Matt 導航'
// ask-matt's smart zone: compact at a phase boundary before crossing it.
const SMART_ZONE = 150_000
// Built from its code point so this file never holds the character it bans.
const EM_DASH = String.fromCharCode(0x2014)
// Written by /setup-matt-pocock-skills: a project holding it is set up.
const SETUP_FILE = 'docs/agents/issue-tracker.md'
// Where the local markdown tracker keeps a folder per feature.
const SCRATCH = '.scratch'

type Step = { title: string; command: string; skills: string[]; what: string; tip: string }

const STEPS = {
  setup: {
    title: '設定專案',
    command: '/setup-matt-pocock-skills',
    // Passes on SETUP_FILE alone.
    skills: [] as string[],
    what: '告訴 AI 任務放哪裡（GitHub 或本地檔案）、文件放哪裡。每個專案只要做一次。',
    tip: '做過就會自動通過，之後每個新功能都從下一步開始。',
  },
  grill: {
    title: '把想法問清楚',
    command: '/grill-with-docs',
    skills: ['grill-with-docs', 'grill-me', 'grilling'],
    what: 'AI 會一直問你問題，直到需求沒有模糊的地方，並把專有名詞記進 GLOSSARY.md。',
    tip: '沒有共同的詞彙表，AI 就會把「客戶」和「使用者」搞混。',
  },
  spec: {
    title: '寫成規格書',
    command: '/to-spec',
    skills: ['to-spec'],
    what: '把剛剛聊清楚的內容整理成一份規格，發到你的 issue tracker。這步不會再問你問題。',
    tip: '從問清楚到切任務卡，都留在同一段對話裡，中間不要 /clear。',
  },
  tickets: {
    title: '切成任務卡',
    command: '/to-tickets',
    skills: ['to-tickets'],
    what: '把規格切成一張張能獨立完成的任務卡，每張寫明「被哪幾張卡住」。',
    tip: '卡片邊界切清楚，之後同時開工才不會互相改到同一個檔案。',
  },
  build: {
    title: '動手做',
    command: '/implement',
    skills: ['implement'],
    what: 'AI 用測試先行的方式一小塊一小塊寫，寫完自己跑 /code-review 再 commit。',
    tip: '任務卡很多的話，一次做一張，每張做完就 /clear。',
  },
  review: {
    title: '檢查',
    command: '/code-review',
    skills: ['code-review'],
    what: '對照專案規範和規格，從兩個方向檢查這次的改動。/implement 通常會自己跑這步。',
    tip: '檢查的 AI 只看 diff，不用重新摸索整個專案，所以抓得準。',
  },
  parallel: {
    title: '讓 AI 並行開發',
    command: '/implement-spec',
    skills: ['implement-spec'],
    what: '沒被卡住的任務卡會同時交給好幾個分身去做，最後全部合進同一條整合分支。',
    tip: '並行時打架，通常不是 AI 笨，是任務卡的邊界切得太模糊。',
  },
  pr: {
    title: '開 PR 附證據',
    command: '/pr',
    skills: ['pr'],
    what: 'PR 說明要有最小的架構圖、改動前後的證據，以及這是單向門還是雙向門。',
    tip: '人只需要親自看單向門的 PR：改了就回不去的那種。',
  },
  retro: {
    title: '複盤',
    command: '/retro',
    skills: ['retro'],
    what: '回頭看這次哪裡卡住、哪裡浪費，建議怎麼改環境：自動檢查、規範、工具。',
    tip: '修環境，不修 prompt：與其每次提醒 AI，不如裝一把兒童安全鎖。',
  },
} satisfies Record<string, Step>

type StepKey = keyof typeof STEPS

const LEVELS: Record<Level, { icon: string; name: string; goal: string; steps: StepKey[] }> = {
  beginner: {
    icon: '🌱',
    name: '新手',
    goal: '一次做完一個小功能',
    steps: ['setup', 'grill', 'build', 'review', 'retro'],
  },
  intermediate: {
    icon: '🚀',
    name: '進階',
    goal: '大功能，分好幾次對話做完',
    steps: ['setup', 'grill', 'spec', 'tickets', 'build', 'retro'],
  },
  expert: {
    icon: '👑',
    name: '高手',
    goal: '讓 AI 同時做好幾件事',
    steps: ['setup', 'grill', 'spec', 'tickets', 'parallel', 'pr', 'retro'],
  },
}
const ORDER: Level[] = ['beginner', 'intermediate', 'expert']
// Each level's building: only the person typing its command passes it.
const BUILD: StepKey[] = ['build', 'parallel']
// The steps after building: typed before it, they move nothing.
const LATE: StepKey[] = ['review', 'pr', 'retro']
// Steps that go on for turns after their skill starts, and when each is done: they hand over then, not on starting.
const MANY_TURNS: Partial<Record<StepKey, string>> = { grill: '問題問完', tickets: '任務卡切好', parallel: '分身都合併' }
// With the local tracker these pass on their files, not on their skill running.
const ARTIFACTS: StepKey[] = ['spec', 'tickets']

// Editing any of these counts as having synced the skills edited before.
// ponytail: one touch clears every pending skill; track per-target if that misleads.
const SYNC_TARGET = /^(README\.md|\.claude-plugin\/plugin\.json|docs\/|skills\/engineering\/ask-matt\/)/
const PROMOTED = /^skills\/(?:engineering|productivity)\/([^/]+)\//

const FRESH: Progress = {
  level: 'beginner',
  steps: {},
  feature: null,
  isReviewed: false,
  isOff: false,
  isWrappingUp: false,
  features: 0,
}

const project = atom({ plugin: 'matt-flow', key: 'project' } as const, null)
const progress = atom({ plugin: 'matt-flow', key: 'progress' } as const, FRESH)
const isSetUp = atom({ plugin: 'matt-flow', key: 'isSetUp' } as const, false)
const tokens = atom({ plugin: 'matt-flow', key: 'tokens' } as const, null)
const unsynced = atom({ plugin: 'matt-flow', key: 'unsynced' } as const, [])

// The next step's command, offered in the prompt box once the turn ends.
let suggestion: string | undefined
// The rail last sent beside a prompt: it rides along again only once it changes, or once the
// conversation holding it is compacted or ended. Not in the system prompt: a managed hook may send
// prompt.compose past user plugins, as it does skill.prompt.
let sent: string | undefined

const stateOf = (p: Progress, key: StepKey, setUp: boolean): StepState | undefined =>
  key === 'setup' && setUp ? 'passed' : p.steps[key]
// The first step not passed: the one whose command the person types next. A step passes as its
// skill starts, so this is never the one under way.
const nextStep = (p: Progress, setUp: boolean) => LEVELS[p.level].steps.find(key => !stateOf(p, key, setUp))
const mark = (p: Progress, keys: StepKey[], state: StepState): Progress => ({
  ...p,
  steps: { ...p.steps, ...Object.fromEntries(keys.map(key => [key, state] as const)) },
})
const isBuilding = (p: Progress) => BUILD.some(key => p.steps[key])
// The step whose command unlocks code: grilling without a feature, else the next one.
const unlockStep = (p: Progress) => (p.feature && nextStep(p, true)) || 'grill'
// A `git commit`, however git is pointed (`git -C dir commit`).
const GIT_COMMIT = /\bgit(?:\s+-[cC]\s+\S+)*\s+commit\b/
// Beginners and intermediates commit what they build only after code-review has run.
const isCommitLocked = (p: Progress) => p.level !== 'expert' && isBuilding(p) && !p.isReviewed
// Code opens once building starts, and stays open through the wrap-up.
const isCodeOpen = (p: Progress) => isBuilding(p) || p.isWrappingUp
const WRAP_UP = '改完環境輸入 /matt-flow end'
// Intermediate building goes a ticket at a time: until the person starts the retro, the next is either.
const NEXT_TICKET = '還有任務卡就 /clear 後 /implement 下一張，都做好了再 /retro'
const isTicketByTicket = (p: Progress) => p.level === 'intermediate' && p.steps.build === 'passed'
const featureLine = ({ feature, isWrappingUp }: Progress) =>
  feature !== null
    ? feature.name === null
      ? '功能進行中'
      : `功能「${feature.name}」進行中`
    : isWrappingUp
      ? `收尾中：${WRAP_UP}`
      : '還沒有進行中的功能'
// What the rail guards: a project file that is not markdown, outside the tracker's folder and docs.
// ponytail: `..` is not resolved; the gate keeps Claude on the flow, it is no sandbox (Bash gets past it anyway).
const isCode = (root: string, path: string) =>
  path.startsWith(`${root}/`) &&
  !/\.md$/i.test(path) &&
  ![`${SCRATCH}/`, 'docs/'].some(dir => path.startsWith(`${root}/${dir}`))
// What a gate that throws still holds: it cannot tell the project, so it judges the path alone.
const mayBeCode = (path: string) => !/\.md$/i.test(path) && ![`/${SCRATCH}/`, '/docs/'].some(dir => path.includes(dir))
const BROKEN =
  "matt-flow：關卡出錯，先擋下改程式碼和 commit。停下來告訴人：把 matt-flow 退回上一個能用的版本（git -C ~/.claude/skills/matt-flow reset --hard 'HEAD@{1}'），或把它移出 skills 資料夾；/matt-flow off 讀的是同一份狀態，可能也沒用。"
// Ends the feature: it counts, and every step but setup starts over.
const finish = (p: Progress): Progress => ({
  ...p,
  steps: p.steps.setup ? { setup: p.steps.setup } : {},
  feature: null,
  isReviewed: false,
  features: p.features + 1,
})
const bar = (part: number, width: number) => Math.max(0, Math.min(width, Math.round(part * width)))

async function save($: EngineInterface) {
  const key = await read($, project)
  if (key === null) return
  await $.store.set(`progress:${key}`, await read($, progress))
}

type Saved = Partial<Progress> & { done?: string[]; rounds?: number }

// 0.2 stored the passed steps as `done` and the finished features as `rounds`.
function restore(saved: Saved | undefined, now: number): Progress {
  const level = saved?.level && ORDER.includes(saved.level) ? saved.level : FRESH.level
  if (saved?.steps) return { ...FRESH, ...saved, level }
  const done = saved?.done ?? []
  const features = saved?.rounds ?? 0
  // A round 0.2 had finished but not moved past is a finished feature.
  if (done.includes('retro')) return { ...FRESH, level, features: features + 1 }
  const steps = Object.fromEntries(done.map(key => [key, 'passed'] as const))
  const isUnderWay = Object.keys(steps).some(key => key !== 'setup')

  return { ...FRESH, level, steps, feature: isUnderWay ? { name: null, since: now } : null, features }
}

async function checkSetup($: EngineInterface) {
  const hasSetup = await $.fs.exists(`${await read($, project)}/${SETUP_FILE}`)
  await update($, isSetUp, () => hasSetup)
}

// The nearest folder at or above `cwd` that is set up, else `cwd`: a session opened in a
// subfolder works on its project, and a linked worktree with its own checkout is a project of its own.
async function projectRoot($: EngineInterface, cwd: string) {
  for (let dir = cwd; dir !== ''; dir = dir.slice(0, dir.lastIndexOf('/'))) {
    if (await $.fs.exists(`${dir}/${SETUP_FILE}`)) return dir
  }

  return cwd
}

// Another session of the project may have moved it on: read it afresh before acting on it.
// ponytail: $.store has no compare-and-set, so a write another session lands between this read and the save after it is lost.
async function reread($: EngineInterface) {
  const key = await read($, project)
  if (key === null) return
  const saved = (await $.store.get(`progress:${key}`)) as Saved | undefined
  const now = await $.clock.now()
  await update($, progress, () => restore(saved, now))
}

async function load($: EngineInterface, root: string) {
  await update($, project, () => root)
  await checkSetup($)
  await reread($)
}

// Why the rail stays out of this project (never set up, or turned off), or undefined while it is on.
async function quietLine($: EngineInterface) {
  if (!(await read($, isSetUp))) return `這個專案還沒設定，軌道沒有作用：先輸入 ${STEPS.setup.command}`
  if ((await read($, progress)).isOff) return '軌道在這個專案關著：輸入 /matt-flow on 打開'

  return undefined
}
const isQuiet = async ($: EngineInterface) => (await quietLine($)) !== undefined

async function isLocalTracker($: EngineInterface) {
  const text = await $.fs.read(`${await read($, project)}/${SETUP_FILE}`).catch(() => '')

  return /^# Issue tracker: Local Markdown/im.test(text)
}

const list = ($: EngineInterface, path: string) => $.fs.list(path).catch((): FsEntry[] => [])

async function refreshStatus($: EngineInterface) {
  const pending = await read($, unsynced)
  if (pending.length > 0) {
    return $.ui.status(`${pending.join(', ')} 改了 → 同步 README · plugin.json · docs · ask-matt`)
  }
  const p = await read($, progress)
  const key = nextStep(p, await read($, isSetUp))
  if (key === undefined || (await isQuiet($))) return $.ui.status(undefined)
  const icon = LEVELS[p.level].icon
  const next = isTicketByTicket(p) ? '/implement 下一張，或 /retro' : STEPS[key].command
  $.ui.status(p.isWrappingUp ? `✦ ${icon} 收尾中 · ${WRAP_UP}` : `✦ ${icon} 下一步 ${next} · /matt-flow`)
}

const nextCommand = async ($: EngineInterface) =>
  STEPS[nextStep(await read($, progress), await read($, isSetUp)) ?? 'grill'].command

// The retro's ending opens the wrap-up; the person ending the feature, or skipping its retro, does not.
async function endFeature($: EngineInterface, isWrapUp = false) {
  await update($, progress, p => ({ ...finish(p), isWrappingUp: isWrapUp }))
  const then = isWrapUp ? `收尾：${WRAP_UP}，下一個` : '下一個'

  return `🎉 功能結束，已完成 ${(await read($, progress)).features} 個功能 → ${then}從 ${STEPS.grill.command} 開始`
}

// Passes the steps not passed yet (a skipped one too, once it is done after all)
// and hands over to the next one; `note` leads the toast. A step outside the
// level passes quietly. Passing the retro ends the feature. A step that takes
// many turns, passed as its skill starts, hands over once done: nothing is suggested.
async function pass($: EngineInterface, keys: StepKey[], note?: string, isStart = false) {
  const before = await read($, progress)
  const fresh = keys.filter(key => before.steps[key] !== 'passed')
  if (fresh.length > 0) await update($, progress, p => mark(p, fresh, 'passed'))
  const own = fresh.filter(key => LEVELS[before.level].steps.includes(key))
  if (own.length === 0) {
    if (fresh.length > 0) await save($)
    if (note) $.ui.toast(note)
    return
  }
  const long = isStart ? own.find(key => MANY_TURNS[key] !== undefined) : undefined
  const isRetro = own.includes('retro')
  const isByTicket = !isRetro && isTicketByTicket(await read($, progress))
  const then = isByTicket ? NEXT_TICKET : `下一步 ${await nextCommand($)}`
  const said = isRetro
    ? await endFeature($, true)
    : long !== undefined
      ? `▶ 開始「${STEPS[long].title}」：${MANY_TURNS[long]}之後，${then}`
      : `✔ ${STEPS[own[0]!].title} 通過 → ${then}`
  suggestion = long !== undefined || isByTicket ? undefined : await nextCommand($)
  await save($)
  $.ui.toast(note ? `${note} · ${said}` : said)
}

async function startFeature($: EngineInterface) {
  const now = await $.clock.now()
  await update($, progress, p => (p.feature ? p : { ...p, feature: { name: null, since: now }, isWrappingUp: false }))
}

// A skill ran: typed by the person, or run by the model through the Skill tool.
async function noteSkill($: EngineInterface, name: string, byPerson: boolean) {
  // A plugin's skill arrives as `mattpocock-skills:to-spec`.
  const skill = name.split(':').pop() ?? name
  const keys = (Object.keys(STEPS) as StepKey[]).filter(key => STEPS[key].skills.includes(skill))
  if (keys.length === 0) return
  await reread($)
  if (await isQuiet($)) return
  // Only the person starts a feature, and nothing reaches past building before it has begun.
  const was = await read($, progress)
  if ((was.feature === null && !byPerson) || (!isBuilding(was) && keys.every(key => LATE.includes(key)))) return
  await startFeature($)
  // The person typing a later step's command skips the steps before it they have not passed.
  const p = await read($, progress)
  const order = LEVELS[p.level].steps
  const typed = byPerson ? keys.find(key => order.includes(key)) : undefined
  const skipped = typed ? order.slice(0, order.indexOf(typed)).filter(key => !stateOf(p, key, true)) : []
  if (skipped.length > 0) await update($, progress, q => mark(q, skipped, 'skipped'))
  const isLocal = await isLocalTracker($)
  await pass(
    $,
    keys.filter(key => (BUILD.includes(key) ? byPerson : !(isLocal && ARTIFACTS.includes(key)))),
    skipped.length > 0 ? `↷ 跳過${skipped.map(key => `「${STEPS[key].title}」`).join('')}` : undefined,
    true,
  )
  // One review per build, and each /implement the person types is a build; the fixes after a review commit without another.
  if (byPerson && keys.some(key => BUILD.includes(key))) await update($, progress, p => ({ ...p, isReviewed: false }))
  if (keys.includes('review')) await update($, progress, p => (isBuilding(p) ? { ...p, isReviewed: true } : p))
  await save($)
  await refreshStatus($)
}

// With the local tracker, spec and tickets pass on files written since the
// feature started. Until a spec names the feature's folder only a spec counts, in any folder;
// then both count, in that folder alone.
// ponytail: written means modified (fs has no creation time), so an old spec or ticket of the same folder edited now counts.
async function checkArtifacts($: EngineInterface) {
  const p = await read($, progress)
  if (p.feature === null || (await isQuiet($)) || !(await isLocalTracker($))) return
  const { name, since } = p.feature
  const root = `${await read($, project)}/${SCRATCH}`
  const isNew = (entries: FsEntry[], file: RegExp) =>
    entries.some(entry => entry.kind === 'file' && file.test(entry.name) && entry.mtimeMs >= since)
  const folders = name !== null ? [name] : (await list($, root)).filter(entry => entry.kind === 'dir').map(entry => entry.name)
  for (const folder of folders) {
    const found: StepKey[] = []
    if (isNew(await list($, `${root}/${folder}`), /^spec\.md$/)) found.push('spec')
    if (name !== null && isNew(await list($, `${root}/${folder}/issues`), /\.md$/)) found.push('tickets')
    if (found.length === 0) continue
    // The feature goes by its spec's folder.
    if (name === null && found.includes('spec')) await update($, progress, q => ({ ...q, feature: { name: folder, since } }))

    return pass($, found)
  }
}

// Why editing `path` is denied, or undefined while it may go ahead. The unlock
// command is offered to the person too.
async function codeGate($: EngineInterface, path: string) {
  const root = await read($, project)
  // Quiet first: as long as the state reads at all, /matt-flow off holds.
  if (root === null || (await isQuiet($)) || !isCode(root, path)) return undefined
  const p = await read($, progress)
  if (isCodeOpen(p)) return undefined
  const key = unlockStep(p)
  suggestion = STEPS[key].command

  return `matt-flow：還沒到動手做，程式碼鎖著。下一步是「${STEPS[key].title}」，解鎖要由人輸入 ${suggestion}（已預填在輸入框）。停下來交棒：把這個指令告訴人，然後結束這次回覆。不要改用 Bash 或其他方式寫這個檔案。`
}

// Why running `command` is denied, or undefined while it may go ahead. A subagent
// of /implement-spec commits its ticket: the person started that run.
async function commitGate($: EngineInterface, command: string, isAgent: boolean) {
  if (!GIT_COMMIT.test(command) || (await isQuiet($))) return undefined
  const p = await read($, progress)
  if ((isAgent && p.steps.parallel) || !isCommitLocked(p)) return undefined
  suggestion = STEPS.review.command

  return 'matt-flow：這次動手做還沒跑過 code-review，先不能 commit。先用 Skill 工具跑 code-review（或請人輸入 /code-review），跑過之後的 commit 都會放行。不要繞過這個阻擋。'
}

// Claude's own map of the rail, sent beside the person's prompt: where the flow
// stands, what is locked and how it unlocks, what still goes, and how to hand over.
async function railPrompt($: EngineInterface) {
  if (await isQuiet($)) return undefined
  const p = await read($, progress)
  const step = STEPS[nextStep(p, true) ?? 'grill']
  const isByTicket = isTicketByTicket(p)
  const locks = [
    ...(isCodeOpen(p)
      ? []
      : [`改程式碼（Edit、Write、NotebookEdit）：由人輸入 ${STEPS[unlockStep(p)].command} 解鎖`]),
    ...(isCommitLocked(p) ? ['git commit：先跑 code-review（Skill 工具，或請人輸入 /code-review）'] : []),
  ]

  return [
    '# matt-flow 軌道',
    '',
    '這個專案照 Matt Pocock 的流程走，由 matt-flow 把關，人輸入每一步的指令。',
    `- ${featureLine(p)}`,
    `- 等級：${LEVELS[p.level].name}`,
    `- 下一步：${isByTicket ? NEXT_TICKET : `${step.title}（${step.command}）`}`,
    `- 現在會被擋的動作：${locks.length === 0 ? '沒有' : ''}`,
    ...locks.map(lock => `  - ${lock}`),
    ...(isCodeOpen(p)
      ? []
      : ['- 仍可以：讀檔、跑測試、改 markdown、docs/、.scratch/；跟目前功能無關的修改，請人決定要不要 /matt-flow off']),
    '',
    '規矩：',
    `- 交棒：人這次啟動的 skill 整個做完（不是它一開始），或改程式碼被擋下時，就停下來，把下一步的指令（現在是 ${isByTicket ? NEXT_TICKET : step.command}）告訴人，然後結束這次回覆；由人輸入，不要自己往下做。`,
    '- 除了下一步的指令和 /matt-flow，不要主動建議流程指令；人輸入 /ask-matt 時，照 ask-matt 回答。',
    '- 絕不繞過任何阻擋，包括改用 Bash 寫檔或 commit。',
  ].join('\n')
}

// `/matt-flow skip`: the step the flow stands on counts as passed, without its artifact.
async function skipStep($: EngineInterface) {
  await reread($)
  const quiet = await quietLine($)
  if (quiet) return quiet
  const key = nextStep(await read($, progress), true) ?? 'grill'
  await startFeature($)
  await update($, progress, p => mark(p, [key], 'skipped'))
  const line = key === 'retro' ? await endFeature($) : `↷ 跳過「${STEPS[key].title}」→ 下一步 ${await nextCommand($)}`
  await save($)
  await refreshStatus($)

  return line
}

// `/matt-flow end`: the person closes the feature, done or abandoned.
async function stopFeature($: EngineInterface) {
  await reread($)
  const quiet = await quietLine($)
  if (quiet) return quiet
  const p = await read($, progress)
  if (p.feature === null && p.isWrappingUp) {
    await update($, progress, q => ({ ...q, isWrappingUp: false }))
    await save($)
    await refreshStatus($)

    return `收尾結束 → 下一步 ${await nextCommand($)}`
  }
  if (p.feature === null) return `沒有進行中的功能 → 下一步 ${await nextCommand($)}`
  const line = await endFeature($)
  await save($)
  await refreshStatus($)

  return line
}

// `/matt-flow off` and `on`, for this project.
async function setOff($: EngineInterface, isOff: boolean) {
  await reread($)
  await update($, progress, p => ({ ...p, isOff }))
  await save($)
  await refreshStatus($)
  if (isOff) return '軌道在這個專案關掉了：不擋程式碼和 commit，也不交棒。輸入 /matt-flow on 再打開'

  return (await quietLine($)) ?? `軌道打開了 → 下一步 ${await nextCommand($)}`
}

// Mid-build, the new level's steps up to its own building count as skipped, so the flow goes on from there.
async function setLevel($: EngineInterface, lv: Level) {
  await reread($)
  await update($, progress, p => {
    if (!isBuilding(p)) return { ...p, level: lv }
    const order = LEVELS[lv].steps
    const upTo = order.slice(0, order.findIndex(key => BUILD.includes(key)) + 1)

    return mark({ ...p, level: lv }, upTo.filter(key => !stateOf(p, key, true)), 'skipped')
  })
  await save($)
  await refreshStatus($)
}

async function askMatt($: EngineInterface, lv: Level, key: StepKey) {
  await $.prompt.fill({
    text: `/ask-matt 我在 Matt 導航的「${LEVELS[lv].name}」流程，卡在「${STEPS[key].title}」(${STEPS[key].command})。我遇到的狀況是：`,
    // A draft the person was writing stays.
    mode: 'insert',
  })
}

// `rel` is the written file's path relative to the repo root.
async function noteWrite($: EngineInterface, rel: string) {
  const skill = PROMOTED.exec(rel)?.[1]
  if (SYNC_TARGET.test(rel)) {
    await update($, unsynced, () => [])
  } else if (skill) {
    await update($, unsynced, list => (list.includes(skill) ? list : [...list, skill]))
  }
  await refreshStatus($)
}

async function isSkillsRepo($: EngineInterface, root: string) {
  try {
    return JSON.parse(await $.fs.read(`${root}/.claude-plugin/plugin.json`)).name === 'mattpocock-skills'
  } catch {
    return false
  }
}

export const register: Register = on => {
  let repoRoot: string | null = null

  const inRepo = (path: string) => repoRoot !== null && path.startsWith(`${repoRoot}/`)
  const denial = (name: string) =>
    `${name}: no ${EM_DASH} in this repo (CLAUDE.md). Rewrite the sentence with a comma, colon, period, parentheses or a conjunction, whichever it wants; never a blind character swap.`

  on('session.start', async ($, e, next) => {
    const root = await projectRoot($, e.cwd)
    repoRoot = (await isSkillsRepo($, root)) ? root : null
    await load($, root)
    await $.command.register({
      name: 'matt-flow',
      description: '打開或關閉 Matt 導航；skip 跳過下一步，end 結束功能或收尾，off／on 關閉或打開這個專案的軌道',
      argumentHint: 'skip | end | off | on',
    })
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'matt-flow' }, async ($, e) => {
    switch (e.args.trim()) {
      case '':
        break
      case 'skip':
        return { text: await skipStep($) }
      case 'end':
        return { text: await stopFeature($) }
      case 'off':
        return { text: await setOff($, true) }
      case 'on':
        return { text: await setOff($, false) }
      default:
        return { text: '用法：/matt-flow 打開或關閉面板；/matt-flow skip、end、off、on' }
    }
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })

      return { text: 'Matt 導航已關閉，再輸入 /matt-flow 就會打開。' }
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Matt 導航已打開。' }
  })

  // Not `skill.prompt`: the managed security hook skips past user plugins there.
  // A skill the person typed as `/name`. Fails open on purpose: it notes and
  // reminds, and must never refuse what the person typed.
  on('prompt.submit', async ($, e, next) => {
    await reread($)
    if (e.command) await noteSkill($, e.command.name, true)
    const rail = await railPrompt($)
    if (rail === sent) return next(e)
    // A rail taken back says so: the old one stays in the conversation, still telling Claude to stop.
    const line = rail ?? 'matt-flow 軌道在這個專案停用了，先前的規矩不再適用。'
    sent = rail

    return next({ ...e, context: [...(e.context ?? []), line] })
  })

  on('session.compact', async ($, e, next) => {
    const ran = await next(e)
    // `precompute` installs nothing; a subagent's compaction leaves the main conversation alone.
    if (e.agentId === undefined && e.trigger !== 'precompute') sent = undefined

    return ran
  })

  // ponytail: a rewind (esc esc) raises no event; a rail rewound away comes back only once it changes.
  on('session.end', async ($, e, next) => {
    sent = undefined

    return next(e)
  })

  // A skill the model ran through the Skill tool; a subagent's moves nothing, only the main thread does.
  // Fails open on purpose: it only notes.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError && e.agentId === undefined) await noteSkill($, e.skill, false)

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn ending is no hand-over: the person is waiting on the main thread.
    if (e.agentId !== undefined) return next(e)
    const { context } = await $.session.usage()
    await update($, tokens, () => context.tokens ?? null)
    await reread($)
    const wasSetUp = await read($, isSetUp)
    await checkSetup($)
    if (!wasSetUp && !(await isQuiet($))) await pass($, ['setup'])
    await checkArtifacts($)
    await refreshStatus($)
    const ran = await next(e)
    if (suggestion !== undefined) {
      void $.prompt.suggest({ text: suggestion })
      suggestion = undefined
    }

    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const locked = await codeGate($, e.file_path)
    if (locked) return { deny: locked }
    if (!inRepo(e.file_path)) return next(e)
    if (e.new_string.includes(EM_DASH)) return { deny: denial($.plugin.name) }
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) await noteWrite($, e.file_path.slice(`${repoRoot}/`.length))

    return ran
  }).catch(($, e, next) => (next.called ? next(e) : mayBeCode(e.file_path) ? { deny: BROKEN } : next(e)))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const locked = await codeGate($, e.file_path)
    if (locked) return { deny: locked }
    if (!inRepo(e.file_path)) return next(e)
    if (e.content.includes(EM_DASH)) return { deny: denial($.plugin.name) }
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) await noteWrite($, e.file_path.slice(`${repoRoot}/`.length))

    return ran
  }).catch(($, e, next) => (next.called ? next(e) : mayBeCode(e.file_path) ? { deny: BROKEN } : next(e)))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const locked = await commitGate($, e.command, e.agentId !== undefined)

    return locked ? { deny: locked } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : GIT_COMMIT.test(e.command) ? { deny: BROKEN } : next(e)))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const locked = await codeGate($, e.notebook_path)

    return locked ? { deny: locked } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : mayBeCode(e.notebook_path) ? { deny: BROKEN } : next(e)))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = await read($, progress)
    const lv = p.level
    const setUp = await read($, isSetUp)
    const fill = await read($, tokens)
    const pending = await read($, unsynced)
    const quiet = await quietLine($)
    const track = LEVELS[lv]
    const upNext = nextStep(p, setUp)
    const count = track.steps.filter(key => stateOf(p, key, setUp)).length
    const width = Math.max(8, Math.min(24, (e.props.bodyColumns ?? 40) - 10))
    const filled = bar(count / track.steps.length, width)
    const zone = fill === null ? 0 : fill / SMART_ZONE
    const zoneColor = zone >= 1 ? 'error' : zone >= 0.8 ? 'warning' : 'success'

    return (
      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between">
          <Text bold color="claude">
            ✦ Matt 導航
          </Text>
          <Text bold color="inverseText" backgroundColor="claude">
            {` 已完成 ${p.features} 個功能 `}
          </Text>
        </Box>

        <Box flexDirection="column">
          <Box gap={1} flexWrap="wrap">
            {ORDER.map(each => (
              <Button
                key={`level-${each}`}
                variant={each === lv ? 'primary' : undefined}
                dimColor={each !== lv}
                onPress={() => setLevel($, each)}
              >
                {`${LEVELS[each].icon} ${LEVELS[each].name}`}
              </Button>
            ))}
          </Box>
          <Text italic color="subtle">
            {track.goal}
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>{featureLine(p)}</Text>
          {quiet !== undefined && (
            <Text color="warning" wrap="wrap">
              {quiet}
            </Text>
          )}
        </Box>

        <Box gap={1}>
          <Text color="success">{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(width - filled)}</Text>
          <Text bold>{`${count} / ${track.steps.length}`}</Text>
        </Box>

        <Box flexDirection="column">
          {track.steps.map((key, i) => {
            const step = STEPS[key]
            const state = stateOf(p, key, setUp)

            return key === upNext ? (
              <Box
                key={key}
                flexDirection="column"
                borderStyle="round"
                borderColor="claude"
                paddingX={1}
              >
                <Text bold color="claude">{`▶ ${i + 1}. ${step.title}`}</Text>
                <Text bold color="suggestion">{`   ${step.command}`}</Text>
                <Text wrap="wrap">{step.what}</Text>
                <Text italic color="subtle" wrap="wrap">{`💡 ${step.tip}`}</Text>
                <Box gap={1} flexWrap="wrap" marginTop={1}>
                  <Button key="skip" hotkey="1" onPress={async () => $.ui.toast(await skipStep($))}>
                    ↷ 跳過
                  </Button>
                  <Button key="stuck" hotkey="2" dimColor onPress={() => askMatt($, lv, key)}>
                    ? 我卡住了
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box key={key} justifyContent="space-between" paddingX={1}>
                {state === 'passed' ? (
                  <Text color="success">{`✔ ${i + 1}. ${step.title}`}</Text>
                ) : state === 'skipped' ? (
                  <Text color="warning" dimColor>{`↷ ${i + 1}. ${step.title}（跳過）`}</Text>
                ) : (
                  <Text dimColor>{`○ ${i + 1}. ${step.title}`}</Text>
                )}
                <Text dimColor>{step.command}</Text>
              </Box>
            )
          })}
        </Box>

        {fill !== null && (
          <Box flexDirection="column">
            <Box gap={1}>
              <Text>🧠</Text>
              <Text color={zoneColor}>{'▮'.repeat(bar(zone, 10))}</Text>
              <Text dimColor>{'▯'.repeat(10 - bar(zone, 10))}</Text>
              <Text color={zoneColor}>{`${Math.round(fill / 1000)}k / ${SMART_ZONE / 1000}k`}</Text>
            </Box>
            {zone >= 0.8 && (
              <Text color="warning" wrap="wrap">
                對話快塞滿了：交棒時先 /compact
              </Text>
            )}
          </Box>
        )}

        {pending.length > 0 && (
          <Text color="warning" wrap="wrap">
            {`待同步 ${pending.join(', ')} → README · plugin.json · docs · ask-matt`}
          </Text>
        )}

        {e.surface === 'terminal' && (
          <Text dimColor wrap="wrap">
            ctrl+x tab 進入面板，按數字鍵就能按按鈕
          </Text>
        )}
      </Box>
    )
  })
}
