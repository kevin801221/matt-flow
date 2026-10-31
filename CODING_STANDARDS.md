# Coding standards

Read during review. Each rule is a judgement call; validate, the tests and the type check cover the mechanical ones.

- **Glossary terms**: user-facing text (the rail, toasts, denials, the pane, README) and names use GLOSSARY.md's term for a concept, never a word on its _Avoid_ list for that same concept.
- **README follows behaviour**: a change to what the person sees or types updates README.md in the same commit.
- **Comments say why**, in one line, in the surrounding style.
- **Known limits are marked**: a deliberate shortcut with a ceiling gets a `ponytail:` comment naming the ceiling and the way up.
- **Tests go through the engine**: they drive the mod by the testing kit's engine events and stub the engine beneath it; no test reaches into the module.
