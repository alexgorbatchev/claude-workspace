#!/usr/bin/env node
import { createRequire } from "node:module";
var __defProp = Object.defineProperty;
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __exportCjs = (target, getters, setters) => {
  for (var name in getters)
    __defProp(target, name, {
      get: getters[name],
      set: setters[name],
      enumerable: true,
      configurable: true,
    });
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/commander/lib/error.js
var require_error = __commonJS(function (exports) {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS(function (exports) {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.endsWith("...")) {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/commander/lib/help.js
var require_help = __commonJS(function (exports) {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd) => !cmd._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions) return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return (
        cmd._name +
        (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") +
        (cmd.options.length ? " [options]" : "") +
        (args ? " " + args : "")
      );
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault =
          option.required || option.optional || (option.isBoolean() && typeof option.defaultValue === "boolean");
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0) return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map();
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [`${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`, ""];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth), ""]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(
          helper.styleArgumentTerm(helper.argumentTerm(argument)),
          helper.styleArgumentDescription(helper.argumentDescription(argument)),
        );
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(
        cmd.options,
        helper.visibleOptions(cmd),
        (option) => option.helpGroupHeading ?? "Options:",
      );
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(
            helper.styleOptionTerm(helper.optionTerm(option)),
            helper.styleOptionDescription(helper.optionDescription(option)),
          );
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(
            helper.styleOptionTerm(helper.optionTerm(option)),
            helper.styleOptionDescription(helper.optionDescription(option)),
          );
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(
        cmd.commands,
        helper.visibleCommands(cmd),
        (sub) => sub.helpGroup() || "Commands:",
      );
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(
            helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
            helper.styleSubcommandDescription(helper.subcommandDescription(sub)),
          );
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str
        .split(" ")
        .map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word === "[command]") return this.styleSubcommandText(word);
          if (word[0] === "[" || word[0] === "<") return this.styleArgumentText(word);
          return this.styleCommandText(word);
        })
        .join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str
        .split(" ")
        .map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word[0] === "[" || word[0] === "<") return this.styleArgumentText(word);
          return this.styleSubcommandText(word);
        })
        .join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(
        helper.longestOptionTermLength(cmd, helper),
        helper.longestGlobalOptionTermLength(cmd, helper),
        helper.longestSubcommandTermLength(cmd, helper),
        helper.longestArgumentTermLength(cmd, helper),
      );
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description) return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(
          /\n/g,
          `
` + " ".repeat(termWidth + spacerWidth),
        );
      }
      return (
        itemIndentStr +
        paddedTerm +
        " ".repeat(spacerWidth) +
        formattedDescription.replace(
          /\n/g,
          `
${itemIndentStr}`,
        )
      );
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap) return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/commander/lib/option.js
var require_option = __commonJS(function (exports) {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _collectValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      previous.push(value);
      return previous;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._collectValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map();
      this.negativeOptions = new Map();
      this.dualOptions = new Set();
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey)) return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str, word) => {
      return str + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS(function (exports) {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance) return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0; i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0) return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1) return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/commander/lib/command.js
