// Forms generated from the registry (card E8.15b, docs/design/tui.md 9.4):
// one control per positional and flag of a command's entry, in its order,
// advanced ones folded and the workspace's flags in their own fold, filled
// from the workspace. A form builds the argument vector the plain command
// would get, which the command row shows and `run` runs. It validates only
// what the CLI validates, with the CLI's own functions and messages: the
// command's parse and its `prepare` (./commands.ts), and for a command that
// is not a plane call, the CLI's checkTime and checkNumber. What the CLI
// does not check, the form does not check; the plane's answer is the answer.

import type { CommandSpec, Control, OptionSpec, Values } from "../registry.ts";
import type { Io } from "../run.ts";
import { ACTOR_FLAGS } from "./actor.ts";
import { TextField } from "./fields.ts";
import { checkArgv } from "./validate.ts";
import { isWsFlag, type Workspace } from "./workspace.ts";

/** A form control: a positional or a flag. */
export interface Field {
  /** `pos:<name>` for a positional, else the flag's name. */
  id: string;
  /** The flag (without --) or the positional's name. */
  name: string;
  positional: boolean;
  label: string;
  help: string;
  control: Control;
  defaultText?: string;
  advanced: boolean;
  /** A workspace flag: filled from the workspace and folded with the others. */
  workspace: boolean;
  /** Repeatable: a list of values. */
  multiple: boolean;
  /** A boolean flag: a toggle. */
  boolean: boolean;
  /** The choices a radio cycles through; absent for a text control. */
  choices?: readonly string[];
  required: boolean;
  card?: string;
}

/** A choice that may also take a path (a preset or a policy file) is typed, with the choices as a hint. */
const typedChoice = (o: OptionSpec) => o.control === "choice" && /\bfile\b/.test(o.help);

/** The flags a form never offers: the TUI itself refuses --json (docs/design/tui.md 5.2); J shows it. */
const NOT_IN_FORMS = new Set(["json"]);

/** The fields of a command's form, in its entry's order. */
export function formFields(spec: CommandSpec): Field[] {
  const fields: Field[] = spec.positionals.map((p) => ({
    id: `pos:${p.name}`,
    name: p.name,
    positional: true,
    label: p.label,
    help: p.variadic ? "words joined by spaces" : p.required ? "required" : "optional",
    control: p.picker === "file" ? "file" : "text",
    advanced: false,
    workspace: false,
    multiple: false,
    boolean: false,
    required: p.required,
  }));
  for (const [name, o] of Object.entries(spec.options)) {
    if (NOT_IN_FORMS.has(name)) continue;
    const field: Field = {
      id: name,
      name,
      positional: false,
      label: o.label,
      help: o.help,
      control: o.control,
      advanced: o.advanced === true,
      workspace: isWsFlag(name),
      multiple: o.multiple === true,
      boolean: o.type === "boolean",
      required: false,
    };
    if (o.defaultText !== undefined) field.defaultText = o.defaultText;
    if (o.card !== undefined) field.card = o.card;
    if (o.control === "choice" && o.choices && !typedChoice(o)) field.choices = o.choices;
    fields.push(field);
  }
  return fields;
}

/** The value a field holds. */
export type FieldValue = string | boolean | readonly string[];

export interface FormError {
  /** The field the message names, if one. */
  field?: string;
  /** The CLI's message, without its `engram <command>: ` prefix. */
  message: string;
}

/** A form's state: one value per field, and a text editor per text field. */
export class Form {
  readonly spec: CommandSpec;
  readonly fields: Field[];
  readonly values = new Map<string, FieldValue>();
  /** The editors of text fields and of the new entry of a list. */
  readonly editors = new Map<string, TextField>();
  /** The field ids the person changed, so leaving asks first. */
  readonly touched = new Set<string>();
  /** The workspace fields a command line gave the form: with the touched ones, they win over the workspace. */
  private readonly given = new Set<string>();

  constructor(
    spec: CommandSpec,
    ws: Workspace,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    this.spec = spec;
    this.fields = formFields(spec);
    for (const f of this.fields) {
      if (f.boolean) this.values.set(f.id, false);
      else if (f.multiple) this.values.set(f.id, f.workspace ? [...ws.list(f.name as never)] : []);
      else if (f.choices) this.values.set(f.id, f.workspace ? (ws.get(f.name as never) ?? "") : "");
      else
        this.editors.set(f.id, new TextField(f.workspace ? (ws.get(f.name as never) ?? "") : ""));
      if (f.multiple) this.editors.set(f.id, new TextField(""));
    }
    this.fill(values, positionals);
  }

  /** Fills fields from parsed flags and positionals (a pasted command line). */
  fill(values: Values, positionals: readonly string[]): void {
    const pos = this.fields.filter((f) => f.positional);
    const flagWord = this.nameFlag();
    // read --item <id>: the name's flag carries the first positional.
    const fromName = flagWord === undefined ? undefined : values[flagWord];
    const given = typeof fromName === "string" ? [fromName, ...positionals] : [...positionals];
    pos.forEach((f, i) => {
      const words = f === pos.at(-1) ? given.slice(i) : given.slice(i, i + 1);
      if (words.length > 0) this.setValue(f.id, words.join(" "));
    });
    for (const [k, v] of Object.entries(values)) {
      if (k === flagWord || v === undefined) continue;
      const f = this.fields.find((x) => !x.positional && x.name === k);
      if (f === undefined) continue;
      this.setValue(f.id, v as FieldValue);
      if (f.workspace) this.given.add(f.id);
    }
  }

  get(id: string): FieldValue {
    const editor = this.editors.get(id);
    const f = this.field(id);
    if (editor !== undefined && f !== undefined && !f.multiple) return editor.value;
    return this.values.get(id) ?? "";
  }

