import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Level } from '../types'

const PANE = 'matt-flow'
const TITLE = '✦ Matt 導航'
// ask-matt's smart zone: compact at a phase boundary before crossing it.
const SMART_ZONE = 150_000
// Built from its code point so this file never holds the character it bans.
const EM_DASH = String.fromCharCode(0x2014)
// Written by /setup-matt-pocock-skills: a project holding it is set up.
const SETUP_FILE = 'docs/agents/issue-tracker.md'

type Step = { title: string; command: string; skills: string[]; what: string; tip: string }

const STEPS = {
  setup: {
    title: '設定專案',
    command: '/setup-matt-pocock-skills',
    skills: ['setup-matt-pocock-skills'],
    what: '告訴 AI 任務放哪裡（GitHub 或本地檔案）、文件放哪裡。每個專案只要做一次。',
    tip: '做過就會自動打勾，之後每個新功能都從下一步開始。',
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
    skills: ['implement', 'tdd'],
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

// Editing any of these counts as having synced the skills edited before.
// ponytail: one touch clears every pending skill; track per-target if that misleads.
const SYNC_TARGET = /^(README\.md|\.claude-plugin\/plugin\.json|docs\/|skills\/engineering\/ask-matt\/)/
const PROMOTED = /^skills\/(?:engineering|productivity)\/([^/]+)\//

const project = atom({ plugin: 'matt-flow', key: 'project' } as const, null)
const level = atom({ plugin: 'matt-flow', key: 'level' } as const, 'beginner')
const done = atom({ plugin: 'matt-flow', key: 'done' } as const, [])
const rounds = atom({ plugin: 'matt-flow', key: 'rounds' } as const, 0)
const isSetUp = atom({ plugin: 'matt-flow', key: 'isSetUp' } as const, false)
const tokens = atom({ plugin: 'matt-flow', key: 'tokens' } as const, null)
const unsynced = atom({ plugin: 'matt-flow', key: 'unsynced' } as const, [])

const isStepDone = (list: string[], key: StepKey, setUp: boolean) =>
  list.includes(key) || (key === 'setup' && setUp)
const currentStep = (lv: Level, list: string[], setUp: boolean) =>
  LEVELS[lv].steps.find(key => !isStepDone(list, key, setUp))
const bar = (part: number, width: number) => Math.max(0, Math.min(width, Math.round(part * width)))

async function save($: EngineInterface) {
  const key = await read($, project)
  if (key === null) return
  await $.store.set(`progress:${key}`, {
    level: await read($, level),
    done: await read($, done),
    rounds: await read($, rounds),
  })
}

async function load($: EngineInterface, cwd: string) {
  await update($, project, () => cwd)
  const hasSetup = await $.fs.exists(SETUP_FILE)
  await update($, isSetUp, () => hasSetup)
  const saved = (await $.store.get(`progress:${cwd}`)) as
    | { level?: Level; done?: string[]; rounds?: number }
    | undefined
  if (saved?.level && ORDER.includes(saved.level)) await update($, level, () => saved.level!)
  if (Array.isArray(saved?.done)) await update($, done, () => saved.done!)
  if (typeof saved?.rounds === 'number') await update($, rounds, () => saved.rounds!)
}

async function refreshStatus($: EngineInterface) {
  const pending = await read($, unsynced)
  if (pending.length > 0) {
    return $.ui.status(`${pending.join(', ')} 改了 → 同步 README · plugin.json · docs · ask-matt`)
  }
  const list = await read($, done)
  const setUp = await read($, isSetUp)
  // Quiet in projects that never took up the flow.
  if (!setUp && list.length === 0) return $.ui.status(undefined)
  const lv = await read($, level)
  const key = currentStep(lv, list, setUp)
  $.ui.status(
    key
      ? `✦ ${LEVELS[lv].icon} 下一步 ${STEPS[key].command} · /matt-flow`
      : '✦ 🎉 這一輪完成 · /matt-flow',
  )
}

// Marks the steps a skill run finishes; returns the next step's command, if it moved on.
async function markSkill($: EngineInterface, skill: string) {
  const before = await read($, done)
  const fresh = (Object.keys(STEPS) as StepKey[]).filter(
    key => STEPS[key].skills.includes(skill) && !before.includes(key),
  )
  if (fresh.length === 0) return undefined
  await update($, done, list => [...list, ...fresh])
  await save($)
  const lv = await read($, level)
  const key = currentStep(lv, [...before, ...fresh], await read($, isSetUp))
  $.ui.toast(
    key
      ? `✔ ${STEPS[fresh[0]!].title} 完成 → 下一步 ${STEPS[key].command}`
      : `🎉 ${LEVELS[lv].icon} ${LEVELS[lv].name}流程走完一輪！輸入 /matt-flow 看看`,
  )

  return key && STEPS[key].command
}

async function markDone($: EngineInterface, key: StepKey) {
  await update($, done, list => (list.includes(key) ? list : [...list, key]))
  await save($)
  await refreshStatus($)
}

async function setLevel($: EngineInterface, lv: Level) {
  await update($, level, () => lv)
  await save($)
  await refreshStatus($)
}

async function nextRound($: EngineInterface, lv: Level) {
  await update($, level, () => lv)
  await update($, done, () => [])
  await update($, rounds, n => n + 1)
  await save($)
  await refreshStatus($)
}

async function askMatt($: EngineInterface, lv: Level, key: StepKey) {
  await $.prompt.fill({
    text: `/ask-matt 我在 Matt 導航的「${LEVELS[lv].name}」流程，卡在「${STEPS[key].title}」(${STEPS[key].command})。我遇到的狀況是：`,
  })
}

async function fillCommand($: EngineInterface, command: string) {
  await $.prompt.fill({ text: command })
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

async function isSkillsRepo($: EngineInterface, cwd: string) {
  try {
    return JSON.parse(await $.fs.read(`${cwd}/.claude-plugin/plugin.json`)).name === 'mattpocock-skills'
  } catch {
    return false
  }
}

export const register: Register = on => {
  let repoRoot: string | null = null
  // The next step's command, offered in the prompt box once the turn ends.
  let suggestion: string | undefined

  const inRepo = (path: string) => repoRoot !== null && path.startsWith(`${repoRoot}/`)
  const denial = (name: string) =>
    `${name}: no ${EM_DASH} in this repo (CLAUDE.md). Rewrite the sentence with a comma, colon, period, parentheses or a conjunction, whichever it wants; never a blind character swap.`

  on('session.start', async ($, e, next) => {
    repoRoot = (await isSkillsRepo($, e.cwd)) ? e.cwd : null
    await load($, e.cwd)
    await $.command.register({
      name: 'matt-flow',
      description: '打開或關閉 Matt 導航：一步一步帶你走 Matt Pocock 的開發流程',
    })
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'matt-flow' }, async $ => {
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })

      return { text: 'Matt 導航已關閉，再輸入 /matt-flow 就會打開。' }
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Matt 導航已打開。' }
  })

  on('skill.prompt', async ($, e, next) => {
    // A plugin's skill arrives as `mattpocock-skills:to-spec`.
    suggestion = (await markSkill($, e.skill.split(':').pop() ?? e.skill)) ?? suggestion
    await refreshStatus($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const { context } = await $.session.usage()
    await update($, tokens, () => context.tokens ?? null)
    const hasSetup = await $.fs.exists(SETUP_FILE)
    await update($, isSetUp, () => hasSetup)
    await refreshStatus($)
    const ran = await next(e)
    if (suggestion !== undefined) {
      void $.prompt.suggest({ text: suggestion })
      suggestion = undefined
    }

    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (!inRepo(e.file_path)) return next(e)
    if (e.new_string.includes(EM_DASH)) return { deny: denial($.plugin.name) }
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) await noteWrite($, e.file_path.slice(`${repoRoot}/`.length))

    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (!inRepo(e.file_path)) return next(e)
    if (e.content.includes(EM_DASH)) return { deny: denial($.plugin.name) }
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) await noteWrite($, e.file_path.slice(`${repoRoot}/`.length))

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lv = await read($, level)
    const list = await read($, done)
    const setUp = await read($, isSetUp)
    const round = await read($, rounds)
    const fill = await read($, tokens)
    const pending = await read($, unsynced)
    const track = LEVELS[lv]
    const current = currentStep(lv, list, setUp)
    const count = track.steps.filter(key => isStepDone(list, key, setUp)).length
    const width = Math.max(8, Math.min(24, (e.props.bodyColumns ?? 40) - 10))
    const filled = bar(count / track.steps.length, width)
    const higher = ORDER[ORDER.indexOf(lv) + 1]
    const zone = fill === null ? 0 : fill / SMART_ZONE
    const zoneColor = zone >= 1 ? 'error' : zone >= 0.8 ? 'warning' : 'success'

    return (
      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between">
          <Text bold color="claude">
            ✦ Matt 導航
          </Text>
          <Text bold color="inverseText" backgroundColor="claude">
            {` 第 ${round + 1} 輪 `}
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

        <Box gap={1}>
          <Text color="success">{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(width - filled)}</Text>
          <Text bold>{`${count} / ${track.steps.length}`}</Text>
        </Box>

        <Box flexDirection="column">
          {track.steps.map((key, i) => {
            const step = STEPS[key]
            const isDone = isStepDone(list, key, setUp)

            return key === current ? (
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
                  <Button key="fill" hotkey="1" variant="primary" onPress={() => fillCommand($, step.command)}>
                    ⏎ 填入指令
                  </Button>
                  <Button key="mark" hotkey="2" onPress={() => markDone($, key)}>
                    ✓ 做完了
                  </Button>
                  <Button key="stuck" hotkey="3" dimColor onPress={() => askMatt($, lv, key)}>
                    ? 我卡住了
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box key={key} justifyContent="space-between" paddingX={1}>
                <Text color={isDone ? 'success' : undefined} dimColor={!isDone}>
                  {`${isDone ? '✔' : '○'} ${i + 1}. ${step.title}`}
                </Text>
                <Text dimColor>{step.command}</Text>
              </Box>
            )
          })}
        </Box>

        {current === undefined && (
          <Box flexDirection="column" borderStyle="double" borderColor="success" paddingX={1}>
            <Text bold color="success">
              🎉 這一輪完成了！
            </Text>
            <Text wrap="wrap">{`你已經走完${track.icon} ${track.name}的整套流程，累積 ${round + 1} 輪。`}</Text>
            <Box gap={1} flexWrap="wrap" marginTop={1}>
              <Button key="again" hotkey="1" variant="primary" onPress={() => nextRound($, lv)}>
                ↻ 做下一個功能
              </Button>
              {higher !== undefined && (
                <Button key="upgrade" hotkey="2" onPress={() => nextRound($, higher)}>
                  {`${LEVELS[higher].icon} 升級到${LEVELS[higher].name}`}
                </Button>
              )}
            </Box>
          </Box>
        )}

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
                對話快塞滿了：在這一步做完時 /compact
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
