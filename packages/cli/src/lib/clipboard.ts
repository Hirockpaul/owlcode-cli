const CLIPBOARD_COMMANDS: Record<NodeJS.Platform | "default", string[][]> = {
  darwin: [["pbcopy"]],
  win32: [["clip.exe"]],
  linux: [
    ["wl-copy"],
    ["xclip", "-selection", "clipboard"],
    ["xsel", "--clipboard", "--input"],
  ],
  aix: [],
  android: [],
  cygwin: [["clip.exe"]],
  freebsd: [["xclip", "-selection", "clipboard"]],
  haiku: [],
  netbsd: [["xclip", "-selection", "clipboard"]],
  openbsd: [["xclip", "-selection", "clipboard"]],
  sunos: [["xclip", "-selection", "clipboard"]],
  default: [],
};

async function copyWithCommand(command: string[], text: string) {
  const proc = Bun.spawn(command, {
    stdin: new Response(text),
    stdout: "ignore",
    stderr: "ignore",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${command[0]} exited with ${exitCode}`);
  }
}

function copyWithOsc52(text: string) {
  const encoded = Buffer.from(text, "utf8").toString("base64");
  process.stdout.write(`\x1b]52;c;${encoded}\x07`);
}

export async function copyToClipboard(text: string) {
  const commands = CLIPBOARD_COMMANDS[process.platform] ?? CLIPBOARD_COMMANDS.default;

  for (const command of commands) {
    try {
      await copyWithCommand(command, text);
      return;
    } catch {
      // Try the next platform clipboard command.
    }
  }

  copyWithOsc52(text);
}
