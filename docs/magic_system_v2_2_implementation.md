# Magic System v2.2 Implementation

Runtime status:

- `MagicFormulaV2` is the compiled spell structure.
- Runtime compatibility adapters and old active rune catalog files were removed.
- The active ontology maps glyph templates to v2 sigils, keys, circles, and executable effect metadata.
- Source glyphs and connector glyphs are not required by v2 formula grammar.
- The parser detects casting circles, optional containment circles, key scopes, circular channels, and symmetry.
- Key-to-key channels must be circular or orbital; straight key-to-key channels invalidate the formula.
- Statuses, fields, shield bypass, dispel/counter power, and sustained healing are synthesized into combat effects.
- `FormulaGraphV2` replaces the old UI compatibility graph.
- Legacy Codex entries are migrated into v2 storage without inventing missing `FormulaV2` data.

Current v2 pipeline:

```txt
RecognitionStroke[]
-> parseMandalaV2FromStrokes
-> detect circles, sigils, keys, channels
-> compileMagicFormulaV2
-> synthesize name, FormulaGraphV2, visual rank, and effect profile
-> SpellCard + Codex V2 entry / combat result
```

Acceptance checks covered by tests:

- v2 catalog policy disables runtime compatibility.
- source glyphs are not defaulted or required.
- `compileSpellFromStrokes` returns `MagicFormulaV2`.
- Codex entries persist `formulaV2` and `visualHash`.
- legacy Codex entries are imported into `magic-circle-codex-v2`.
- every v2 catalog sigil and key has an active drawable template.
- straight key-to-key channels are rejected.
- soft-excluded curved channels can be recovered when grouped with a component.
- status, field, healing, shield bypass, and dispel profiles are generated from v2 keys/hints.
- symmetry and channel metrics are exposed in `MandalaDebugPanelV2`.
