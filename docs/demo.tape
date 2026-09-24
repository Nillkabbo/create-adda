# Demo GIF for the README and the launch post: install, a Banglish reply, an English commit.
# Regenerate after a rule change with: vhs docs/demo.tape
# Needs vhs, a logged-in `claude`, and a git identity. It spends a few real Claude Code tokens.
# Waits run hidden, so the GIF shows each command and then its result without the model's latency.

Output docs/demo.gif

Set Shell bash
Set FontSize 18
Set Width 1200
Set Height 680
Set Padding 24
Set TypingSpeed 35ms
Set Theme "Catppuccin Mocha"

# A throwaway repo with one bug in it.
Hide
Type `export PS1='$ ' && cd "$(mktemp -d)" && git init -q` Enter
Type `printf 'export const total = (items) => items.reduce((sum, item) => sum + item.price);\n' > cart.js` Enter
Type "git add cart.js && git commit -qm 'Add cart total' && clear" Enter
Sleep 1s
Show

Type "npx create-adda --target claude --yes"
Sleep 500ms
Enter
Hide
Wait+Screen@120s /Done\./
Show
Sleep 2s

Type `claude -p "total() in cart.js returns '[object Object]20' instead of 30. Fix it and commit." --allowedTools "Edit,Bash(git add:*),Bash(git commit:*)"`
Sleep 500ms
Enter
Hide
Wait+Line@300s /^\$$/
Show
Sleep 6s

Type "git log --oneline -1"
Sleep 500ms
Enter
Sleep 4s
