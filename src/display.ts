import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as readline from 'readline';
import type { SensorState, DisplayUpdate, TerminalUiConfig, SubscriptionConfig, SensorValue } from './types';

const CLEAR_SCREEN = '\x1b[2J\x1b[0f';
const RESET_CURSOR = '\x1b[H';
const COLOR_RESET = '\x1b[0m';
const COLOR_MAP: Record<string, string> = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export class Display {
  private state: SensorState = {};
  private refreshInterval?: NodeJS.Timeout;
  private lastDrawWidth = 0;
  private lastDrawHeight = 0;

  constructor(private readonly uiConfig: TerminalUiConfig = {}) {}

  public start(): void {
    this.setupInterval();
    process.stdout.write(CLEAR_SCREEN);
  }

  public stop(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    process.stdout.write(RESET_CURSOR + CLEAR_SCREEN);
  }

  public update(update: DisplayUpdate): void {
    const existing = this.state[update.topic] || { config: update.config };
    const history = existing.value && existing.history 
      ? [existing.value, ...existing.history].slice(0, this.uiConfig.maxHistory ?? 10)
      : [];

    const newState: SensorState = { ...this.state };
    newState[update.topic] = {
      config: update.config,
      value: update.value,
      history: this.uiConfig.maxHistory ? history : undefined,
    };
    this.state = newState;
  }

  private setupInterval(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    const interval = this.uiConfig.refreshIntervalMs ?? 1000;
    this.refreshInterval = setInterval(() => this.redraw(), interval);
  }

  public redraw(): void {
    const rows = Object.values(this.state)
      .sort((a, b) => a.config.topic.localeCompare(b.config.topic))
      .map(sensor => this.formatSensorRow(sensor));

    const header = this.formatHeader();
    const output = [header, ...rows].join('\n');
    
    process.stdout.write(RESET_CURSOR);
    process.stdout.write(output);
    this.trimExtraLines(rows.length + 1);
  }

  private formatHeader(): string {
    const columns = [
      'Topic'.padEnd(30),
      'Value'.padEnd(15),
      this.uiConfig.showTimestamp ? 'Last Updated' : '',
    ].filter(Boolean).join(' | ');
    
    return `\x1b[1m${columns}${COLOR_RESET}\n${'-'.repeat(this.getTerminalWidth())}`;
  }

  private formatSensorRow(sensor: { config: SubscriptionConfig; value?: SensorValue }): string {
    const { config, value } = sensor;
    const displayName = config.displayName || config.topic.split('/').pop() || '';
    const valuePart = value ? this.formatValue(value, config) : 'N/A';
    const timestamp = value ? this.formatTimestamp(value.timestamp) : '';

    const parts = [
      displayName.padEnd(30),
      valuePart.padEnd(15),
      this.uiConfig.showTimestamp ? timestamp : '',
    ].filter(Boolean);

    return parts.join(' | ');
  }

  private formatValue(value: SensorValue, config: SubscriptionConfig): string {
    const color = COLOR_MAP[config.color?.toLowerCase() ?? ''] || '';
    const valueStr = value.displayValue ?? this.defaultFormat(value.parsedValue, config);
    return `${color}${valueStr}${COLOR_RESET}`;
  }

  private defaultFormat(value: unknown, config: SubscriptionConfig): string {
    if (typeof value === 'number') {
      const decimals = config.decimalPlaces ?? 2;
      const rounded = value.toFixed(decimals);
      return config.unit ? `${rounded} ${config.unit}` : rounded;
    }
    return String(value);
  }

  private formatTimestamp(date: Date): string {
    const format = this.uiConfig.timestampFormat || 'HH:mm:ss';
    return format
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  }

  private getTerminalWidth(): number {
    return process.stdout.columns || 80;
  }

  private trimExtraLines(expectedRows: number): void {
    const currentRows = Math.ceil((process.stdout.rows || 24) - expectedRows);
    if (currentRows > 0) {
      process.stdout.write('\n'.repeat(currentRows));
    }
  }
}