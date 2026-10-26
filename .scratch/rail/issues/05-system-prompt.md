# 05: 系統提示

**What to build:** Claude 每一輪都會在系統提示裡看到自己在流程的哪裡：目前的功能、等級、步驟，現在哪些動作會被擋、各自怎麼解鎖，以及交棒的規矩。這樣 Claude 的建議會跟面板一致，也不會去嘗試一定會被擋的動作。

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [x] 做過 setup、軌道開著的專案裡，系統提示最後多一段（session 範圍）
- [x] 內容包括：功能和它的名稱（如果已經有）、等級、目前的步驟、現在被擋的動作和各自的解鎖指令
- [x] 內容包括規矩：每次交棒都要停下來，把下一步的指令告訴人；除了下一步的指令，不建議其他流程指令；絕不繞過任何阻擋，包括透過 Bash
- [x] 沒做過 setup，或軌道關掉時，不加這一段
- [x] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出，以及這段系統提示在三種情況下的實際文字：沒有功能、規格寫好但還沒切卡、動手做中

## 證據

新增的測試先跑（只列和這張卡相關的；其他既有測試全數通過）。「沒做過 setup」的測試描述的是不加這一段，所以一開始就通過：

```
(fail) with no feature, the system prompt says code is locked behind /grill-with-docs, and the rules
  AssertionError: expect(received).toMatch()
  Expected: /還沒有進行中的功能/
  Received: undefined
(fail) once the spec is written, the system prompt names the feature and points at /to-tickets
  AssertionError: expect(received).toMatch()
  Expected: /「rail」/
  Received: undefined
(fail) while building, the system prompt locks only the commit, until code-review runs
  AssertionError: expect(received).toMatch()
  Expected: /git commit.*code-review/
  Received: undefined
(pass) a project never set up gets no rail in its system prompt
 23 pass
 3 fail
```

改完之後：

```
(pass) with no feature, the system prompt says code is locked behind /grill-with-docs, and the rules
(pass) once the spec is written, the system prompt names the feature and points at /to-tickets
(pass) while building, the system prompt locks only the commit, until code-review runs
(pass) a project never set up gets no rail in its system prompt
 26 pass
 0 fail
```

這一段的 id 是 `matt-flow:rail`，scope 是 `session`，放在系統提示最後。三種情況下的實際文字：

沒有功能（進階等級）：

```
# matt-flow 軌道

這個專案照 Matt Pocock 的流程走，由 matt-flow 把關，人輸入每一步的指令。
- 還沒有進行中的功能
- 等級：進階
- 目前的步驟：把想法問清楚（/grill-with-docs）
- 現在會被擋的動作：
  - 改程式碼（Edit、Write、NotebookEdit）：由人輸入 /grill-with-docs 解鎖

規矩：
- 交棒：做完人這次啟動的工作，或動作被擋下時，就停下來，把下一步的指令（現在是 /grill-with-docs）告訴人，然後結束這一輪；由人輸入，不要自己往下做。
- 除了下一步的指令，不要建議其他流程指令。
- 絕不繞過任何阻擋，包括改用 Bash 寫檔或 commit。
```

規格寫好但還沒切卡（進階等級）：

```
# matt-flow 軌道

這個專案照 Matt Pocock 的流程走，由 matt-flow 把關，人輸入每一步的指令。
- 功能「rail」進行中
- 等級：進階
- 目前的步驟：切成任務卡（/to-tickets）
- 現在會被擋的動作：
  - 改程式碼（Edit、Write、NotebookEdit）：由人輸入 /to-tickets 解鎖

規矩：
- 交棒：做完人這次啟動的工作，或動作被擋下時，就停下來，把下一步的指令（現在是 /to-tickets）告訴人，然後結束這一輪；由人輸入，不要自己往下做。
- 除了下一步的指令，不要建議其他流程指令。
- 絕不繞過任何阻擋，包括改用 Bash 寫檔或 commit。
```

動手做中（進階等級）：

```
# matt-flow 軌道

這個專案照 Matt Pocock 的流程走，由 matt-flow 把關，人輸入每一步的指令。
- 功能「rail」進行中
- 等級：進階
- 目前的步驟：複盤（/retro）
- 現在會被擋的動作：
  - git commit：先跑 code-review（Skill 工具，或請人輸入 /code-review）

規矩：
- 交棒：做完人這次啟動的工作，或動作被擋下時，就停下來，把下一步的指令（現在是 /retro）告訴人，然後結束這一輪；由人輸入，不要自己往下做。
- 除了下一步的指令，不要建議其他流程指令。
- 絕不繞過任何阻擋，包括改用 Bash 寫檔或 commit。
```

## Comments

- 2026-10-26（實作後）：0.3.0 在這個 session 重新載入後，引擎回報 `matt-flow: its prompt.compose hook was skipped. "cc-plugin-sec-default" runs first and sent the event on past it.`。跟 `skill.prompt` 一樣，組織的安全 hook 在 `prompt.compose` 上跳過使用者層級的 plugin，所以這段系統提示在這個環境到不了 Claude。補了一條備援：模組還沒被 `prompt.compose` 呼叫到之前，同一段文字以 `prompt.submit` 的 `context` 附在人每次的輸入旁邊；`prompt.compose` 一旦呼叫到，就只走系統提示。`prompt.submit` 在這個環境有沒有也被跳過，要在真實 session 裡輸入一句話確認（看有沒有同樣的提示）。
