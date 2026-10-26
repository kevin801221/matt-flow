# 04: commit 關卡

**What to build:** 新手和進階等級，動手做期間還沒跑過 code-review 時，Claude 不能 commit。跑過一次 code-review 之後就放行，之後的修正不用再 review。高手等級完全不擋。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 新手、進階等級：動手做期間、code-review 還沒跑過時，執行 `git commit` 的 Bash 呼叫被擋下，訊息指名 code-review
- [ ] code-review 跑過（不論是人輸入的，或是透過 Skill 工具執行的）之後放行；之後的修正不用再 review 就能 commit
- [ ] 動手做以外的 commit 一律放行
- [ ] 高手等級的 commit 永遠不擋
- [ ] 不含 `git commit` 的 Bash 呼叫不受影響
- [ ] 證據：完成時在本檔底下加「## 證據」，貼上新增測試先失敗、後通過的輸出，以及一張 mermaid 圖（一個 `git commit` 依等級和 code-review 狀態放行或擋下）