var require_command = __commonJS(function (exports) {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process.stdout.write(str),
        writeErr: (str) => process.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => (process.stdout.isTTY ? process.stdout.columns : undefined),
        getErrHelpWidth: () => (process.stderr.isTTY ? process.stderr.columns : undefined),
        getOutHasColors: () => useColor() ?? (process.stdout.isTTY && process.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process.stderr.isTTY && process.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str),
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this; command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault) this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args) cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc) return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help(), this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined) return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined) return this._outputConfiguration;
      this._outputConfiguration = {
        ...this._outputConfiguration,
        ...configuration,
      };
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault) this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden) cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names
        .trim()
        .split(/ +/)
        .forEach((detail) => {
          this.argument(detail);
        });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument?.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs) helpCommand.arguments(helpArgs);
      if (helpDescription) helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand =
        this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          }
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption =
        (option.short && this._findOption(option.short)) || (option.long && this._findOption(option.long));
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(
            name,
            option.defaultValue === undefined ? true : option.defaultValue,
            "default",
          );
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._collectValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(
          `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`,
        );
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv2, parseOptions) {
      if (argv2 !== undefined && !Array.isArray(argv2)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv2 === undefined && parseOptions.from === undefined) {
        if (process.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv2 = process.execArgv ?? [];
        if (
          execArgv2.includes("-e") ||
          execArgv2.includes("--eval") ||
          execArgv2.includes("-p") ||
          execArgv2.includes("--print")
        ) {
          parseOptions.from = "eval";
        }
      }
      if (argv2 === undefined) {
        argv2 = process.argv;
      }
      this.rawArgs = argv2.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv2[1];
          userArgs = argv2.slice(2);
          break;
        case "electron":
          if (process.defaultApp) {
            this._scriptPath = argv2[1];
            userArgs = argv2.slice(2);
          } else {
            userArgs = argv2.slice(1);
          }
          break;
        case "user":
          userArgs = argv2.slice(0);
          break;
        case "eval":
          userArgs = argv2.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath) this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources },
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile)) return;
      const executableDirMessage = executableDir
        ? `searched for local subcommand relative to directory '${executableDir}'`
        : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin)) return localBin;
        if (sourceExt.includes(path.extname(baseName))) return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt) return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process.execArgv).concat(args);
          proc = childProcess.spawn(process.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process.execArgv).concat(args);
        proc = childProcess.spawn(process.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand) this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(
        subcommandName,
        [],
        [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"],
      );
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (
        this.registeredArguments.length > 0 &&
        this.registeredArguments[this.registeredArguments.length - 1].variadic
      ) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise?.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors()
        .reverse()
        .filter((cmd) => cmd._lifeCycleHooks[event] !== undefined)
        .forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent?.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name) return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) =>
          option.conflictsWith.includes(defined.attributeName()),
        );
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(args) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
        return !this._getCommandAndAncestors().some((cmd) =>
          cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)),
        );
      };
      let activeVariadicOption = null;
      let activeGroup = null;
      let i = 0;
      while (i < args.length || activeGroup) {
        const arg = activeGroup ?? args[i++];
        activeGroup = null;
        if (arg === "--") {
          if (dest === unknown) dest.push(arg);
          dest.push(...args.slice(i));
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args[i++];
              if (value === undefined) this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                value = args[i++];
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || (option.optional && this._combineFlagAndOptionalValue)) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              activeGroup = `-${arg.slice(2)}`;
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if (
          (this._enablePositionalOptions || this._passThroughOptions) &&
          operands.length === 0 &&
          unknown.length === 0
        ) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            unknown.push(...args.slice(i));
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg, ...args.slice(i));
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg, ...args.slice(i));
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg, ...args.slice(i));
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0; i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce(
        (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
        {},
      );
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(
        `${message}
`,
        this._outputConfiguration.writeErr,
      );
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process.env) {
          const optionKey = option.attributeName();
          if (
            this.getOptionValue(optionKey) === undefined ||
            ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))
          ) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return (
          this.getOptionValue(optionKey) !== undefined &&
          !["default", "implied"].includes(this.getOptionValueSource(optionKey))
        );
      };
      this.options
        .filter(
          (option) =>
            option.implied !== undefined &&
            hasCustomOptionValue(option.attributeName()) &&
            dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option),
        )
        .forEach((option) => {
          Object.keys(option.implied)
            .filter((impliedKey) => !hasCustomOptionValue(impliedKey))
            .forEach((impliedKey) => {
              this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
            });
        });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option) => {
        const optionKey = option.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (
          negativeOption &&
          ((negativeOption.presetArg === undefined && optionValue === false) ||
            (negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg))
        ) {
          return negativeOption;
        }
        return positiveOption || option;
      };
      const getErrorMessage = (option) => {
        const bestOption = findBestOptionFromValue(option);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption) return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command
            .createHelp()
            .visibleOptions(command)
            .filter((option) => option.long)
            .map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments) return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp()
          .visibleCommands(this)
          .forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined) return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined) return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined) return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined) return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name) throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(
          `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`,
        );
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined) return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage) return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return []
          .concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : [],
          )
          .join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined) return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined) return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined) return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined) return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading) option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup()) cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path) {
      if (path === undefined) return this._executableDir;
      this._executableDir = path;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors,
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors) return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors) str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this,
      };
      this._getCommandAndAncestors()
        .reverse()
        .forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null) this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description) this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode2 = Number(process.exitCode ?? 0);
      if (exitCode2 === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode2 = 1;
      }
      this._exit(exitCode2, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process.env.NO_COLOR || process.env.FORCE_COLOR === "0" || process.env.FORCE_COLOR === "false") return false;
    if (process.env.FORCE_COLOR || process.env.CLICOLOR_FORCE !== undefined) return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// src/main.ts
import process5 from "node:process";

// node_modules/commander/index.js
var exports_commander = {};
__exportCjs(
  exports_commander,
  {
    program: () => $program,
    createCommand: () => $createCommand,
    createOption: () => $createOption,
    createArgument: () => $createArgument,
    Command: () => $Command,
    Option: () => $Option,
    Argument: () => $Argument,
    Help: () => $Help,
    CommanderError: () => $CommanderError,
    InvalidArgumentError: () => $InvalidArgumentError,
    InvalidOptionArgumentError: () => $InvalidOptionArgumentError,
  },
  {
    program: (value) => ($program = value),
    createCommand: (value) => ($createCommand = value),
    createOption: (value) => ($createOption = value),
    createArgument: (value) => ($createArgument = value),
    Command: (value) => ($Command = value),
    Option: (value) => ($Option = value),
    Argument: (value) => ($Argument = value),
    Help: (value) => ($Help = value),
    CommanderError: (value) => ($CommanderError = value),
    InvalidArgumentError: (value) => ($InvalidArgumentError = value),
    InvalidOptionArgumentError: (value) => ($InvalidOptionArgumentError = value),
  },
);
var { Argument } = require_argument();
var { Command } = require_command();
var { CommanderError, InvalidArgumentError } = require_error();
var { Help } = require_help();
var { Option } = require_option();
var $program = new Command();
var $createCommand = (name) => new Command(name);
var $createOption = (flags, description) => new Option(flags, description);
var $createArgument = (name, description) => new Argument(name, description);
var $Command = Command;
var $Option = Option;
var $Argument = Argument;
var $Help = Help;
var $CommanderError = CommanderError;
var $InvalidArgumentError = InvalidArgumentError;
var $InvalidOptionArgumentError = InvalidArgumentError;

// node_modules/commander/esm.mjs
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError: CommanderError2,
  InvalidArgumentError: InvalidArgumentError2,
  InvalidOptionArgumentError,
  Command: Command2,
  Argument: Argument2,
  Option: Option2,
  Help: Help2,
} = exports_commander;

// src/cli.ts
import process4 from "node:process";
import { resolve as resolve2 } from "node:path";

// src/formatters.ts
import process from "node:process";

