# 06: 跳過與子指令

**What to build:** 人永遠有脫離軌道的方法：跳過一個步驟、結束一個功能，或在這個專案整個關掉軌道。人跳步輸入指令時不會被擋，只會收到提醒，被跳過的步驟會如實記錄。

**Blocked by:** 03

**Status:** ready-for-agent

- [x] 只輸入 `/matt-flow` 時，照舊開關面板
- [x] `/matt-flow skip`：目前的步驟記為跳過，回一行訊息說明下一步
- [x] `/matt-flow end`：結束目前的功能，回一行訊息
- [x] `/matt-flow off` 和 `/matt-flow on`：在這個專案關閉或開啟軌道；關掉時，程式碼關卡和 commit 關卡全部安靜
- [x] 人輸入某個步驟的指令，而等級裡更前面的步驟還沒通過時：指令照常執行，跳出提示列出被視為跳過的步驟，並把它們記為跳過
- [x] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出

## 證據

新增的測試先跑（只列和這張卡相關的；其他既有測試全數通過）：

```
(fail) /matt-flow alone still opens and closes the pane; an unknown argument shows the usage
  AssertionError: expect(received).toMatch()
  Expected: /skip.*end.*off.*on/
  Received: "Matt 導航已打開。"
(fail) /matt-flow skip skips the step the flow stands on, and says what is next
  AssertionError: expect(received).toBe()
  Expected: "↷ 跳過「把想法問清楚」→ 下一步 /implement"
  Received: "Matt 導航已打開。"
(fail) /matt-flow end, or skipping the retro, ends the feature
  AssertionError: expect(received).toBe()
  Expected: "沒有進行中的功能 → 下一步 /grill-with-docs"
  Received: "Matt 導航已打開。"
(fail) /matt-flow off quiets the gates and the system prompt in this project; on brings them back
  AssertionError: expect(received).toMatch()
  Expected: /關掉了.*\/matt-flow on/
  Received: "Matt 導航已打開。"
(fail) in a project never set up, the subcommands say why the rail does nothing
  AssertionError: expect(received).toMatch()
  Expected: /還沒設定.*\/setup-matt-pocock-skills/
  Received: "Matt 導航已打開。"
(fail) typing a later step runs it all the same, skipping the steps before it with a toast
  AssertionError: expect(received).toEqual()
  Expected: ["↷ 跳過「把想法問清楚」「寫成規格書」「切成任務卡」 · ✔ 動手做 通過 → 下一步 /retro"]
  Received: ["✔ 動手做 通過 → 下一步 /grill-with-docs"]
 26 pass
 6 fail
```

改完之後：

```
(pass) /matt-flow alone still opens and closes the pane; an unknown argument shows the usage
(pass) /matt-flow skip skips the step the flow stands on, and says what is next
(pass) /matt-flow end, or skipping the retro, ends the feature
(pass) /matt-flow off quiets the gates and the system prompt in this project; on brings them back
(pass) in a project never set up, the subcommands say why the rail does nothing
(pass) typing a later step runs it all the same, skipping the steps before it with a toast
 32 pass
 0 fail
```

每個參數回的一行訊息：

| 指令 | 回覆 |
| --- | --- |
| `/matt-flow skip` | `↷ 跳過「把想法問清楚」→ 下一步 /implement`；跳過複盤時是 `🎉 功能結束，已完成 N 個功能 → 下一個從 /grill-with-docs 開始` |
| `/matt-flow end` | `🎉 功能結束，已完成 N 個功能 → 下一個從 /grill-with-docs 開始`；沒有功能時是 `沒有進行中的功能 → 下一步 /grill-with-docs` |
| `/matt-flow off` | `軌道在這個專案關掉了：不擋程式碼和 commit，也不交棒。輸入 /matt-flow on 再打開` |
| `/matt-flow on` | `軌道打開了 → 下一步 /grill-with-docs` |
| 沒做過 setup 時的 skip、end | `這個專案還沒設定，軌道沒有作用：先輸入 /setup-matt-pocock-skills` |
| 其他參數 | `用法：/matt-flow 打開或關閉面板；/matt-flow skip、end、off、on` |

人跳步輸入 `/implement`（進階、GitHub tracker、還沒有功能）時的提示：`↷ 跳過「把想法問清楚」「寫成規格書」「切成任務卡」 · ✔ 動手做 通過 → 下一步 /retro`。之後真的跑了被跳過的步驟，它會改記為通過。
