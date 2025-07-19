const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Logger {
  constructor(options = {}) {
    this.logDir = path.join(os.homedir(), '.multimc-hub', 'logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.logLevel = options.logLevel || 'info';
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.ensureLogDirectory();
    this.currentLogFile = this.getLogFileName();
  }

  ensureLogDirectory() {
    fs.ensureDirSync(this.logDir);
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `app-${date}.log`);
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    let formattedMessage = `[${timestamp}] ${levelUpper} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        formattedMessage += ` ${JSON.stringify(data, null, 2)}`;
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  async writeToFile(message) {
    try {
      await fs.appendFile(this.currentLogFile, message + '\n');
      
      // Check if we need to rotate logs
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size > this.maxLogSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async rotateLogs() {
    try {
      // Remove oldest log file if we have too many
      const logFiles = await fs.readdir(this.logDir);
      const appLogs = logFiles.filter(file => file.startsWith('app-') && file.endsWith('.log'));
      
      if (appLogs.length >= this.maxLogFiles) {
        appLogs.sort();
        const oldestLog = appLogs[0];
        await fs.remove(path.join(this.logDir, oldestLog));
      }
      
      // Create new log file
      this.currentLogFile = this.getLogFileName();
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  log(level, message, data = null) {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Console output with colors
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      trace: '\x1b[37m'  // White
    };
    
    const reset = '\x1b[0m';
    console.log(`${colors[level]}${formattedMessage}${reset}`);
    
    // File output (no colors)
    this.writeToFile(formattedMessage);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  trace(message, data = null) {
    this.log('trace', message, data);
  }

  // Special logging methods for different components
  server(message, data = null) {
    this.info(`[SERVER] ${message}`, data);
  }

  network(message, data = null) {
    this.info(`[NETWORK] ${message}`, data);
  }

  system(message, data = null) {
    this.info(`[SYSTEM] ${message}`, data);
  }

  profile(message, data = null) {
    this.info(`[PROFILE] ${message}`, data);
  }

  // Log application startup
  startup() {
    this.info('=== MultiMC Hub Starting ===');
    this.info(`Platform: ${os.platform()}`);
    this.info(`Architecture: ${os.arch()}`);
    this.info(`Node.js Version: ${process.version}`);
    this.info(`Log Level: ${this.logLevel}`);
    this.info(`Log Directory: ${this.logDir}`);
  }

  // Log application shutdown
  shutdown() {
    this.info('=== MultiMC Hub Shutting Down ===');
  }

  // Get recent logs
  async getRecentLogs(lines = 100) {
    try {
      const logContent = await fs.readFile(this.currentLogFile, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      return logLines.slice(-lines);
    } catch (error) {
      return [`Error reading logs: ${error.message}`];
    }
  }

  // Get all log files
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      return files.filter(file => file.startsWith('app-') && file.endsWith('.log'));
    } catch (error) {
      return [];
    }
  }

  // Clear old logs
  async clearOldLogs() {
    try {
      const files = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep last 7 days
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime < cutoffDate) {
          await fs.remove(filePath);
          this.info(`Cleared old log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to clear old logs:', error);
    }
  }
}

// Create a singleton instance
const logger = new Logger();

module.exports = { Logger, logger }; 