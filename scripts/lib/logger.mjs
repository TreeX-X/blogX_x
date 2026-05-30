/**
 * 统一日志格式模块
 * 提供清晰、一致的日志输出格式
 */

/*===== 颜色代码 =====*/
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  
  // 前景色
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

/*===== 图标定义 =====*/
const icons = {
  // 状态图标
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  skip: "⏭️",
  
  // 操作图标
  start: "🚀",
  process: "⚡",
  search: "🔍",
  download: "📥",
  translate: "🌐",
  save: "💾",
  check: "🔍",
  fix: "🔧",
  reset: "🔄",
  delete: "🗑️",
  
  // 分类图标
  database: "📦",
  script: "📜",
  config: "⚙️",
  time: "⏱️",
  stats: "📊",
  link: "🔗",
  file: "📄",
  folder: "📁",
};

/*===== 日志类 =====*/
export class Logger {
  constructor(name, options = {}) {
    this.name = name;
    this.verbose = options.verbose ?? true;
    this.indent = options.indent ?? 0;
  }

  /*-- 基础方法 --*/
  _format(message, icon = "", color = "") {
    const indent = "  ".repeat(this.indent);
    const prefix = icon ? `${icon} ` : "";
    const nameTag = this.name ? `[${this.name}] ` : "";
    return `${indent}${color}${prefix}${nameTag}${message}${colors.reset}`;
  }

  _log(message, icon = "", color = "") {
    console.log(this._format(message, icon, color));
  }

  /*-- 状态日志 --*/
  success(message) {
    this._log(message, icons.success, colors.green);
  }

  error(message) {
    this._log(message, icons.error, colors.red);
  }

  warn(message) {
    this._log(message, icons.warning, colors.yellow);
  }

  info(message) {
    this._log(message, icons.info, colors.cyan);
  }

  skip(message) {
    this._log(message, icons.skip, colors.gray);
  }

  /*-- 操作日志 --*/
  start(message) {
    this._log(message, icons.start, colors.bold + colors.blue);
  }

  process(message) {
    this._log(message, icons.process, colors.cyan);
  }

  search(message) {
    this._log(message, icons.search, colors.white);
  }

  download(message) {
    this._log(message, icons.download, colors.green);
  }

  translate(message) {
    this._log(message, icons.translate, colors.magenta);
  }

  save(message) {
    this._log(message, icons.save, colors.green);
  }

  check(message) {
    this._log(message, icons.check, colors.cyan);
  }

  fix(message) {
    this._log(message, icons.fix, colors.yellow);
  }

  reset(message) {
    this._log(message, icons.reset, colors.yellow);
  }

  delete(message) {
    this._log(message, icons.delete, colors.red);
  }

  /*-- 分类日志 --*/
  database(message) {
    this._log(message, icons.database, colors.blue);
  }

  script(message) {
    this._log(message, icons.script, colors.white);
  }

  config(message) {
    this._log(message, icons.config, colors.gray);
  }

  time(message) {
    this._log(message, icons.time, colors.yellow);
  }

  stats(message) {
    if (typeof message === "object" && message !== null) {
      this._log("", icons.stats, colors.bold + colors.white);
      for (const [key, value] of Object.entries(message)) {
        const color = typeof value === "number" && value > 0 ? colors.green : colors.gray;
        console.log(`  ${colors.gray}${key}:${colors.reset} ${color}${value}${colors.reset}`);
      }
    } else {
      this._log(message, icons.stats, colors.bold + colors.white);
    }
  }

  link(message) {
    this._log(message, icons.link, colors.cyan);
  }

  file(message) {
    this._log(message, icons.file, colors.white);
  }

  folder(message) {
    this._log(message, icons.folder, colors.blue);
  }

  /*-- 特殊格式 --*/
  divider(title = "") {
    if (title) {
      const line = "─".repeat(50 - title.length - 2);
      console.log(`${colors.gray}── ${title} ${line}${colors.reset}`);
    } else {
      console.log(`${colors.gray}${"─".repeat(50)}${colors.reset}`);
    }
  }

  section(title) {
    console.log("");
    this.divider(title);
  }

  summary(items) {
    console.log("");
    this.stats("执行摘要:");
    for (const [key, value] of Object.entries(items)) {
      const color = typeof value === "number" && value > 0 ? colors.green : colors.gray;
      console.log(`  ${colors.gray}${key}:${colors.reset} ${color}${value}${colors.reset}`);
    }
  }

  table(headers, rows) {
    const colWidths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map(r => String(r[i] || "").length));
      return Math.max(h.length, maxRow);
    });

    const divider = colWidths.map(w => "─".repeat(w + 2)).join("┼");
    const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join("│");

    console.log(`${colors.gray}┌${divider.replace(/┼/g, "┬")}┐${colors.reset}`);
    console.log(`${colors.gray}│${colors.reset}${headerRow}${colors.gray}│${colors.reset}`);
    console.log(`${colors.gray}├${divider}┤${colors.reset}`);

    for (const row of rows) {
      const rowStr = row.map((cell, i) => {
        const val = String(cell || "");
        const color = val.startsWith("✅") ? colors.green : 
                     val.startsWith("❌") ? colors.red : 
                     val.startsWith("⚠️") ? colors.yellow : colors.white;
        return ` ${color}${val.padEnd(colWidths[i])}${colors.reset} `;
      }).join(`${colors.gray}│${colors.reset}`);
      console.log(`${colors.gray}│${colors.reset}${rowStr}${colors.gray}│${colors.reset}`);
    }

    console.log(`${colors.gray}└${divider.replace(/┼/g, "┴")}┘${colors.reset}`);
  }

  /*-- 子日志器 --*/
  child(name) {
    return new Logger(name, { 
      verbose: this.verbose, 
      indent: this.indent + 1 
    });
  }
}

/*===== 默认导出 =====*/
export const logger = new Logger("");
export { icons, colors };
export default Logger;
