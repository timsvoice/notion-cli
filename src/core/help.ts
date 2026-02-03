import { Argument, Command, Help, Option } from "commander";
import { EXIT_CODES } from "./errors.js";
import { CLI_VERSION } from "./constants.js";

type HelpFlag = {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  choices?: string[];
  description?: string;
  env?: string;
};

type HelpArg = {
  name: string;
  required: boolean;
  description?: string;
  default?: unknown;
  choices?: string[];
};

type HelpCommandNode = {
  name: string;
  description?: string;
  usage: string;
  flags: HelpFlag[];
  args: HelpArg[];
  examples: string[];
  commands: HelpCommandNode[];
};

type HelpTree = {
  name: string;
  version?: string;
  description?: string;
  usage: string;
  global_flags: HelpFlag[];
  exit_codes: { code: number; meaning: string }[];
  examples: string[];
  commands: HelpCommandNode[];
};

const BUILTIN_GLOBAL_FLAGS: HelpFlag[] = [
  { name: "-h, --help", type: "boolean", description: "Show this help message" }
];

const EXIT_CODE_MEANINGS: Record<number, string> = {
  0: "Success",
  1: "General error",
  2: "Invalid arguments",
  3: "Partial failure",
  4: "Resource not found",
  5: "Conflict",
  10: "Auth failure",
  11: "Permission denied",
  12: "Rate limited",
  20: "Timeout",
  30: "Dependency missing",
  125: "Internal error"
};

const EXAMPLE_OVERRIDES: Record<string, string[]> = {
  notion: [
    "notion users me",
    "notion search --query \"Meals\" --filter '{\"property\":\"object\",\"value\":\"data_source\"}' --sort '{\"timestamp\":\"last_edited_time\",\"direction\":\"descending\"}'",
    "notion --help-json"
  ],
  "notion users": ["notion users me", "notion users get <user_id>"],
  "notion users me": ["notion users me"],
  "notion users get": ["notion users get <user_id>", "notion users get --id <user_id>"],
  "notion search": [
    "notion search --query \"Meals\" --filter '{\"property\":\"object\",\"value\":\"data_source\"}' --sort '{\"timestamp\":\"last_edited_time\",\"direction\":\"descending\"}'"
  ]
};

function getCommandPath(cmd: Command): string {
  const names: string[] = [];
  let current: Command | null = cmd;
  while (current) {
    names.push(current.name());
    current = current.parent;
  }
  return names.reverse().join(" ").trim();
}

function optionType(option: Option): string {
  if (!option.required && !option.optional) return "boolean";
  if (option.parseArg) return "number";
  return "string";
}

function optionToHelpFlag(option: Option): HelpFlag {
  return {
    name: option.flags,
    type: optionType(option),
    required: option.mandatory || undefined,
    default: option.defaultValue,
    choices: option.argChoices ? [...option.argChoices] : undefined,
    description: option.description,
    env: option.envVar
  };
}