  setValue(id: string, v: FieldValue): void {
    const f = this.field(id);
    if (f === undefined) return;
    if (f.multiple) this.values.set(id, Array.isArray(v) ? [...v] : v === "" ? [] : [String(v)]);
    else if (f.boolean) this.values.set(id, v === true);
    else if (f.choices) this.values.set(id, String(v));
    else this.editors.get(id)?.set(String(v));
  }

  field(id: string): Field | undefined {
    return this.fields.find((f) => f.id === id);
  }

  /** The flag in the command's name (read --item), whose value is the first positional. */
  private nameFlag(): string | undefined {
    return this.spec.name
      .split(" ")
      .find((w) => w.startsWith("--"))
      ?.slice(2);
  }

  /** The values as the command's parse would give them, for `writes` and the command line. */
  flagValues(): Record<string, string | boolean | readonly string[]> {
    const out: Record<string, string | boolean | readonly string[]> = {};
    for (const f of this.fields) {
      if (f.positional) continue;
      const v = this.get(f.id);
      if (v === "" || v === false || (Array.isArray(v) && v.length === 0)) continue;
      out[f.name] = v;
    }
    return out;
  }

  /**
   * Whether the --at field is offered: on a read and on why not this item
   * (card E2.17), where it is the time validity windows are judged at, else
   * only with the test clock on (docs/design/tui.md 3.2).
   */
  offersAt(): boolean {
    return (
      this.spec.name.startsWith("read") ||
      this.spec.name === "explain --absent" ||
      this.get("test-clock") === true
    );
  }

  /**
   * The argument vector: the command's words, its positionals, its own
   * flags, then the workspace's flags it takes (none of the in-process
   * workspace's when it calls a server, as connect refuses them).
   */
  argv(ws: Workspace): string[] {
    this.syncWorkspace(ws);
    const words = this.spec.name.split(" ");
    const out = words.filter((w) => !w.startsWith("--"));
    const nameFlag = this.nameFlag();
    const positionals = this.fields.filter((f) => f.positional);
    positionals.forEach((f, i) => {
      const v = String(this.get(f.id));
      if (v === "") return;
      if (i === 0 && nameFlag !== undefined) out.push(`--${nameFlag}`, v);
      else out.push(v);
    });
    const local = ws.clone();
    for (const f of this.fields)
      if (f.workspace) local.set(f.name as never, this.get(f.id) as never);
    for (const f of this.fields) {
      if (f.positional || f.workspace) continue;
      if (f.name === "at" && !this.offersAt()) continue;
      const v = this.get(f.id);
      if (v === true) out.push(`--${f.name}`);
      else if (Array.isArray(v)) for (const one of v) out.push(`--${f.name}`, one);
      else if (typeof v === "string" && v !== "") out.push(`--${f.name}`, v);
    }
    out.push(...local.argsFor(this.spec));
    return out;
  }

  /**
   * The workspace's flags as the workspace has them now, in every workspace
   * field the person did not change and no command line gave (card E8.15c
   * review, finding 2): after a change of actor the form runs as the actor
   * now, not as the one it was opened under.
   */
  syncWorkspace(ws: Workspace): void {
    for (const f of this.fields) {
      if (!f.workspace || this.touched.has(f.id) || this.given.has(f.id)) continue;
      const now = f.multiple ? [...ws.list(f.name as never)] : (ws.get(f.name as never) ?? "");
      const was = this.get(f.id);
      if (JSON.stringify(was) !== JSON.stringify(now)) this.setValue(f.id, now as FieldValue);
    }
  }

  /**
   * The CLI's own checks over the argument vector, without the call: the
   * command's parse, then for a plane command its prepare (and the actor it
   * builds), else the time and number checks of its time and number flags.
   */
  validate(ws: Workspace, given: Io): FormError[] {
    const message = checkArgv(this.spec, this.argv(ws), given);
    return message === undefined ? [] : [this.place(message)];
  }

  /** The field a CLI message names: the first --flag in it that is one of the form's. */
  place(message: string): FormError {
    const nameFlag = this.nameFlag();
    for (const m of message.matchAll(/--([a-z][a-z-]*)/g)) {
      const flag = m[1] as string;
      if (flag === nameFlag) {
        const first = this.fields.find((f) => f.positional);
        if (first !== undefined) return { field: first.id, message };
      }
      const f = this.fields.find((x) => !x.positional && x.name === flag);
      if (f !== undefined) return { field: f.id, message };
    }
    return { message };
  }

  /** Whether the person changed anything. */
  dirty(): boolean {
    return this.touched.size > 0;
  }
}

/**
 * The command line r runs (card E8.15c verification, finding N1; the lead's
 * decision): the one that ran, exactly, every flag that is not the actor's
 * kept, its log, its store, its scope and the rest. Only when the answer was
 * made as another actor are the actor's flags (--owner, --as, --level,
 * --member) replaced by the workspace's, and only those.
 */
export function rerunArgv(
  spec: Pick<CommandSpec, "options">,
  argv: readonly string[],
  ws: Workspace,
  otherActor: boolean,
): string[] {
  if (!otherActor) return [...argv];
  const actor = new Set<string>(ACTOR_FLAGS);
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i] as string;
    const flag = /^--([a-z-]+)(=.*)?$/.exec(word);
    if (flag !== null && actor.has(flag[1] as string)) {
      if (flag[2] === undefined) i++;
      continue;
    }
    out.push(word);
  }
  for (const f of ACTOR_FLAGS) {
    if (!Object.hasOwn(spec.options, f)) continue;
    const values =
      f === "member" ? ws.list(f) : ws.get(f) === undefined ? [] : [ws.get(f) as string];
    for (const v of values) out.push(`--${f}`, v);
  }
  return out;
}
