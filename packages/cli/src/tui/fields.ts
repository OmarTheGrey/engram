// A text field (card E8.15b): pi-tui's Input, with its editing keys (ctrl+a,
// ctrl+e, ctrl+w, ctrl+u, ctrl+k, arrows, undo, bracketed paste), drawn with
// its cursor only while focused; unfocused it is the plain value, so no
// stray reverse-video cell marks a field the person is not in.
import { Input } from "@earendil-works/pi-tui";
import { fit } from "./layout.ts";

/** The end key, which moves the cursor after the last character. */
const END = "\x1b[F";

export class TextField {
  private readonly input = new Input({ prompt: "" });

  constructor(value = "") {
    this.set(value);
  }

  get value(): string {
    return this.input.getValue();
  }

  /** Replaces the value, the cursor after it. */
  set(value: string): void {
    this.input.setValue(value);
    this.input.handleInput(END);
  }

  /** One line of `width`: the editor with its cursor when focused, else the value. */
  render(width: number, focused: boolean): string {
    if (width <= 0) return "";
    if (!focused) return fit(this.value, width);
    this.input.focused = true;
    const line = this.input.render(width)[0] ?? "";
    this.input.focused = false;
    return fit(line, width);
  }

  /** A key typed into the field: pi-tui's editing keys and printable text. */
  type(data: string): void {
    this.input.handleInput(data);
  }
}
