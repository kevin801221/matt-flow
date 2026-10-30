# ✦ matt-flow：Matt 導航

Claude Code 的 mod。讓 Claude 沿著 [Matt Pocock](https://github.com/mattpocock/skills) 的開發流程走：它知道目前在哪一步，想跳步時會被擋下，每一步結束時把下一步的指令交給你，按 Enter 就繼續。分新手、進階、高手三個等級，旁邊還有一個看進度用的面板。

## ⚠️ 前置條件：先安裝 mattpocock-skills

**matt-flow 只是導航，本身不包含任何 skill。** 面板叫你執行的 `/grill-with-docs`、`/to-spec`、`/implement` 等指令，全部來自 `mattpocock-skills` 這個 plugin。沒有先裝的話，面板還是打得開，但它叫你跑的指令都無法執行。

在**個人層級**或**專案層級**擇一安裝：

```bash
# 個人層級：這台電腦上所有專案都能用（建議）
claude plugin install mattpocock-skills@claude-plugins-official

# 專案層級：只有這個專案能用，在專案根目錄執行
claude plugin install mattpocock-skills@claude-plugins-official --scope project
```

也可以在 Claude Code 的提示列輸入 `/plugin install mattpocock-skills@claude-plugins-official`，再選範圍。

`mattpocock-skills` 收錄在 Anthropic 官方的 marketplace（`anthropics/claude-plugins-official`）。安裝時如果出現找不到 marketplace 的錯誤，先加入這個 marketplace，再重新安裝：

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

安裝時會自動把檔案下載到 `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/<版本>/`，啟用設定則寫進 settings：個人層級寫在 `~/.claude/settings.json`，專案層級寫在專案的 `.claude/settings.json`。**不要自己把檔案複製進 `cache` 資料夾**，沒有經過安裝登記的 plugin 不會被啟用。

確認是否裝好：

```bash
claude plugin list
```

看到下面這樣就代表可以用了：

```
❯ mattpocock-skills@claude-plugins-official
  Version: 1.3.1
  Scope: user
  Status: ✔ enabled
```

## 安裝 matt-flow

下面兩種方法擇一就好。兩種都裝的話，mod 會被載入兩次。

### 方法一：用 plugin 指令安裝（建議）

在 Claude Code 的提示列輸入：

```
/plugin install matt-flow --marketplace kevin801221/matt-flow
```

出現 `Add marketplace?` 時按 `y`，接著選安裝範圍（預設是個人層級，直接按 Enter）。

從 shell 安裝：

```bash
claude plugin install matt-flow --marketplace kevin801221/matt-flow
```

桌面版 App 不能用 `/plugin`：點提示框旁邊的 + → Plugins → Add marketplace，輸入 `kevin801221/matt-flow`，再按 Add plugin。

### 方法二：下載到 skills 資料夾

放在 skills 資料夾裡的 mod，Claude Code 會自動載入，而且一存檔就套用到所有開著的 session。所以這個資料夾只拿來安裝，不要在裡面改程式碼（要改的話見最後的「開發」）：

```bash
# 個人層級
git clone https://github.com/kevin801221/matt-flow ~/.claude/skills/matt-flow

# 專案層級（在專案根目錄執行）
git clone https://github.com/kevin801221/matt-flow .claude/skills/matt-flow
```

下載好之後，開一個新的 Claude Code session 就會生效。

## 使用方式

matt-flow 是一條軌道：它記得每個專案走到流程的哪一步，把這件事附在你的輸入旁邊告訴 Claude，在步驟還沒通過時擋下 Claude 的動作，並在每一步結束時把下一步的指令交給你。指令一律由你輸入，matt-flow 自己不會執行任何步驟。

### 等級

| 等級 | 流程 |
| --- | --- |
| 🌱 新手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/implement` → `/code-review` → `/retro` |
| 🚀 進階 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` → `/retro` |
| 👑 高手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement-spec` → `/pr` → `/retro` |

等級在面板上隨時可以換。第一步一定是 `/setup-matt-pocock-skills`，每個專案只要做一次：它會建立 `docs/agents/issue-tracker.md`，偵測到這個檔案就算通過。**沒做過 setup 的專案，軌道完全安靜**：不擋、不提示，也不附流程說明。

在專案的子資料夾開 session，算同一個專案：從那裡往上找，最近一個有 `docs/agents/issue-tracker.md` 的資料夾就是專案。每個 linked worktree 有自己的 checkout，各算一個專案，所以想同時做兩個功能，就開一個 worktree。

### 功能和通過

- **你**輸入任何一個流程步驟的指令（setup 除外），就開始一個**功能**。Claude 透過 Skill 工具跑的 skill 不會開始功能，例如 `/triage` 背後跑的 grilling。
- 有產出物的步驟看產出物。用本地 markdown tracker 時，「寫成規格書」要等 `.scratch/<功能>/spec.md` 寫出來，「切成任務卡」要等同一個資料夾的 `issues/` 裡至少有一張卡，只輸入 `/to-spec` 不算；產出物在 Claude 每次回覆完時檢查，規格寫出來後，功能就用它的資料夾名稱稱呼。用 GitHub 或 GitLab tracker 時，skill 跑過就算。
- 「動手做」只在**你**輸入 `/implement`（高手是 `/implement-spec`）時通過。Claude 自己跑 `tdd` 不算，所以它沒辦法自己越過交棒。
- 其他步驟（問清楚、檢查、開 PR、複盤）skill 跑過就算：你輸入的，或功能進行中 Claude 在主線透過 Skill 工具跑的都可以。分身（subagent）跑的不算。
- 「複盤」通過，功能就結束，已完成的功能數加一。接著是**收尾**：程式碼保持解鎖，讓你落實複盤建議的環境修改，直到你輸入 `/matt-flow end` 或開始下一個功能。下一個功能從 `/grill-with-docs` 開始。

### 交棒

步驟通過時會跳出提示，Claude 這次回覆完時，下一步的指令會預填在輸入框，按 Enter 就啟動。

- 要來回好幾個回合的步驟（問清楚、切成任務卡、並行開發）一開始就算通過，但要等做完才交棒：提示寫明怎樣算做完（問題問完、任務卡切好、分身都合併）和之後的指令，不預填。
- 進階等級每做完一張任務卡，提示會同時列出兩條路：還有卡就 `/clear` 後 `/implement` 下一張，都做好了再 `/retro`。

流程說明附在你的輸入旁邊給 Claude，寫著目前的功能、等級、下一步、哪些動作會被擋、怎麼解鎖、還能做什麼，以及交棒的規矩：你啟動的 skill 整個做完才停下來，把下一步的指令告訴你；除了下一步的指令和 `/matt-flow`，不主動建議流程指令，你輸入 `/ask-matt` 時照常回答；絕不繞過阻擋。說明只在內容變了、或對話壓縮、清除之後才重送，不會每次輸入都附一份。

### 程式碼關卡

在動手做通過之前，Claude 對**程式碼**的 Edit、Write、NotebookEdit 都會被擋下。擋下訊息寫明下一步和解鎖用的指令（沒有進行中的功能時是 `/grill-with-docs`，否則是下一步的指令），要 Claude 停下來交棒，同一個指令也會預填進輸入框。

markdown 檔、`docs/`、`.scratch/` 和專案外的檔案不算程式碼，所以思考類的步驟照樣能寫詞彙表、ADR、規格和任務卡。

關卡自己出錯時（例如部署壞了），照樣擋程式碼和 `git commit`，其他動作不受影響，擋下訊息會說怎麼退回上一版。

已知漏洞：Claude 改用 Bash 寫檔不會被程式擋下，只靠擋下訊息和軌道禁止。

### commit 關卡

新手和進階：每次你輸入 `/implement` 之後，要先跑過一次 code-review（你輸入 `/code-review`，或 Claude 透過 Skill 工具執行，例如 `/implement` 自己跑的那次），Claude 的 `git commit` 才會放行；review 之後的修正不用再 review 一次。被擋下時，`/code-review` 會預填在輸入框。動手做以外的 commit 一律放行，那時候 Claude 改得到的只有文件。高手不擋，`/implement-spec` 最後一步自己會 review。在新手或進階等級輸入 `/implement-spec` 時，它的分身（subagent）可以 commit 自己的任務卡，主線照樣要先 review。

### 跳過、結束、關掉

| 指令 | 作用 |
| --- | --- |
| `/matt-flow` | 打開或關閉面板 |
| `/matt-flow skip` | 把下一步記為跳過，流程往後走一步；跳過複盤會結束功能 |
| `/matt-flow end` | 結束目前的功能，或結束複盤後的收尾 |
| `/matt-flow off` | 在這個專案關掉軌道：不擋程式碼和 commit，不交棒，也不附流程說明 |
| `/matt-flow on` | 在這個專案重新打開軌道 |

每個參數都會回一行訊息，說明改了什麼、下一步是什麼。你也可以直接輸入後面步驟的指令：指令照常執行，前面還沒通過的步驟會記為跳過，提示會列出它們。例外是動手做之前輸入 `/code-review`、`/pr`、`/retro`：skill 照樣執行，但流程不動，不會跳過動手做；想在動手做之前結束功能，用 `/matt-flow end`。**你輸入的指令永遠不會被擋。**

動手做途中換等級時，新等級裡到它的動手做為止還沒通過的步驟都記為跳過，流程從動手做之後接著走。

### 面板

面板用來看進度：等級按鈕、目前的功能、每個步驟的狀態（✔ 通過、↷ 跳過）、目前步驟的卡片、對話用掉多少 context，以及已完成的功能數。卡片上有兩個按鈕：`↷ 跳過`（跟 `/matt-flow skip` 一樣）和 `? 我卡住了`（把 `/ask-matt` 和你的狀況插進輸入框，你打到一半的字會留著）。在終端機裡要先按 `ctrl+x tab` 進入面板，再按數字鍵。

狀態列會一直顯示下一步的指令，不用打開面板也看得到。

升級前存的進度會延續下來：0.2 版已完成的步驟算通過，做過的輪數算已完成的功能。

## 開發

skills 資料夾那份只拿來安裝。開發在另一個 clone 裡做，驗證過再部署：

```bash
git clone https://github.com/kevin801221/matt-flow ~/matt-flow
cd ~/matt-flow
claude plugin validate .
claude plugin test .
```

部署：先 push，再讓 skills 資料夾從 GitHub 拉新版，所有開著的 session 會立刻換成新版。先 push 是為了讓 GitHub 上一直有一份備份，不會只剩你電腦上那一份。部署前也可以先備份進度紀錄，也就是 `~/.claude/plugins/store/` 底下 `matt-flow_` 開頭的 JSON 檔。

```bash
git -C ~/matt-flow push origin main
git -C ~/.claude/skills/matt-flow pull --ff-only
```

部署壞了就退回上一版：

```bash
git -C ~/.claude/skills/matt-flow reset --hard 'HEAD@{1}'
```
