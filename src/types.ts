import type { Buffer } from 'node:buffer';

export interface MqttConnectionConfig {
  readonly url: string;
  readonly port?: number;
  readonly clientId?: string;
  readonly username?: string;
  readonly password?: string;
  readonly tls?: TlsOptions;
}

export interface TlsOptions {
  readonly rejectUnauthorized?: boolean;
  readonly caPath?: string;
}

export interface SubscriptionConfig {
  readonly topic: string;
  readonly qos?: 0 | 1 | 2;
  readonly displayName?: string;
  readonly unit?: string;
  readonly decimalPlaces?: number;
  readonly color?: string;
  readonly transform?: TransformType;
}

export type TransformType =
  | 'json'
  | 'number'
  | 'boolean'
  | 'hex'
  | 'string'
  | 'default';

export interface TerminalUiConfig {
  readonly refreshIntervalMs?: number;
  readonly showTimestamp?: boolean;
  readonly timestampFormat?: string;
  readonly maxHistory?: number;
}

export interface DashboardConfig {
  readonly mqtt: MqttConnectionConfig;
  readonly subscriptions: SubscriptionConfig[];
  readonly ui?: TerminalUiConfig;
}

export interface SensorValue {
  readonly rawPayload: string;
  readonly parsedValue: unknown;
  readonly timestamp: Date;
  readonly displayValue?: string;
}

export interface SensorState {
  readonly [topic: string]: {
    readonly config: SubscriptionConfig;
    readonly value?: SensorValue;
    readonly history?: SensorValue[];
  };
}

export type MessageHandler = (
  topic: string,
  payload: Buffer,
  packet?: unknown
) => void;

export type ErrorHandler = (error: Error) => void;

export interface DisplayUpdate {
  readonly topic: string;
  readonly config: SubscriptionConfig;
  readonly value?: SensorValue;
}