# ✦ matt-flow：Matt 導航

Claude Code 的 mod。會在對話旁邊開一個面板，一步一步帶你走 [Matt Pocock](https://github.com/mattpocock/skills) 的開發流程，分新手、進階、高手三個等級。

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

1. 在專案裡輸入 `/matt-flow`，打開導航面板，再輸入一次就會關閉。
2. 選擇等級：

   | 等級 | 流程 |
   | --- | --- |
   | 🌱 新手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/implement` → `/code-review` → `/retro` |
   | 🚀 進階 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` → `/retro` |
   | 👑 高手 | `/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement-spec` → `/pr` → `/retro` |

3. 第一步一定是 `/setup-matt-pocock-skills`，每個專案只要做一次。它會建立 `docs/agents/issue-tracker.md`，面板偵測到這個檔案就會自動把這步打勾。
4. 目前這一步的卡片有三個按鈕：`⏎ 填入指令`、`✓ 做完了`、`? 我卡住了`（會帶你到 `/ask-matt` 問問題）。在終端機裡要先按 `ctrl+x tab` 進入面板，再按數字鍵。

跑完某個 skill 時，面板會自動打勾、跳出提示，並把下一步的指令預先填進輸入框。狀態列會一直顯示下一步要做什麼，面板底部也會顯示對話用掉多少 context。

## 開發

```bash
claude plugin validate .
claude plugin test .
```
