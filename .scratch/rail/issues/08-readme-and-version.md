# 08: README 與版本

**What to build:** 使用者從 README 就能看懂軌道怎麼運作：什麼時候會被擋、怎麼解鎖、怎麼跳過或關掉。版本升到 0.3.0，已經安裝的副本才會更新。

**Blocked by:** 05, 07

**Status:** ready-for-agent

- [x] README 說明軌道、程式碼關卡、commit 關卡、交棒，以及 `skip`、`end`、`off`、`on` 四個子指令
- [x] README 原本的前置條件和安裝方式保留不變
- [x] manifest 的版本升到 0.3.0
- [x] `claude plugin validate` 和 `claude plugin test` 全部通過
- [x] 證據：完成時在本檔底下加「## 證據」，貼上 validate 和 test 的輸出

## 證據

README 只改了開頭的介紹和「使用方式」一節；前置條件和安裝方式（第 5 到 79 行）沒動。manifest 版本 0.2.0 → 0.3.0。

`claude plugin validate .`（結果是 passed with warnings；`✘` 那行是 plugin directory 的上架檢查，缺 LICENSE，0.2 就有，不影響驗證結果）：

```
Validating marketplace manifest: /Users/awesomeartengineer01/.claude/skills/matt-flow/.claude-plugin/marketplace.json

⚠ Found 2 warnings:

  ❯ description: No marketplace description provided. Adding a description helps users understand what this marketplace offers
  ❯ plugins[0] plugin.json → author: No author information provided. Consider adding author details for plugin attribution

Validating plugin: /Users/awesomeartengineer01/.claude/skills/matt-flow/.claude-plugin/plugin.json

⚠ Found 1 warning:

  ❯ author: No author information provided. Consider adding author details for plugin attribution

  ❯ types ./types/index.d.ts declares on $: nothing (no EngineInterface member)
  ❯ types ./types/index.d.ts declares state: matt-flow.project, matt-flow.progress, matt-flow.isSetUp, matt-flow.tokens, matt-flow.unsynced

Validating plugin: /Users/awesomeartengineer01/.claude/skills/matt-flow/CLAUDE.md

⚠ Found 1 warning:

  ❯ root: CLAUDE.md at the plugin root is not loaded as project context. To ship context with your plugin, use a skill (skills/<name>/SKILL.md) instead.

Validating hooks: /Users/awesomeartengineer01/.claude/skills/matt-flow/hooks/hooks.json

  ❯ ./register.tsx hooks: session.start, command.run{command=matt-flow}, prompt.submit, tool.call{tool=Skill}, turn.complete, tool.call{tool=Edit}, tool.call{tool=Write}, prompt.compose, tool.call{tool=Bash}, tool.call{tool=NotebookEdit}, ui.render{component=Pane, requestId=matt-flow}
  ❯ ./register.tsx answers its own command: command.run{command=matt-flow}
  ❯ ./register.tsx gating hook without .catch: prompt.submit
  ❯ ./register.tsx gating hook without .catch: tool.call{tool=Skill}
  ❯ ./register.tsx gating hook without .catch: tool.call{tool=Edit}
  ❯ ./register.tsx gating hook without .catch: tool.call{tool=Write}
  ❯ ./register.tsx gating hook without .catch: tool.call{tool=Bash}
  ❯ ./register.tsx gating hook without .catch: tool.call{tool=NotebookEdit}
  ❯ ./register.tsx calls: $.clock.now (via load, noteSkill, skipStep), $.command.register, $.fs.exists (via checkSetup), $.fs.list (via list), $.fs.read (via isLocalTracker, isSkillsRepo), $.prompt.fill (via askMatt), $.prompt.suggest, $.session.usage, $.state.get, $.state.set, $.store.get (via load), $.store.set (via save), $.ui.close, $.ui.open, $.ui.panes, $.ui.resolve, $.ui.status (via refreshStatus), $.ui.toast
  ❯ ./register.tsx state writes: matt-flow.isSetUp, matt-flow.progress, matt-flow.project, matt-flow.tokens, matt-flow.unsynced
  ❯ ./register.tsx state reads: matt-flow.isSetUp, matt-flow.progress, matt-flow.project, matt-flow.tokens, matt-flow.unsynced

Plugin directory checks for /Users/awesomeartengineer01/.claude/skills/matt-flow. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

✘ Found 1 problem the plugin directory refuses a submission for:

  ❯ LICENSE: License missing (LICENSE_MISSING). This plugin has no LICENSE file and plugin.json has no `license`. The directory requires one of them.
    Fix: Add a LICENSE file to the plugin folder, or set `license` (an SPDX id) in plugin.json. A LICENSE at the repository root also counts for a plugin in a sub-folder.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ This folder also holds a marketplace manifest. The plugin directory treats such a folder as a plugin, so these checks cover only the plugin in this folder. To check another plugin that the marketplace lists, run validate on that plugin's folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below. To fail on problems the directory refuses a submission for, run this command with --profile directory.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed with warnings
```

`claude plugin test .`：

```

hooks/register.test.tsx:
(pass) a set-up project starts the beginner at grilling, on every surface
(pass) progress saved by 0.2 carries over: its steps passed, its rounds finished features
(pass) a skill the person types moves the guide on
(pass) the pane is a dashboard on every surface: the card offers skip and stuck, nothing that runs or ticks a step
(pass) skip on the pane works like /matt-flow skip, and a skipped step looks unlike a passed one
(pass) stuck fills /ask-matt with where the person is
(pass) a skill the model runs through the Skill tool moves the guide on too
(pass) the expert track builds in parallel
(pass) a flow skill starts a feature, and the retro ends it: it counts, and the next starts from grilling
(pass) a passed step hands over: a toast now, the next command suggested when the turn ends
(pass) only the person typing /implement passes building: the model running tdd or implement does not
(pass) on the local tracker, spec and tickets pass on their files, written since the feature started
(pass) on the GitHub tracker, spec and tickets pass when their skills run
(pass) a project set up this turn hands over to grilling
(pass) a project never set up stays quiet: skills there start nothing
(pass) with no feature under way, code is locked: the denial names /grill-with-docs, and offers it
(pass) during a feature, the denial names the next step on the way to building
(pass) code unlocks once the person types /implement
(pass) markdown, docs, the tracker folder and files outside the project are never locked
(pass) a project never set up locks nothing
(pass) a beginner building cannot commit until code-review runs, then every later commit goes
(pass) an intermediate building waits for code-review too, the person typing it counts
(pass) commits outside building, and Bash that does not commit, always go
(pass) the expert commits freely: /implement-spec reviews its own work
(pass) with no feature, the system prompt says code is locked behind /grill-with-docs, and the rules
(pass) once the spec is written, the system prompt names the feature and points at /to-tickets
(pass) while building, the system prompt locks only the commit, until code-review runs
(pass) a project never set up gets no rail in its system prompt
(pass) /matt-flow alone still opens and closes the pane; an unknown argument shows the usage
(pass) /matt-flow skip skips the step the flow stands on, and says what is next
(pass) /matt-flow end, or skipping the retro, ends the feature
(pass) /matt-flow off quiets the gates and the system prompt in this project; on brings them back
(pass) in a project never set up, the subcommands say why the rail does nothing
(pass) typing a later step runs it all the same, skipping the steps before it with a toast
(pass) an em-dash is denied inside the skills repo only

 35 pass
 0 fail
Ran 35 tests across 1 file. [0.72s]
```
