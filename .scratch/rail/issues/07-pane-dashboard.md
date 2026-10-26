# 07: 面板改成儀表板

**What to build:** 面板不再是遙控器，而是看進度用的儀表板：一眼看出功能走到哪裡、哪些步驟被跳過；目前步驟的卡片上只留「跳過」和「我卡住了」。

**Blocked by:** 06

**Status:** ready-for-agent

- [x] 拿掉「填入指令」和「做完了」兩個按鈕
- [x] 目前步驟的卡片上有「跳過」（效果跟 `/matt-flow skip` 一樣）和「我卡住了」（照舊預填 `/ask-matt`）
- [x] 跳過的步驟和通過的步驟，顯示方式明顯不同
- [x] 保留等級按鈕、context 用量計、已完成的功能數
- [x] 在 terminal、desktop、vscode、mobile 四種介面都畫得出來
- [x] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出，以及測試框架畫出來的面板文字
- [x] 證據截圖（由人截）：真實終端機裡的面板，要看得到至少一個跳過的步驟，以及目前步驟卡片上的兩個按鈕。截圖存放在本功能的 evidence 資料夾（只留在本地），本檔記錄檔名和截到的內容

## 證據

新增的測試先跑（只列和這張卡相關的；其他既有測試全數通過）。「我卡住了」的行為沒變，所以一開始就通過：

```
(pass) a skill the person types moves the guide on
(fail) the pane is a dashboard on every surface: the card offers skip and stuck, nothing that runs or ticks a step
  AssertionError: expect(received).toBeDefined()
  Expected: defined
  Received: undefined
(fail) skip on the pane works like /matt-flow skip, and a skipped step looks unlike a passed one
  HooksError: press: no Button of matt-flow keyed "skip" is drawn in this Pane on the terminal surface
(pass) stuck fills /ask-matt with where the person is
(pass) code unlocks once the person types /implement
(pass) /matt-flow alone still opens and closes the pane; an unknown argument shows the usage
 33 pass
 2 fail
```

改完之後：

```
(pass) a skill the person types moves the guide on
(pass) the pane is a dashboard on every surface: the card offers skip and stuck, nothing that runs or ticks a step
(pass) skip on the pane works like /matt-flow skip, and a skipped step looks unlike a passed one
(pass) stuck fills /ask-matt with where the person is
(pass) code unlocks once the person types /implement
(pass) /matt-flow alone still opens and closes the pane; an unknown argument shows the usage
 35 pass
 0 fail
```

測試框架在 terminal 畫出來的面板（進階等級，GitHub tracker，問清楚之後用 `/matt-flow skip` 跳過「寫成規格書」；`[...]` 是按鈕）。mobile、desktop、vscode 畫出的內容相同，只有 terminal 多一行按鍵提示：

```
✦ Matt 導航
 已完成 0 個功能 
[🌱 新手]
[🚀 進階]
[👑 高手]
大功能，分好幾次對話做完
功能進行中，還沒有規格
████████████
░░░░░░░░░░░░
3 / 6
✔ 1. 設定專案
/setup-matt-pocock-skills
✔ 2. 把想法問清楚
/grill-with-docs
↷ 3. 寫成規格書（跳過）
/to-spec
▶ 4. 切成任務卡
   /to-tickets
把規格切成一張張能獨立完成的任務卡，每張寫明「被哪幾張卡住」。
💡 卡片邊界切清楚，之後同時開工才不會互相改到同一個檔案。
[↷ 跳過]
[? 我卡住了]
○ 5. 動手做
/implement
○ 6. 複盤
/retro
🧠
▮▮▮
▯▯▯▯▯▯▯
50k / 150k
ctrl+x tab 進入面板，按數字鍵就能按按鈕
```

證據截圖（由人截）：`evidence/07-pane.png`（只留在本地）。真實終端機，`~/matt-flow-test`，進階等級。左邊是 `/matt-flow skip` 的回覆 `↷ 跳過「切成任務卡」→ 下一步 /implement`；右邊的面板：`✔ 1. 設定專案`、`✔ 2. 把想法問清楚`、`✔ 3. 寫成規格書`、灰色的 `↷ 4. 切成任務卡（跳過）`，目前步驟卡片 `▶ 5. 動手做 /implement` 上有 `[ ↷ 跳過 ]` 和 `[ ? 我卡住了 ]`，下面是 `○ 6. 複盤`、context 用量 `54k / 150k`、徽章 `已完成 0 個功能`。狀態列是 `✦ 🚀 下一步 /implement · /matt-flow`。

## Comments

- 2026-10-26：證據裡測試框架畫出的「功能進行中，還沒有規格」是當時的輸出。之後改成沒有資料夾名稱的功能一律寫「功能進行中」，因為規格這一步可能已經通過、只是沒有資料夾可以命名（GitHub tracker、0.2 轉過來的進度），舊寫法會跟 ✔ 互相矛盾。
