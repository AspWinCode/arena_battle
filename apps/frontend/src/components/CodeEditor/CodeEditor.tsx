import Editor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'

interface Props {
  value: string
  language: string
  onChange?: (value: string | undefined) => void
  readOnly?: boolean
  height?: string
}

const GAME_API_JS_SNIPPETS = [
  { label: 'attack',       insertText: "attack('${1|jab,hook,uppercut,sweep|}')", detail: 'Basic attack' },
  { label: 'laser',        insertText: 'laser(${1:80})',                           detail: 'Laser beam, cooldown 3' },
  { label: 'shield',       insertText: 'shield(${1:1})',                           detail: 'Raise shield, cooldown 2' },
  { label: 'dodge',        insertText: "dodge('${1|left,right,back,roll|}')",      detail: 'Dodge, 50% miss rate' },
  { label: 'combo',        insertText: 'combo()',                                  detail: 'Combo attack, cooldown 4' },
  { label: 'repair',       insertText: 'repair(${1:20})',                          detail: '+20 HP, cooldown 3' },
  { label: 'moveForward',  insertText: 'moveForward(${1:1})',                      detail: 'Move closer' },
  { label: 'moveBackward', insertText: 'moveBackward(${1:1})',                     detail: 'Move back' },
  { label: 'enemy.hp',          insertText: 'enemy.hp',           detail: 'Enemy current HP' },
  { label: 'enemy.lastAction',  insertText: 'enemy.lastAction',   detail: 'Enemy last action string' },
  { label: 'enemy.shieldActive',insertText: 'enemy.shieldActive', detail: 'Enemy shield bool' },
  { label: 'enemy.cooldowns',   insertText: 'enemy.cooldowns',    detail: 'Enemy cooldowns object' },
]

function setupMonaco(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      }
      return {
        suggestions: GAME_API_JS_SNIPPETS.map(s => ({
          label: s.label,
          kind:  monaco.languages.CompletionItemKind.Function,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.detail,
          documentation: `Game API: ${s.label}`,
          range,
        })),
      }
    },
  })

  // Custom dark theme
  monaco.editor.defineTheme('robocode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',   foreground: '6a7f8a', fontStyle: 'italic' },
      { token: 'string',    foreground: 'a5f3c4' },
      { token: 'keyword',   foreground: '00e5ff', fontStyle: 'bold' },
      { token: 'function',  foreground: '7dd3fc' },
      { token: 'number',    foreground: 'fbbf24' },
      { token: 'operator',  foreground: 'e2e8f0' },
      { token: 'type',      foreground: 'c084fc' },
    ],
    colors: {
      'editor.background':           '#0d0d1f',
      'editor.foreground':           '#e2e8f0',
      'editor.lineHighlightBackground': '#1a1a35',
      'editorCursor.foreground':     '#00e5ff',
      'editor.selectionBackground':  '#2a2a60',
      'editorGutter.background':     '#0a0a1a',
      'editorLineNumber.foreground': '#3a3a60',
      'editorLineNumber.activeForeground': '#00e5ff',
      'scrollbarSlider.background':  '#2a2a50',
    },
  })
}

export default function CodeEditor({ value, language, onChange, readOnly, height = '100%' }: Props) {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="robocode-dark"
      beforeMount={setupMonaco}
      onChange={onChange}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        readOnly: readOnly ?? false,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'line',
        bracketPairColorization: { enabled: true },
        suggest: { showKeywords: true, showSnippets: true },
        quickSuggestions: { other: true, comments: false, strings: false },
      }}
    />
  )
}
