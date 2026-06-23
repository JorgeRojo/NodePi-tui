import fs from 'node:fs';
import path from 'node:path';

export class Logger {
  private logDir: string;
  private logFilePath: string = '';
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    this.logDir = path.join(process.cwd(), '.nodepi', 'logs');
  }

  /**
   * Initializes the log file, rotates old logs, and opens the write stream.
   */
  public init(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      const todayStr = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
      this.logFilePath = path.join(this.logDir, `background-${todayStr}.log`);

      // Rotate logs to keep only the 3 most recent daily log files
      this.rotateLogs();

      // Open stream in append mode so we don't clear logs from previous starts today
      this.writeStream = fs.createWriteStream(this.logFilePath, {
        flags: 'a',
        encoding: 'utf-8',
      });
      this.info(
        'Logger',
        `NodePi background logger initialized at ${this.logFilePath}`
      );

      // Auto-close write stream on process exit
      process.on('exit', () => {
        this.close();
      });
    } catch (err) {
      console.error('Failed to initialize NodePi background logger:', err);
    }
  }

  /**
   * Retains only the 3 most recent daily log files, deleting older ones.
   */
  private rotateLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files
        .filter(f => f.startsWith('background-') && f.endsWith('.log'))
        .map(f => {
          const dateStr = f.substring(
            'background-'.length,
            f.length - '.log'.length
          );
          return { filename: f, dateStr, timestamp: Date.parse(dateStr) };
        })
        .filter(f => !isNaN(f.timestamp));

      // Sort by timestamp ascending (oldest first)
      logFiles.sort((a, b) => a.timestamp - b.timestamp);

      // Keep only the most recent 3 daily logs
      const maxLogs = 3;
      if (logFiles.length > maxLogs) {
        const toDeleteCount = logFiles.length - maxLogs;
        for (let i = 0; i < toDeleteCount; i++) {
          const filePath = path.join(this.logDir, logFiles[i].filename);
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('Error rotating background logs:', err);
    }
  }

  private formatMessage(
    level: string,
    category: string,
    message: string
  ): string {
    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 23);
    return `[${timestamp}] [${level}] [${category}] ${message}\n`;
  }

  private write(level: string, category: string, message: string): void {
    const formatted = this.formatMessage(level, category, message);
    if (this.writeStream) {
      this.writeStream.write(formatted);
    } else if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formatted, 'utf-8');
      } catch {
        // Ignore logging write failures
      }
    }
  }

  public info(category: string, message: string): void {
    this.write('INFO', category, message);
  }

  public warn(category: string, message: string): void {
    this.write('WARN', category, message);
  }

  public error(category: string, message: string): void {
    this.write('ERROR', category, message);
  }

  public debug(category: string, message: string): void {
    this.write('DEBUG', category, message);
  }

  public close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }
}

export const logger = new Logger();
