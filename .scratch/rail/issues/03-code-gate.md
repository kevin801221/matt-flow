# 03: 程式碼關卡

**What to build:** 還沒動手做之前，Claude 想改程式碼會被擋下。擋下訊息告訴 Claude 要停下來交棒，並寫明解鎖要用的指令；同一個指令會預填給人，按 Enter 就能繼續。

**Blocked by:** 02

**Status:** ready-for-agent

- [x] 專案做過 setup、軌道開著，而且進行中的功能還沒動手做時，Claude 對程式碼的 Edit、Write、NotebookEdit 會被擋下
- [x] 沒有進行中的功能時，擋下訊息指名 `/grill-with-docs`；有功能時，指名通往動手做的路上，下一個還沒通過的步驟的指令
- [x] 擋下訊息要求 Claude 停下來交棒，並且不准改用 Bash 寫檔
- [x] 擋下時，訊息裡的解鎖指令同時預填進人的輸入框
- [x] markdown 檔、暫存資料夾、docs 資料夾，以及專案外的檔案，一律不擋
- [x] 人輸入 `/implement` 之後放行
- [x] 沒做過 setup 的專案完全不擋
- [x] Matt skills repo 裡的 em dash 防護照舊
- [x] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出，以及一張 mermaid 流程圖（一個 Edit 從進來到放行或擋下）
- [ ] 證據截圖（由人截）：在一個做過 setup、沒有進行中功能的測試專案裡，請 Claude 改一個程式檔。截圖要看得到擋下訊息（含解鎖指令），以及輸入框裡預填的指令。截圖存放在本功能的 evidence 資料夾（只留在本地），本檔記錄檔名和截到的內容

## 證據

新增的測試先跑（只列和這張卡相關的；其他既有測試全數通過）。「markdown、docs…」和「沒做過 setup…」兩個測試在沒有關卡時本來就會放行，所以一開始就通過：

```
(fail) with no feature under way, code is locked: the denial names /grill-with-docs, and offers it
  Expected: /把想法問清楚/
  Received: undefined
(fail) during a feature, the denial names the next step on the way to building
  Expected: /\/to-spec/
  Received: undefined
(fail) code unlocks once the person types /implement
  Expected: /\/implement/
  Received: undefined
(pass) markdown, docs, the tracker folder and files outside the project are never locked
(pass) a project never set up locks nothing
(pass) an em-dash is denied inside the skills repo only
 15 pass
 3 fail
```

改完之後：

```
(pass) with no feature under way, code is locked: the denial names /grill-with-docs, and offers it
(pass) code unlocks once the person types /implement
(pass) markdown, docs, the tracker folder and files outside the project are never locked
(pass) a project never set up locks nothing
(pass) an em-dash is denied inside the skills repo only
 18 pass
 0 fail
```

擋下訊息（沒有進行中的功能時）：

```
matt-flow：還沒到動手做，程式碼鎖著。目前的步驟是「把想法問清楚」，解鎖要由人輸入 /grill-with-docs（已預填在輸入框）。停下來交棒：把這個指令告訴人，然後結束這一輪。不要改用 Bash 或其他方式寫這個檔案。
```

一個 Edit（Write、NotebookEdit 相同）從進來到放行或擋下：

```mermaid
flowchart TD
  A[Claude 呼叫 Edit / Write / NotebookEdit] --> B{檔案在專案裡？}
  B -- 否 --> OK[放行]
  B -- 是 --> C{markdown，或在 .scratch/、docs/ 底下？}
  C -- 是 --> OK
  C -- 否 --> D{動手做已通過或跳過？}
  D -- 是 --> OK
  D -- 否 --> E{做過 setup，而且軌道開著？}
  E -- 否 --> OK
  E -- 是 --> F{有進行中的功能？}
  F -- 否 --> G[解鎖指令 /grill-with-docs]
  F -- 是 --> H[解鎖指令：目前步驟的指令]
  G --> X[擋下：訊息寫明步驟和指令，要求停下來交棒、不准用 Bash 寫檔；這一輪結束時預填指令]
  H --> X
  OK --> M{Mattpocock skills repo 裡，而且內容有 em dash？}
  M -- 是 --> Y[擋下：em dash 防護]
  M -- 否 --> Z[執行]
```

證據截圖（由人截）：還沒截。需要在一個做過 setup、沒有進行中功能的測試專案裡請 Claude 改程式檔，截下擋下訊息和輸入框裡預填的 `/grill-with-docs`，存到 `.scratch/rail/evidence/`，再把檔名記在這裡。
