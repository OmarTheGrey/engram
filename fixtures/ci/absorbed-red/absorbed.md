# Absorbed work (red fixture)

The red register of card E0.6: the clean rows (the first, and the data, either-licence and convention-spelling rows) pass, and every other row breaks one rule of ADR 0037, including the indented row and the row after the blank line, so `scripts/check-absorbed.ts` must report each. Its NOTICE is the file beside it. The landed paths are resolved against the repository root.

| source | commit | licence | mode | what was taken | where it landed | card |
|---|---|---|---|---|---|---|
| example-org/good-copy, `src/a.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT (LICENSE read at the commit) | copy | a clean copy, with its notice; a pipe written \|A\| is escaped | `scripts/check-absorbed.ts` | E0.6 |
| example-org/missing-file, `src/b.ts` | 0123456789abcdef0123456789abcdef01234567 | Apache-2.0 | port | a port whose landed file does not exist | `scripts/no-such-file.ts`, tests in `scripts/test/check-absorbed.test.ts` | E0.6 |
| example-org/gpl-source, `src/c.ts` | 0123456789abcdef0123456789abcdef01234567 | GPL-3.0 | port | a port from a licence that is idea only | `scripts/check-absorbed.ts` | E0.6 |
| example-org/no-notice, `src/d.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | copy | a copy with no NOTICE entry | `scripts/check-absorbed.ts` | E0.6 |
| example-org/notice-elsewhere, `src/e.ts` | 0123456789abcdef0123456789abcdef01234567 | BSD-3-Clause | copy | a copy whose source NOTICE names, but in an entry for another file | `scripts/check-prose.ts` | E0.6 |
| example-org/short-commit, `src/f.ts` | 0123abc | ISC | port | a port whose commit is not a full hash | `scripts/check-absorbed.ts` | E0.6 |
| example-org/cc-by-code, `src/g.ts` | 0123456789abcdef0123456789abcdef01234567 | CC-BY-4.0 | port | code under a licence allowed for data only | `scripts/check-absorbed.ts` | E0.6 |
| example-org/idea-mode, `src/h.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | idea | a mode the register does not hold | `scripts/check-absorbed.ts` | E0.6 |
| example-org/no-path, `src/i.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | port | a row that names no landed path | somewhere in core | E0.6 |
| example-org/broken-row, `src/j.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | port | an unescaped pipe min(2, |A|, |B|) splits the row | `scripts/check-absorbed.ts` | E0.6 |
| example-org/cc-by-data, `data/k.json` | 0123456789abcdef0123456789abcdef01234567 | CC-BY-4.0 (LICENSE read at the commit) | copy (data) | data under a licence allowed for data, with its notice | `fixtures/ci/absorbed-red/absorbed.md` | E0.6 |
| example-org/and-gpl, `src/l.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT AND GPL-3.0 | port | a compound licence with a part that is idea only | `scripts/check-absorbed.ts` | E0.6 |
| example-org/either, `src/m.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT OR Apache-2.0 | port | a choice between two allowed licences | `scripts/check-absorbed.ts` | E0.6 |
| example-org/unlicensed, `src/n.ts` | 0123456789abcdef0123456789abcdef01234567 | The Unlicense (read at the commit) | port | the convention's spelling of the Unlicense | `scripts/check-absorbed.ts` | E0.6 |
| example-org/public-domain, `src/o.ts` | 0123456789abcdef0123456789abcdef01234567 | CC0 | port | the convention's spelling of CC0 | `scripts/check-absorbed.ts` | E0.6 |
| example-org/good, `src/p.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | copy | a copy whose repository is only a prefix of one NOTICE names | `scripts/check-absorbed.ts` | E0.6 |
  | example-org/indented, `src/q.ts` | 0123456789abcdef0123456789abcdef01234567 | GPL-2.0 | port | an indented row, still in the table | `scripts/check-absorbed.ts` | E0.6 |

| example-org/after-blank, `src/r.ts` | 0123456789abcdef0123456789abcdef01234567 | MIT | port | a row the blank line put outside the table | `scripts/check-absorbed.ts` | E0.6 |
