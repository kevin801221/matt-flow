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

放在 skills 資料夾裡的 mod，Claude Code 會自動載入。適合想直接修改程式碼的人：

```bash
# 個人層級
git clone https://github.com/kevin801221/matt-flow ~/.claude/skills/matt-flow

# 專案層級（在專案根目錄執行）
git clone https://github.com/kevin801221/matt-flow .claude/skills/matt-flow
```

下載好之後，開一個新的 Claude Code session 就會生效。

## 使用方式

matt-flow 是一條軌道：它記得每個專案走到流程的哪一步，把這件事寫進 Claude 的系統提示，在步驟還沒通過時擋下 Claude 的動作，並在每一步結束時把下一步的指令交給你。指令一律由你輸入，matt-flow 自己不會執行任何步驟。

### 等級

| 等級 | 流程 |
| --- | --- |
| 🌱 新手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/implement` → `/code-review` → `/retro` |
| 🚀 進階 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` → `/retro` |
| 👑 高手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement-spec` → `/pr` → `/retro` |

等級在面板上隨時可以換。第一步一定是 `/setup-matt-pocock-skills`，每個專案只要做一次：它會建立 `docs/agents/issue-tracker.md`，偵測到這個檔案就算通過。**沒做過 setup 的專案，軌道完全安靜**：不擋、不提示，也不改系統提示。

### 功能和通過

- 跑了任何一個流程步驟的 skill（setup 除外），就開始一個**功能**。
- 有產出物的步驟看產出物。用本地 markdown tracker 時，「寫成規格書」要等 `.scratch/<功能>/spec.md` 寫出來，「切成任務卡」要等同一個資料夾的 `issues/` 裡至少有一張卡，只輸入 `/to-spec` 不算；產出物在 Claude 每次回覆完時檢查，規格寫出來後，功能就用它的資料夾名稱稱呼。用 GitHub 或 GitLab tracker 時，skill 跑過就算。
- 「動手做」只在**你**輸入 `/implement`（高手是 `/implement-spec`）時通過。Claude 自己跑 `tdd` 不算，所以它沒辦法自己越過交棒。
- 其他步驟（問清楚、檢查、開 PR、複盤）skill 跑過就算，你輸入的或 Claude 透過 Skill 工具跑的都可以。
- 「複盤」通過，功能就結束：已完成的功能數加一，下一個功能從 `/grill-with-docs` 重新開始。

### 交棒

步驟通過時會跳出提示，Claude 這次回覆完時，下一步的指令會預填在輸入框，按 Enter 就啟動。Claude 的系統提示最後也有一段，寫著目前的功能、等級、步驟、哪些動作會被擋、怎麼解鎖，以及交棒的規矩：做完就停下來把下一步的指令告訴你，不建議其他流程指令，絕不繞過阻擋。如果組織的安全 hook 不讓 mod 改系統提示，同一段會改附在你每次的輸入旁邊。

### 程式碼關卡

在動手做通過之前，Claude 對**程式碼**的 Edit、Write、NotebookEdit 都會被擋下。擋下訊息寫明目前的步驟和解鎖用的指令（沒有進行中的功能時是 `/grill-with-docs`，否則是目前這一步的指令），要 Claude 停下來交棒，同一個指令也會預填進輸入框。

markdown 檔、`docs/`、`.scratch/` 和專案外的檔案不算程式碼，所以思考類的步驟照樣能寫詞彙表、ADR、規格和任務卡。

已知漏洞：Claude 改用 Bash 寫檔不會被程式擋下，只靠擋下訊息和系統提示禁止。

### commit 關卡

新手和進階：每次你輸入 `/implement` 之後，要先跑過一次 code-review（你輸入 `/code-review`，或 Claude 透過 Skill 工具執行，例如 `/implement` 自己跑的那次），Claude 的 `git commit` 才會放行；review 之後的修正不用再 review 一次。被擋下時，`/code-review` 會預填在輸入框。動手做以外的 commit 一律放行，那時候 Claude 改得到的只有文件。高手不擋，`/implement-spec` 最後一步自己會 review。

### 跳過、結束、關掉

| 指令 | 作用 |
| --- | --- |
| `/matt-flow` | 打開或關閉面板 |
| `/matt-flow skip` | 把目前的步驟記為跳過，進到下一步；跳過複盤會結束功能 |
| `/matt-flow end` | 結束目前的功能 |
| `/matt-flow off` | 在這個專案關掉軌道：不擋程式碼和 commit，不交棒，也不改系統提示 |
| `/matt-flow on` | 在這個專案重新打開軌道 |

每個參數都會回一行訊息，說明改了什麼、下一步是什麼。你也可以直接輸入後面步驟的指令：指令照常執行，前面還沒通過的步驟會記為跳過，提示會列出它們。**你輸入的指令永遠不會被擋。**

### 面板

面板是看進度用的儀表板：等級按鈕、目前的功能、每個步驟的狀態（✔ 通過、↷ 跳過）、目前步驟的卡片、對話用掉多少 context，以及已完成的功能數。卡片上有兩個按鈕：`↷ 跳過`（跟 `/matt-flow skip` 一樣）和 `? 我卡住了`（把你的狀況預填成 `/ask-matt`）。在終端機裡要先按 `ctrl+x tab` 進入面板，再按數字鍵。

狀態列會一直顯示下一步的指令，不用打開面板也看得到。

升級前存的進度會延續下來：0.2 版已完成的步驟算通過，做過的輪數算已完成的功能。

## 開發

```bash
claude plugin validate .
claude plugin test .
```
