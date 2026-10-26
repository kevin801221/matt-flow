# 01: 整理狀態結構

**What to build:** 把每個專案的狀態換成新的結構，替後面的關卡鋪路。除了面板上的用詞，外部行為完全不變。已經在工作目錄裡的偵測修正（人輸入的指令、Skill 工具）也在這張卡一起 commit。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 每個專案的狀態記錄：等級；每個步驟的狀態（未通過 / 通過 / 跳過）；是否有進行中的功能，以及它的名稱；動手做是否已開始；動手做開始後是否跑過 code-review；軌道是否關閉；已完成的功能數
- [x] 舊版存的進度（已完成步驟的清單、輪數）載入後，轉成已通過的步驟和已完成的功能數，不遺失任何資料
- [x] 面板上的「第 N 輪」改成顯示功能數，用詞依照 GLOSSARY
- [x] 測試的假引擎可以讓每個測試各自指定哪些檔案存在、某個資料夾列出什麼
- [x] 既有測試全部通過，並新增一個測試：舊版進度能正確載入
- [x] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出

## 證據

狀態改成一個 `progress` atom（`types/index.d.ts` 的 `Progress`）：`level`、`steps`（每個步驟 `passed` / `skipped`，沒有就是未通過）、`feature`（`{ name, since }` 或 `null`）、`isReviewed`、`isOff`、`features`。「動手做是否已開始」不另存，由 `steps` 裡動手做的步驟是否通過或跳過推出來。

新增測試 `progress saved by 0.2 carries over: its steps passed, its rounds finished features`，先對 0.2 的模組跑（只修了 setup 檔的路徑，讓假檔案系統找得到）：

```
(fail) progress saved by 0.2 carries over: its steps passed, its rounds finished features [15.31ms]
  AssertionError: expect(received).toBeDefined()

  Expected: defined
  Received: undefined
(fail) a finished round offers the next one [14.34ms]
  AssertionError: expect(received).toBeDefined()

  Expected: defined
  Received: undefined

 5 pass
 2 fail
```

改完之後：

```
(pass) a set-up project starts the beginner at grilling, on every surface
(pass) progress saved by 0.2 carries over: its steps passed, its rounds finished features
(pass) a skill run moves the guide on, and the button types the next command
(pass) a skill the model runs through the Skill tool moves the guide on too
(pass) the expert track builds in parallel
(pass) a finished round offers the next one
(pass) an em-dash is denied inside the skills repo only

 7 pass
 0 fail
```
