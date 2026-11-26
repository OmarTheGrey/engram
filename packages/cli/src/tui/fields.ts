// A text field (card E8.15b): pi-tui's Input, with its editing keys (ctrl+a,
// ctrl+e, ctrl+w, ctrl+u, ctrl+k, arrows, undo, bracketed paste), drawn with
// its cursor only while focused; unfocused it is the plain value, so no
// stray reverse-video cell marks a field the person is not in.
import { Input } from "@earendil-works/pi-tui";
import { redactSecrets } from "../setup.ts";
import { fit } from "./layout.ts";

/** The end key, which moves the cursor after the last character. */
const END = "\x1b[F";

export class TextField {
  private readonly input = new Input({ prompt: "" });
  /** A URL field that may hold credentials: a value it was given is shown redacted (review I4). */
  private readonly secret: boolean;
  /** Whether the person typed in it since its value was set: then it shows what they type. */
  private edited = false;

  constructor(value = "", options: { secret?: boolean } = {}) {
    this.secret = options.secret === true;
    this.set(value);
  }

  /** What is drawn: the value, or for a secret field not yet retyped, the value redacted. */
  private shown(): string {
    const v = this.value;
    return this.secret && !this.edited && v.includes("://") ? redactSecrets(v, v) : v;
  }

  get value(): string {
    return this.input.getValue();
  }

  /** Replaces the value, the cursor after it. */
  set(value: string): void {
    this.input.setValue(value);
    this.input.handleInput(END);
    this.edited = false;
  }

  /** One line of `width`: the editor with its cursor when focused, else the value. */
  render(width: number, focused: boolean): string {
    if (width <= 0) return "";
    if (!focused) return fit(this.shown(), width);
    // A given secret is not drawn until retyped (ctrl+u clears it).
    if (this.secret && !this.edited && this.shown() !== this.value) return fit(this.shown(), width);
    this.input.focused = true;
    const line = this.input.render(width)[0] ?? "";
    this.input.focused = false;
    return fit(line, width);
  }

  /** A key typed into the field: pi-tui's editing keys and printable text. */
  type(data: string): void {
    // Typing into a given secret starts it afresh, so a keystroke never reveals the rest of it.
    const printableKey =
      data.length > 0 && (data.codePointAt(0) ?? 0) >= 32 && data.codePointAt(0) !== 127;
    if (this.secret && !this.edited && printableKey && this.shown() !== this.value)
      this.input.setValue("");
    this.edited = true;
    this.input.handleInput(data);
  }
}
