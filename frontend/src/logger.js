export class Logger {
  // Definition der Log-Level als statische Konstanten
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    OFF: 4
  };

  constructor(name, minLevel = Logger.LEVELS.DEBUG) {
    this.name = name;
    this.minLevel = minLevel;
  }

  // Private Hilfsmethode für die Formatierung
  #format(levelName) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${levelName}] [${this.name}]:`;
  }

  // Die Hauptmethode, die prüft, ob geloggt werden soll
  #shouldLog(level) {
    return level >= this.minLevel;
  }

  log(...args) {
    if (this.#shouldLog(Logger.LEVELS.INFO)) {
      console.log(this.#format('LOG'), ...args);
    }
  }

  debug(...args) {
    if (this.#shouldLog(Logger.LEVELS.DEBUG)) {
      console.debug(this.#format('DEBUG'), ...args);
    }
  }

  info(...args) {
    if (this.#shouldLog(Logger.LEVELS.INFO)) {
      console.info(this.#format('INFO'), ...args);
    }
  }

  warn(...args) {
    if (this.#shouldLog(Logger.LEVELS.WARN)) {
      console.warn(this.#format('WARN'), ...args);
    }
  }

  error(...args) {
    if (this.#shouldLog(Logger.LEVELS.ERROR)) {
      console.error(this.#format('ERROR'), ...args);
    }
  }
}