// src/workspaceResolver.ts
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
var CLAUDE_WORKSPACE_CONFIG_KEY = "@alexgorbatchev/claude-workspace";
var PI_WORKSPACE_CONFIG_KEY = "@alexgorbatchev/pi-workspace";
var GIT_CONFIG_KEYS = [
  "claude-workspace.config",
  "claude-workspace.load",
  "claude-workspace.path",
  "workspace.config",
  "workspace.load",
  "workspace.path",
  "pi-workspace.config",
  "pi-workspace.load",
  "pi-workspace.path",
];
var PROMPT_FILE_NAMES = ["APPEND_SYSTEM.md", "SYSTEM.md", "AGENTS.md", "CLAUDE.md"];
function expandHomeDirectory(filePath, homeDirectoryPath = homedir()) {
  if (filePath === "~") {
    return homeDirectoryPath;
  }
  if (filePath.startsWith(`~${sep}`) || filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return join(homeDirectoryPath, filePath.slice(2));
  }
  return filePath;
}
function collapseHomeDirectory(filePath, homeDirectoryPath = homedir()) {
  if (filePath === homeDirectoryPath) {
    return "~";
  }
  const prefix = homeDirectoryPath.endsWith(sep) ? homeDirectoryPath : `${homeDirectoryPath}${sep}`;
  if (filePath.startsWith(prefix)) {
    return `~/${filePath.slice(prefix.length).replaceAll("\\", "/")}`;
  }
  return filePath;
}
function parseRuleLoad(rawLoad) {
  if (typeof rawLoad === "string" && rawLoad.trim().length > 0) {
    return rawLoad.trim();
  }
  if (Array.isArray(rawLoad)) {
    const validPaths = rawLoad
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (validPaths.length > 0) {
      return validPaths;
    }
  }
  return;
}
function parseWorkspaceConfig(settings) {
  if (typeof settings !== "object" || settings === null) {
    return;
  }
  const rawConfig = Array.isArray(settings)
    ? { configs: settings }
    : (Reflect.get(settings, CLAUDE_WORKSPACE_CONFIG_KEY) ??
      Reflect.get(settings, PI_WORKSPACE_CONFIG_KEY) ??
      settings);
  if (typeof rawConfig !== "object" || rawConfig === null) {
    return;
  }
  const rules = [];
  const rawConfigs = Reflect.get(rawConfig, "configs");
  if (Array.isArray(rawConfigs)) {
    for (const entry of rawConfigs) {
      if (typeof entry === "object" && entry !== null) {
        const rawWhen = Reflect.get(entry, "when") ?? Reflect.get(entry, "glob");
        const rawLoad = Reflect.get(entry, "load") ?? Reflect.get(entry, "path");
        if (typeof rawWhen === "string" && rawWhen.trim().length > 0) {
          const parsedLoad = parseRuleLoad(rawLoad);
          if (parsedLoad !== undefined) {
            rules.push({ when: rawWhen.trim(), load: parsedLoad });
          }
        }
      }
    }
  }
  const rawWorkspaces = Reflect.get(rawConfig, "workspaces");
  if (typeof rawWorkspaces === "object" && rawWorkspaces !== null && !Array.isArray(rawWorkspaces)) {
    for (const [when, rawLoad] of Object.entries(rawWorkspaces)) {
      if (typeof when === "string" && when.trim().length > 0) {
        const parsedLoad = parseRuleLoad(rawLoad);
        if (parsedLoad !== undefined) {
          rules.push({ when: when.trim(), load: parsedLoad });
        }
      }
    }
  }
  if (rules.length === 0) {
    return;
  }
  return { configs: rules };
}
function normalizePathSegments(inputPath, homeDirectoryPath) {
  const expanded = expandHomeDirectory(inputPath, homeDirectoryPath);
  return expanded
    .split(/[/\\]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
function matchWorkspacePatternWithCaptures(pattern, targetPath, homeDirectoryPath) {
  const patternSegments = normalizePathSegments(pattern, homeDirectoryPath);
  const targetSegments = normalizePathSegments(targetPath, homeDirectoryPath);
  if (patternSegments.length === 0 || targetSegments.length === 0) {
    return { isMatch: false, captures: [] };
  }
  const captures = [];
  let pIdx = 0;
  let tIdx = 0;
  while (pIdx < patternSegments.length && tIdx < targetSegments.length) {
    const pSeg = patternSegments[pIdx];
    const tSeg = targetSegments[tIdx];
    if (pSeg === undefined || tSeg === undefined) {
      break;
    }
    if (pSeg === "**") {
      if (pIdx === patternSegments.length - 1) {
        const remaining = targetSegments.slice(tIdx).join("/");
        captures.push(remaining);
        return {
          isMatch: true,
          captures,
          projectName: targetSegments[targetSegments.length - 1],
        };
      }
      pIdx++;
      const nextPatSeg = patternSegments[pIdx];
      let matchedIdx = -1;
      for (let i = tIdx; i < targetSegments.length; i++) {
        if (targetSegments[i] === nextPatSeg || nextPatSeg === "*") {
          matchedIdx = i;
          break;
        }
      }
      if (matchedIdx === -1) {
        return { isMatch: false, captures: [] };
      }
      captures.push(targetSegments.slice(tIdx, matchedIdx).join("/"));
      tIdx = matchedIdx;
      continue;
    }
    if (pSeg === "*") {
      captures.push(tSeg);
      pIdx++;
      tIdx++;
      continue;
    }
    if (pSeg.includes("*")) {
      const regexPattern = `^${pSeg.replaceAll("*", "([^/]+)")}$`;
      const regex = new RegExp(regexPattern);
      const match = tSeg.match(regex);
      if (!match) {
        return { isMatch: false, captures: [] };
      }
      for (let i = 1; i < match.length; i++) {
        const cap = match[i];
        if (cap !== undefined) {
          captures.push(cap);
        }
      }
      pIdx++;
      tIdx++;
      continue;
    }
    if (pSeg !== tSeg) {
      return { isMatch: false, captures: [] };
    }
    pIdx++;
    tIdx++;
  }
  const isMatch = pIdx === patternSegments.length && tIdx === targetSegments.length;
  const lastTargetSegment = targetSegments[targetSegments.length - 1];
  const projectName = captures.length > 0 ? captures[captures.length - 1] : lastTargetSegment;
  return {
    isMatch,
    captures,
    projectName,
  };
}
function interpolatePathPlaceholders(loadPath, projectName, captures) {
  let result = loadPath;
  if (projectName !== undefined) {
    result = result
      .replaceAll("[project]", projectName)
      .replaceAll(":project", projectName)
      .replaceAll("[name]", projectName);
  }
  if (captures !== undefined && captures.length > 0) {
    captures.forEach((capture, index) => {
      const captureIndex = index + 1;
      result = result.replaceAll(`:${captureIndex}`, capture).replaceAll(`$${captureIndex}`, capture);
    });
  }
  return result;
}
function parseSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || !match[1]) {
    return {};
  }
  const lines = match[1].split(/\r?\n/);
  let name;
  let description;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const nameMatch = rawLine.match(/^name:\s*(.+)$/);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim().replace(/^['"](.*)['"]$/, "$1");
      continue;
    }
    const descMatch = rawLine.match(/^description:\s*(.*)$/);
    if (descMatch) {
      const rest = (descMatch[1] ?? "").trim();
      if (rest === ">-" || rest === ">" || rest === "|-" || rest === "|") {
        const blockLines = [];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j] ?? "";
          if (nextLine.startsWith("  ") || nextLine.startsWith("\t")) {
            blockLines.push(nextLine.trim());
            j++;
          } else {
            break;
          }
        }
        description = blockLines.join(" ");
        i = j - 1;
      } else if (rest.length > 0) {
        description = rest.replace(/^['"](.*)['"]$/, "$1");
      }
    }
  }
  return { name, description };
}
function findPromptFile(directoryPath, checkFileExists = existsSync) {
  for (const fileName of PROMPT_FILE_NAMES) {
    const candidatePath = join(directoryPath, fileName);
    if (checkFileExists(candidatePath)) {
      return candidatePath;
    }
  }
  return;
}
function scanLayerAssets(
  directoryPath,
  checkFileExists = existsSync,
  directoryReader = (dirPath) => readdirSync(dirPath),
  fileReader = (filePath) => readFileSync(filePath, "utf-8"),
) {
  const promptPath = findPromptFile(directoryPath, checkFileExists);
  const promptFileName = promptPath ? basename(promptPath) : undefined;
  let promptContent;
  if (promptPath) {
    try {
      promptContent = fileReader(promptPath);
    } catch {}
  }
  const skills = [];
  const skillsSubdirectory = join(directoryPath, "skills");
  if (checkFileExists(skillsSubdirectory)) {
    try {
      const entries = directoryReader(skillsSubdirectory);
      for (const entry of entries) {
        const skillDirPath = join(skillsSubdirectory, entry);
        const skillFilePath = join(skillDirPath, "SKILL.md");
        const singleFileSkillPath = join(skillsSubdirectory, `${entry}.md`);
        if (checkFileExists(skillFilePath)) {
          try {
            const content = fileReader(skillFilePath);
            const frontmatter = parseSkillFrontmatter(content);
            skills.push({
              name: frontmatter.name ?? entry,
              description: frontmatter.description ?? `Skill in ${entry}`,
              path: skillFilePath,
            });
          } catch {
            skills.push({
              name: entry,
              description: `Skill in ${entry}`,
              path: skillFilePath,
            });
          }
        } else if (entry.endsWith(".md") && checkFileExists(singleFileSkillPath)) {
          const skillName = entry.replace(/\.md$/, "");
          try {
            const content = fileReader(singleFileSkillPath);
            const frontmatter = parseSkillFrontmatter(content);
            skills.push({
              name: frontmatter.name ?? skillName,
              description: frontmatter.description ?? `Skill in ${skillName}`,
              path: singleFileSkillPath,
            });
          } catch {
            skills.push({
              name: skillName,
              description: `Skill in ${skillName}`,
              path: singleFileSkillPath,
            });
          }
        }
      }
    } catch {}
  }
  const promptNames = [];
  const promptsSubdirectory = join(directoryPath, "prompts");
  if (checkFileExists(promptsSubdirectory)) {
    try {
      const entries = directoryReader(promptsSubdirectory);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const commandName = entry.slice(0, -3);
          if (!promptNames.includes(commandName)) {
            promptNames.push(commandName);
          }
        }
      }
    } catch {}
  }
  return {
    ...(promptFileName !== undefined ? { promptFileName } : {}),
    ...(promptContent !== undefined ? { promptContent } : {}),
    skills,
    promptNames,
  };
}
function findMainRepositoryRoot(startDirectory) {
  let currentDirectory = resolve(startDirectory);
  while (true) {
    const gitPath = join(currentDirectory, ".git");
    if (existsSync(gitPath)) {
      try {
        const stats = statSync(gitPath);
        if (stats.isDirectory()) {
          return currentDirectory;
        }
        if (stats.isFile()) {
          const content = readFileSync(gitPath, "utf-8").trim();
          const match = content.match(/^gitdir:\s*(.+)$/m);
          if (match && match[1]) {
            const gitDir = resolve(currentDirectory, match[1].trim());
            const commonDirFile = join(gitDir, "commondir");
            if (existsSync(commonDirFile)) {
              const commonDirRelative = readFileSync(commonDirFile, "utf-8").trim();
              const commonDir = resolve(gitDir, commonDirRelative);
              return dirname(commonDir);
            }
            return resolve(gitDir, "../../..");
          }
        }
      } catch {}
    }
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }
  return;
}
function stripGitComment(line) {
  let isInDoubleQuote = false;
  let isInSingleQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && !isInSingleQuote) {
      isInDoubleQuote = !isInDoubleQuote;
    } else if (char === "'" && !isInDoubleQuote) {
      isInSingleQuote = !isInSingleQuote;
    } else if ((char === "#" || char === ";") && !isInDoubleQuote && !isInSingleQuote) {
      return line.slice(0, i).trim();
    }
  }
  return line.trim();
}
function parseGitConfigLoads(configContent) {
  const lines = configContent.split(/\r?\n/);
  let isInTargetSection = false;
  const configValues = [];
  const loadValues = [];
  const pathValues = [];
  for (const rawLine of lines) {
    const cleanLine = stripGitComment(rawLine);
    if (cleanLine.length === 0) {
      continue;
    }
    const sectionMatch = cleanLine.match(/^\[\s*([a-zA-Z0-9_\-.]+)(?:\s+.*)?\]$/);
    if (sectionMatch) {
      const sectionName = (sectionMatch[1] ?? "").toLowerCase();
      isInTargetSection =
        sectionName === "claude-workspace" || sectionName === "workspace" || sectionName === "pi-workspace";
      continue;
    }
    if (!isInTargetSection) {
      continue;
    }
    const keyValueMatch = cleanLine.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (keyValueMatch) {
      const keyName = (keyValueMatch[1] ?? "").toLowerCase();
      let rawValue = (keyValueMatch[2] ?? "").trim();
      if (
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ) {
        rawValue = rawValue.slice(1, -1).trim();
      }
      const pathSegments = rawValue
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      if (keyName === "config") {
        for (const segment of pathSegments) {
          configValues.push(segment);
        }
      } else if (keyName === "load") {
        for (const segment of pathSegments) {
          loadValues.push(segment);
        }
      } else if (keyName === "path") {
        for (const segment of pathSegments) {
          pathValues.push(segment);
        }
      }
    }
  }
  if (configValues.length > 0) {
    return configValues;
  }
  return loadValues.length > 0 ? loadValues : pathValues;
}
function readGitConfigLoads(repositoryRoot, options) {
  if (options?.gitConfigReader) {
    return options.gitConfigReader(repositoryRoot);
  }
  for (const configKey of GIT_CONFIG_KEYS) {
    try {
      const output = execFileSync("git", ["config", "--get-all", configKey], {
        cwd: repositoryRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed = [];
      const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      for (const line of lines) {
        const splitItems = line
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        for (const item of splitItems) {
          parsed.push(item);
        }
      }
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }
  const checkFileExists = options?.fileExists ?? existsSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const gitPath = join(repositoryRoot, ".git");
  if (checkFileExists(gitPath)) {
    try {
      const stats = statSync(gitPath);
      if (stats.isFile()) {
        const content = fileReader(gitPath).trim();
        const match = content.match(/^gitdir:\s*(.+)$/m);
        if (match && match[1]) {
          const gitDir = resolve(repositoryRoot, match[1].trim());
          const worktreeConfigPath = join(gitDir, "config.worktree");
          if (checkFileExists(worktreeConfigPath)) {
            const worktreeContent = fileReader(worktreeConfigPath);
            const worktreeLoads = parseGitConfigLoads(worktreeContent);
            if (worktreeLoads.length > 0) {
              return worktreeLoads;
            }
          }
        }
      }
    } catch {}
  }
  const mainRepo = findMainRepositoryRoot(repositoryRoot) ?? repositoryRoot;
  const configPath = join(mainRepo, ".git", "config");
  if (checkFileExists(configPath)) {
    try {
      const content = fileReader(configPath);
      const parsed = parseGitConfigLoads(content);
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }
  return [];
}
function loadGitWorkspaceConfig(directory, options) {
  const mainRepositoryRoot = findMainRepositoryRoot(directory);
  if (!mainRepositoryRoot) {
    return;
  }
  const rawLoads = readGitConfigLoads(directory, options);
  if (rawLoads.length === 0) {
    return;
  }
  const checkFileExists = options?.fileExists ?? existsSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const homeDirectoryPath = options?.homeDirectoryPath;
  const firstRaw = rawLoads[0];
  if (firstRaw) {
    const expandedFirst = expandHomeDirectory(firstRaw, homeDirectoryPath);
    const resolvedFirst = isAbsolute(expandedFirst) ? expandedFirst : resolve(mainRepositoryRoot, expandedFirst);
    if (firstRaw.endsWith(".json") || (checkFileExists(resolvedFirst) && resolvedFirst.endsWith(".json"))) {
      try {
        const fileContent = fileReader(resolvedFirst);
        const parsedJson = JSON.parse(fileContent);
        const parsedConfig = parseWorkspaceConfig(parsedJson);
        if (parsedConfig && parsedConfig.configs && parsedConfig.configs.length > 0) {
          const jsonDir = dirname(resolvedFirst);
          const normalizedRules = parsedConfig.configs.map((rule) => {
            const rawTargets = Array.isArray(rule.load) ? rule.load : [rule.load];
            const normalizedTargets = rawTargets.map((target) => {
              const exp = expandHomeDirectory(target, homeDirectoryPath);
              return isAbsolute(exp) ? exp : resolve(jsonDir, exp);
            });
            const ruleLoad =
              normalizedTargets.length === 1 && normalizedTargets[0] !== undefined
                ? normalizedTargets[0]
                : normalizedTargets;
            return {
              when: rule.when,
              load: ruleLoad,
            };
          });
          return {
            configs: normalizedRules,
            gitConfigValue: resolvedFirst,
          };
        }
      } catch (error) {
        console.error(`[claude-workspace] Failed to parse JSON config from ${resolvedFirst}:`, error);
      }
    }
  }
  const resolvedPaths = [];
  for (const rawPath of rawLoads) {
    const expanded = expandHomeDirectory(rawPath, homeDirectoryPath);
    const resolvedPath = isAbsolute(expanded) ? expanded : resolve(mainRepositoryRoot, expanded);
    if (!resolvedPaths.includes(resolvedPath)) {
      resolvedPaths.push(resolvedPath);
    }
  }
  if (resolvedPaths.length === 0) {
    return;
  }
  const ruleWhen = collapseHomeDirectory(mainRepositoryRoot, homeDirectoryPath);
  const ruleLoad = resolvedPaths.length === 1 && resolvedPaths[0] !== undefined ? resolvedPaths[0] : resolvedPaths;
  return {
    configs: [
      {
        when: ruleWhen,
        load: ruleLoad,
      },
    ],
    gitConfigValue: rawLoads.length === 1 && rawLoads[0] !== undefined ? rawLoads[0] : rawLoads,
  };
}
function resolveMatchedWorkspaceLayers(currentWorkingDirectory, options) {
  const effectiveConfig = options?.config ?? loadGitWorkspaceConfig(currentWorkingDirectory, options);
  const rules = effectiveConfig?.configs;
  if (!rules || rules.length === 0) {
    return [];
  }
  const checkFileExists = options?.fileExists ?? existsSync;
  const directoryReader = options?.directoryReader ?? readdirSync;
  const fileReader = options?.fileReader ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const mainRepositoryRoot = findMainRepositoryRoot(currentWorkingDirectory);
  const matchedList = [];
  for (const rule of rules) {
    const directMatch = matchWorkspacePatternWithCaptures(
      rule.when,
      currentWorkingDirectory,
      options?.homeDirectoryPath,
    );
    const worktreeMatch =
      !directMatch.isMatch && mainRepositoryRoot !== undefined
        ? matchWorkspacePatternWithCaptures(rule.when, mainRepositoryRoot, options?.homeDirectoryPath)
        : undefined;
    const match = directMatch.isMatch ? directMatch : worktreeMatch?.isMatch ? worktreeMatch : undefined;
    if (match) {
      const targetPaths = Array.isArray(rule.load) ? rule.load : [rule.load];
      const projectName =
        match.projectName ?? (mainRepositoryRoot ? basename(mainRepositoryRoot) : basename(currentWorkingDirectory));
      for (const rawPath of targetPaths) {
        const interpolatedPath = interpolatePathPlaceholders(rawPath, projectName, match.captures);
        const expanded = expandHomeDirectory(interpolatedPath, options?.homeDirectoryPath);
        const resolvedDirectory = resolve(expanded);
        if (checkFileExists(resolvedDirectory)) {
          const scan = scanLayerAssets(resolvedDirectory, checkFileExists, directoryReader, fileReader);
          const alreadyMatched = matchedList.some((m) => m.load === resolvedDirectory && m.when === rule.when);
          if (!alreadyMatched) {
            matchedList.push({
              when: rule.when,
              load: resolvedDirectory,
              ...(scan.promptFileName !== undefined ? { promptFileName: scan.promptFileName } : {}),
              ...(scan.promptContent !== undefined ? { promptContent: scan.promptContent } : {}),
              skills: scan.skills,
              promptNames: scan.promptNames,
            });
          }
        }
      }
    }
  }
  return matchedList;
}

// src/formatters.ts
function isAgentMode() {
  const agent = process.env.AGENT?.trim().toLowerCase();
  return agent === "1" || agent === "true" || agent === "yes";
}
function formatWorkspaceReport(details, isAgent = isAgentMode(), homeDirectoryPath) {
  const collapsedCwd = collapseHomeDirectory(details.cwd, homeDirectoryPath);
  if (isAgent) {
    const lines = [`cwd: ${collapsedCwd}`];
    if (details.gitConfigValue !== undefined) {
      if (Array.isArray(details.gitConfigValue)) {
        for (const item of details.gitConfigValue) {
          lines.push(`git: ${collapseHomeDirectory(item, homeDirectoryPath)}`);
        }
      } else if (typeof details.gitConfigValue === "string") {
        lines.push(`git: ${collapseHomeDirectory(details.gitConfigValue, homeDirectoryPath)}`);
      }
    }
    for (const config of details.configs) {
      const parts = [
        `when=${collapseHomeDirectory(config.when, homeDirectoryPath)}`,
        `load=${collapseHomeDirectory(config.load, homeDirectoryPath)}`,
      ];
      if (config.promptFileName) {
        parts.push(`prompt=${config.promptFileName}`);
      }
      if (config.skills.length > 0) {
        parts.push(`skills=${config.skills.map((s) => s.name).join(",")}`);
      }
      if (config.promptNames.length > 0) {
        parts.push(`prompts=${config.promptNames.join(",")}`);
      }
      lines.push(`* config: ${parts.join(" ")}`);
    }
    return lines.join(`
`);
  }
  const lines = ["[@alexgorbatchev/claude-workspace]"];
  if (details.gitConfigValue !== undefined) {
    if (Array.isArray(details.gitConfigValue)) {
      if (details.gitConfigValue.length === 1 && details.gitConfigValue[0] !== undefined) {
        lines.push(`  git: ${collapseHomeDirectory(details.gitConfigValue[0], homeDirectoryPath)}`);
      } else {
        lines.push("  git:");
        for (const item of details.gitConfigValue) {
          lines.push(`    - ${collapseHomeDirectory(item, homeDirectoryPath)}`);
        }
      }
    } else if (typeof details.gitConfigValue === "string") {
      lines.push(`  git: ${collapseHomeDirectory(details.gitConfigValue, homeDirectoryPath)}`);
    }
  }
  lines.push(`  cwd: ${collapsedCwd}`);
  for (const config of details.configs) {
    lines.push("  config:");
    lines.push(`    when: ${collapseHomeDirectory(config.when, homeDirectoryPath)}`);
    lines.push(`    load: ${collapseHomeDirectory(config.load, homeDirectoryPath)}`);
    if (config.promptFileName) {
      lines.push(`    prompt: ${config.promptFileName}`);
    }
    if (config.skills.length > 0) {
      lines.push("    skills:");
      for (const skill of config.skills) {
        lines.push(`      - ${skill.name}`);
      }
    }
    if (config.promptNames.length > 0) {
      lines.push("    prompts:");
      for (const promptName of config.promptNames) {
        lines.push(`      - ${promptName}`);
      }
    }
  }
  return lines.join(`
`);
}
function formatSessionAdditionalContext(layers, homeDirectoryPath) {
  const sections = [];
  for (const layer of layers) {
    if (layer.promptContent && layer.promptContent.trim().length > 0) {
      const header = `# Workspace Instructions: ${collapseHomeDirectory(layer.load, homeDirectoryPath)}`;
      sections.push(`${header}

${layer.promptContent.trim()}`);
    }
  }
  const allSkills = layers.flatMap((l) => l.skills);
  if (allSkills.length > 0) {
    const skillListLines = [
      "## Out-of-Tree Workspace Skills",
      "The following project skills are available in this workspace:",
    ];
    for (const skill of allSkills) {
      skillListLines.push(`- **${skill.name}**: ${skill.description} (\`${skill.path}\`)`);
    }
    skillListLines.push(`
When you need to use one of these skills, read its SKILL.md file for instructions and execute any bundled scripts or references.`);
    sections.push(
      skillListLines.join(`
`),
    );
  }
  return sections.join(`

---

`);
}

// src/helpTree.ts
import process2 from "node:process";
function getTerminalWidth(fallback = 80) {
  return process2.stdout.columns && process2.stdout.columns > 0 ? process2.stdout.columns : fallback;
}
function formatCommandTree(rootCommand) {
  const terminalWidth = getTerminalWidth();
  const isAgent = isAgentMode();
  if (isAgent) {
    const lines = [`commands: ${rootCommand.name()}`];
    const walk = (cmd, prefix) => {
      for (const sub of cmd.commands) {
        lines.push(`${prefix}* ${sub.name()}: ${sub.description()}`);
        walk(sub, `${prefix}  `);
      }
    };
    walk(rootCommand, "  ");
    return lines.join(`
`);
  }
  const items = [];
  const collect = (cmd, prefix, isLastInParent, isRoot) => {
    const subcommands = cmd.commands;
    if (isRoot) {
      subcommands.forEach((child, index) => {
        const isLast = index === subcommands.length - 1;
        collect(child, "", isLast, false);
      });
      return;
    }
    const marker = isLastInParent ? "╰─ " : "├─ ";
    const continuation = isLastInParent ? "    " : "│   ";
    const hasChildren = subcommands.length > 0;
    items.push({
      label: hasChildren ? cmd.name() : `${cmd.name()} ${cmd.usage()}`.trim(),
      description: cmd.description(),
      isGroup: hasChildren,
      prefix: `${prefix}${marker}`,
    });
    if (hasChildren) {
      subcommands.forEach((child, index) => {
        const isLast = index === subcommands.length - 1;
        collect(child, `${prefix}${continuation}`, isLast, false);
      });
    }
  };
  collect(rootCommand, " ", false, true);
  if (items.length === 0) {
    return "";
  }
  let maxBranchLength = 0;
  for (const item of items) {
    const branch = `${item.prefix}${item.label}`;
    if (!item.isGroup && branch.length > maxBranchLength) {
      maxBranchLength = branch.length;
    }
  }
  const paddedWidth = Math.min(maxBranchLength + 4, 40);
  const formattedLines = ["Commands:"];
  for (const item of items) {
    const branch = `${item.prefix}${item.label}`;
    if (item.isGroup || item.description.length === 0) {
      formattedLines.push(branch);
    } else {
      const padding = " ".repeat(Math.max(1, paddedWidth - branch.length));
      const fullLine = `${branch}${padding}${item.description}`;
      if (fullLine.length > terminalWidth && terminalWidth > 10) {
        formattedLines.push(`${fullLine.slice(0, terminalWidth - 3)}...`);
      } else {
        formattedLines.push(fullLine);
      }
    }
  }
  return formattedLines.join(`
`);
}

// src/hookHandler.ts
import process3 from "node:process";
async function readStdin() {
  if (process3.stdin.isTTY) {
    return "";
  }
  return new Promise((resolve) => {
    let data = "";
    let isDone = false;
    const complete = (result) => {
      if (!isDone) {
        isDone = true;
        resolve(result);
      }
    };
    process3.stdin.setEncoding("utf-8");
    process3.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process3.stdin.on("end", () => {
      complete(data);
    });
    process3.stdin.on("error", () => {
      complete(data);
    });
    setTimeout(() => {
      complete(data);
    }, 200);
  });
}
async function handleSessionStart(options = {}) {
  let stdinInput;
  try {
    const rawStdin = await readStdin();
    if (rawStdin.trim().length > 0) {
      stdinInput = JSON.parse(rawStdin.trim());
    }
  } catch {}
  const targetCwd = options.cwd ?? stdinInput?.cwd ?? process3.cwd();
  const gitConfig = loadGitWorkspaceConfig(targetCwd, options.resolverOptions);
  const layers = resolveMatchedWorkspaceLayers(targetCwd, options.resolverOptions);
  if (layers.length === 0) {
    return {};
  }
  const details = {
    cwd: targetCwd,
    ...(gitConfig?.gitConfigValue !== undefined ? { gitConfigValue: gitConfig.gitConfigValue } : {}),
    configs: layers,
  };
  const systemMessage = `

${formatWorkspaceReport(details)}`;
  const additionalContext = formatSessionAdditionalContext(layers);
  return {
    systemMessage,
    ...(additionalContext.length > 0
      ? {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext,
          },
        }
      : {}),
  };
}

// src/cli.ts
function createCli() {
  const program = new Command2();
  program.name("claude-workspace").description("Hierarchical out-of-tree workspaces for Claude Code").version("1.0.0");
  program.configureHelp({
    formatHelp(cmd, helper) {
      const isAgent = isAgentMode();
      const tree = formatCommandTree(cmd);
      const visibleOptions = helper.visibleOptions(cmd);
      let optionsText = "";
      if (visibleOptions.length > 0) {
        const optionLines = ["Options:"];
        const maxTermLength = helper.longestOptionTermLength(cmd, helper);
        for (const opt of visibleOptions) {
          const term = helper.optionTerm(opt);
          const desc = helper.optionDescription(opt);
          const padding = " ".repeat(Math.max(2, maxTermLength - term.length + 4));
          optionLines.push(`  ${term}${padding}${desc}`);
        }
        optionsText = optionLines.join(`
`);
      }
      if (isAgent) {
        return `${cmd.name()} - ${cmd.description()}
${tree}
${optionsText}`.trim();
      }
      const header = `${cmd.name()} v1.0.0
${cmd.description()}

Usage: ${helper.commandUsage(cmd)}`;
      const sections = [header];
      if (tree.length > 0) {
        sections.push(tree);
      }
      if (optionsText.length > 0) {
        sections.push(optionsText);
      }
      return (
        sections.join(`

`) +
        `
`
      );
    },
  });
  const hookCommand = program.command("hook").description("Lifecycle hooks for Claude Code");
  hookCommand
    .command("session-start")
    .description("Execute Claude Code SessionStart lifecycle hook")
    .option("-c, --cwd <path>", "Target working directory")
    .action(async (options) => {
      const output = await handleSessionStart({
        cwd: options.cwd ? resolve2(options.cwd) : undefined,
      });
      process4.stdout.write(
        JSON.stringify(output, null, 2) +
          `
`,
      );
    });
  const workspaceCommand = program.command("workspace").description("Inspect and manage workspaces");
  workspaceCommand
    .command("inspect [path]")
    .description("Inspect resolved workspace layers for a directory")
    .action((targetPathArg) => {
      const targetPath = targetPathArg ? resolve2(targetPathArg) : process4.cwd();
      const gitConfig = loadGitWorkspaceConfig(targetPath);
      const layers = resolveMatchedWorkspaceLayers(targetPath);
      if (layers.length === 0) {
        if (isAgentMode()) {
          console.log(`ERR: no workspace matched for ${collapseHomeDirectory(targetPath)}`);
        } else {
          console.log(`No workspace configuration matched for ${collapseHomeDirectory(targetPath)}`);
        }
        return;
      }
      const details = {
        cwd: targetPath,
        ...(gitConfig?.gitConfigValue !== undefined ? { gitConfigValue: gitConfig.gitConfigValue } : {}),
        configs: layers,
      };
      console.log(formatWorkspaceReport(details));
    });
  workspaceCommand
    .command("list [path]")
    .description("List configured workspace rules and Git config values")
    .action((targetPathArg) => {
      const targetPath = targetPathArg ? resolve2(targetPathArg) : process4.cwd();
      const gitConfig = loadGitWorkspaceConfig(targetPath);
      const isAgent = isAgentMode();
      if (!gitConfig) {
        if (isAgent) {
          console.log(`ERR: no workspace configuration found in git for ${collapseHomeDirectory(targetPath)}`);
        } else {
          console.log(`No workspace configuration found in git for ${collapseHomeDirectory(targetPath)}`);
        }
        return;
      }
      if (isAgent) {
        console.log(`gitConfigValue: ${JSON.stringify(gitConfig.gitConfigValue)}`);
        if (gitConfig.configs) {
          for (const rule of gitConfig.configs) {
            console.log(`* rule: when=${rule.when} load=${JSON.stringify(rule.load)}`);
          }
        }
      } else {
        console.log(`Git Config Value:`);
        if (Array.isArray(gitConfig.gitConfigValue)) {
          for (const val of gitConfig.gitConfigValue) {
            console.log(`  - ${collapseHomeDirectory(val)}`);
          }
        } else if (typeof gitConfig.gitConfigValue === "string") {
          console.log(`  ${collapseHomeDirectory(gitConfig.gitConfigValue)}`);
        }
        if (gitConfig.configs && gitConfig.configs.length > 0) {
          console.log(`
Configured Rules:`);
          for (const rule of gitConfig.configs) {
            console.log(`  when: ${collapseHomeDirectory(rule.when)}`);
            if (Array.isArray(rule.load)) {
              console.log("  load:");
              for (const l of rule.load) {
                console.log(`    - ${collapseHomeDirectory(l)}`);
              }
            } else if (typeof rule.load === "string") {
              console.log(`  load: ${collapseHomeDirectory(rule.load)}`);
            }
          }
        }
      }
    });
  return program;
}
function runCli(argv = process4.argv) {
  const program = createCli();
  program.parse(argv);
}

// src/main.ts
runCli(process5.argv);