function argToHelpArg(arg: Argument): HelpArg {
  return {
    name: arg.name(),
    required: arg.required,
    description: arg.description,
    default: arg.defaultValue,
    choices: arg.argChoices ? [...arg.argChoices] : undefined
  };
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function formatFlags(options: HelpFlag[]): string[] {
  if (options.length === 0) return ["  (none)"];
  const terms = options.map((opt) => opt.name);
  const width = Math.max(...terms.map((term) => term.length));
  return options.map((opt) => {
    const details: string[] = [];
    if (opt.type) details.push(`type: ${opt.type}`);
    if (opt.required) details.push("required");
    if (opt.default !== undefined) details.push(`default: ${formatValue(opt.default)}`);
    if (opt.choices && opt.choices.length > 0) details.push(`choices: ${opt.choices.join("|")}`);
    if (opt.env) details.push(`env: ${opt.env}`);
    const suffix = details.length ? ` (${details.join(", ")})` : "";
    const term = opt.name.padEnd(width);
    const desc = opt.description ? `${opt.description}${suffix}` : suffix.trim();
    return `  ${term}  ${desc}`.trimEnd();
  });
}

function formatCommands(commands: Command[]): string[] {
  if (commands.length === 0) return ["  (none)"];
  const rows = commands.map((cmd) => ({
    name: cmd.name(),
    description: cmd.description() ?? ""
  }));
  const width = Math.max(...rows.map((row) => row.name.length));
  return rows.map((row) => `  ${row.name.padEnd(width)}  ${row.description}`.trimEnd());
}

function formatArgs(args: HelpArg[]): string[] {
  if (args.length === 0) return ["  (none)"];
  const terms = args.map((arg) => arg.name);
  const width = Math.max(...terms.map((term) => term.length));
  return args.map((arg) => {
    const details: string[] = [];
    if (arg.required) details.push("required");
    if (arg.default !== undefined) details.push(`default: ${formatValue(arg.default)}`);
    if (arg.choices && arg.choices.length > 0) details.push(`choices: ${arg.choices.join("|")}`);
    const suffix = details.length ? ` (${details.join(", ")})` : "";
    const term = arg.name.padEnd(width);
    const desc = arg.description ? `${arg.description}${suffix}` : suffix.trim();
    return `  ${term}  ${desc}`.trimEnd();
  });
}

function listExitCodes(): { code: number; meaning: string }[] {
  const codes = new Set(Object.values(EXIT_CODES));
  return Array.from(codes)
    .sort((a, b) => a - b)
    .map((code) => ({ code, meaning: EXIT_CODE_MEANINGS[code] ?? "" }));
}

function getRootCommand(cmd: Command): Command {
  let current: Command = cmd;
  while (current.parent) current = current.parent;
  return current;
}

function generateExamples(cmd: Command): string[] {
  const path = getCommandPath(cmd);
  const override = EXAMPLE_OVERRIDES[path];
  if (override && override.length > 0) return override;

  const base = path;
  if (cmd.commands.length > 0) {
    const sub = cmd.commands.find((child) => !(child as any).hidden);
    if (sub) {
      return [`${base} ${sub.name()} --help`];
    }
    return [`${base} --help`];
  }

  const args = cmd.registeredArguments.filter((arg) => arg.required);
  const requiredFlags = cmd.options.filter((opt) => opt.mandatory);
  const argParts = args.map((arg) => `<${arg.name()}>`);
  const flagParts = requiredFlags.map((opt) => {
    const longFlag = opt.long ?? opt.flags.split(" ").find((part) => part.startsWith("--")) ?? opt.flags;
    const hasValue = opt.required || opt.optional;
    return hasValue ? `${longFlag} <value>` : longFlag;
  });
  const parts = [base, ...argParts, ...flagParts].filter(Boolean);
  return [parts.join(" ")];
}

export function buildHelpTree(program: Command): HelpTree {
  const rootUsage = program.createHelp().commandUsage(program);
  const globalFlags = [...BUILTIN_GLOBAL_FLAGS, ...program.options.map(optionToHelpFlag)];

  const buildCommandNode = (cmd: Command): HelpCommandNode => {
    const usage = cmd.createHelp().commandUsage(cmd);
    const flags = cmd.options.map(optionToHelpFlag);
    const args = cmd.registeredArguments.map(argToHelpArg);
    return {
      name: cmd.name(),
      description: cmd.description() ?? undefined,
      usage,
      flags,
      args,
      examples: generateExamples(cmd),
      commands: cmd.commands.map(buildCommandNode)
    };
  };

  return {
    name: program.name(),
    version: program.version() ?? CLI_VERSION,
    description: program.description() ?? undefined,
    usage: rootUsage,
    global_flags: globalFlags,
    exit_codes: listExitCodes(),
    examples: generateExamples(program),
    commands: program.commands.map(buildCommandNode)
  };
}

export function formatHelp(cmd: Command, helper: Help): string {
  const lines: string[] = [];
  const usage = helper.commandUsage(cmd);
  const root = getRootCommand(cmd);

  lines.push("USAGE:");
  lines.push(`  ${usage}`);
  lines.push("");

  const description = cmd.description();
  if (description) {
    lines.push("DESCRIPTION:");
    lines.push(`  ${description}`);
    lines.push("");
  }

  if (cmd.commands.length > 0) {
    lines.push("COMMANDS:");
    lines.push(...formatCommands(cmd.commands.filter((child) => !(child as any).hidden)));
    lines.push("");
  }

  const args = cmd.registeredArguments.map(argToHelpArg);
  if (args.length > 0) {
    lines.push("ARGS:");
    lines.push(...formatArgs(args));
    lines.push("");
  }

  if (cmd.parent) {
    const flags = cmd.options.map(optionToHelpFlag);
    lines.push("FLAGS:");
    lines.push(...formatFlags(flags));
    lines.push("");
  }

  lines.push("GLOBAL FLAGS:");
  lines.push(
    ...formatFlags([
      ...BUILTIN_GLOBAL_FLAGS,
      ...root.options.map(optionToHelpFlag)
    ])
  );
  lines.push("");

  lines.push("EXIT CODES:");
  const exitCodes = listExitCodes();
  if (exitCodes.length === 0) {
    lines.push("  (none)");
  } else {
    const width = Math.max(...exitCodes.map((code) => String(code.code).length));
    for (const code of exitCodes) {
      const label = String(code.code).padEnd(width);
      lines.push(`  ${label}  ${code.meaning}`.trimEnd());
    }
  }
  lines.push("");

  const examples = generateExamples(cmd);
  if (examples.length > 0) {
    lines.push("EXAMPLES:");
    for (const example of examples) {
      lines.push(`  ${example}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
