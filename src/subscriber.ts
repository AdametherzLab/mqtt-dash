import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import * as tls from 'node:tls';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type {
  DashboardConfig,
  SensorState,
  SensorValue,
  SubscriptionConfig,
  MessageHandler,
  ErrorHandler,
  DisplayUpdate,
} from './types';

export class MqttSubscriber extends EventEmitter {
  private socket?: net.Socket;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectCount = 0;
  private readonly sensorState: Record<string, {
    config: SubscriptionConfig;
    value?: SensorValue;
    history?: SensorValue[];
  }> = {};
  private readonly clientId: string;

  constructor(private readonly config: DashboardConfig) {
    super();
    this.clientId = config.mqtt.clientId || `mqtt-dash-${crypto.randomBytes(4).toString('hex')}`;
    // Pre-initialize sensor state for configured subscriptions
    for (const sub of config.subscriptions || []) {
      this.sensorState[sub.topic] = { config: sub, history: [] };
    }
    this.connect();
  }

  public connect(): void {
    this.clearReconnectTimer();
    const { url, port, tls: tlsConfig } = this.config.mqtt;
    const parsedUrl = new URL(url);
    const useTls = parsedUrl.protocol === 'mqtts:' || parsedUrl.protocol === 'tls:';

    const connectOptions: net.NetConnectOpts = {
      host: parsedUrl.hostname,
      port: port || (useTls ? 8883 : 1883),
    };

    if (useTls) {
      const tlsOptions: tls.ConnectionOptions = {
        rejectUnauthorized: tlsConfig?.rejectUnauthorized ?? true,
      };

      if (tlsConfig?.caPath) {
        tlsOptions.ca = fs.readFileSync(path.join(tlsConfig.caPath));
      }

      this.socket = tls.connect({ ...connectOptions, ...tlsOptions });
    } else {
      this.socket = net.connect(connectOptions);
    }

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket
      .on('connect', () => this.handleConnect())
      .on('data', (data) => this.handleMessage(data))
      .on('error', (err) => this.handleError(err))
      .on('close', () => this.handleDisconnect());
  }

  private handleConnect(): void {
    this.reconnectCount = 0;
    this.sendMqttConnect();
    this.config.subscriptions.forEach((sub) => {
      this.sendMqttSubscribe(sub.topic, sub.qos || 0);
    });
  }

  private sendMqttConnect(): void {
    const connectPacket = this.buildConnectPacket();
    this.socket?.write(connectPacket);
  }

  private buildConnectPacket(): Buffer {
    const protocolName = 'MQTT';
    const protocolLevel = 0x04;
    const connectFlags = 0x02;
    const keepAlive = 60;

    const clientIdBuffer = Buffer.from(this.clientId);
    const usernameBuffer = this.config.mqtt.username ? Buffer.from(this.config.mqtt.username) : null;
    const passwordBuffer = this.config.mqtt.password ? Buffer.from(this.config.mqtt.password) : null;

    const payload = Buffer.concat([
      Buffer.from([0x00, protocolName.length]),
      Buffer.from(protocolName),
      Buffer.from([protocolLevel]),
      Buffer.from([connectFlags]),
      Buffer.from([(keepAlive >> 8) & 0xff, keepAlive & 0xff]),
      Buffer.from([(clientIdBuffer.length >> 8) & 0xff, clientIdBuffer.length & 0xff]),
      clientIdBuffer,
      ...(usernameBuffer ? [Buffer.from([(usernameBuffer.length >> 8) & 0xff, usernameBuffer.length & 0xff]), usernameBuffer] : []),
      ...(passwordBuffer ? [Buffer.from([(passwordBuffer.length >> 8) & 0xff, passwordBuffer.length & 0xff]), passwordBuffer] : []),
    ]);

    const fixedHeader = Buffer.from([0x10, payload.length]);
    return Buffer.concat([fixedHeader, payload]);
  }

  private sendMqttSubscribe(topic: string, qos: 0 | 1 | 2): void {
    const packetId = crypto.randomBytes(2).readUInt16BE(0);
    const topicBuffer = Buffer.from(topic);
    
    const payload = Buffer.concat([
      Buffer.from([(packetId >> 8) & 0xff, packetId & 0xff]),
      Buffer.from([(topicBuffer.length >> 8) & 0xff, topicBuffer.length & 0xff]),
      topicBuffer,
      Buffer.from([qos]),
    ]);

    const fixedHeader = Buffer.from([0x82, payload.length]);
    this.socket?.write(Buffer.concat([fixedHeader, payload]));
  }

  private handleMessage(data: Buffer): void {
    const packetType = data[0] >> 4;
    if (packetType === 3) {
      this.processPublishPacket(data);
    }
  }

  private processPublishPacket(data: Buffer): void {
    let pos = 1;
    const remainingLength = data.readUInt8(pos++);
    const topicLength = data.readUInt16BE(pos);
    pos += 2;
    const topic = data.toString('utf8', pos, pos + topicLength);
    pos += topicLength;
    const payload = data.slice(pos, pos + remainingLength - topicLength - 2);

    const sensorValue: SensorValue = {
      rawPayload: payload.toString(),
      parsedValue: this.parsePayload(payload),
      timestamp: new Date(),
    };

    this.updateSensorState(topic, sensorValue);
    this.emit('update', { topic, config: this.getSubscription(topic), value: sensorValue });
  }

  private parsePayload(payload: Buffer): unknown {
    try {
      return JSON.parse(payload.toString());
    } catch {
      return payload.toString();
    }
  }

  private updateSensorState(topic: string, value: SensorValue): void {
    const sub = this.getSubscription(topic);
    if (!sub) return;

    const entry = this.sensorState[topic] || { config: sub, history: [] };
    const history = entry.history || [];
    history.push(value);
    const maxHistory = this.config.ui?.maxHistory || 10;
    if (history.length > maxHistory) history.shift();

    this.sensorState[topic] = {
      config: sub,
      value,
      history,
    };
  }

  private getSubscription(topic: string): SubscriptionConfig | undefined {
    return this.config.subscriptions.find((s) => s.topic === topic);
  }

  private handleError(err: Error): void {
    this.emit('error', err);
  }

  private handleDisconnect(): void {
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(1000 * 2 ** this.reconnectCount, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectCount++;
    // Pre-initialize sensor state for configured subscriptions
    for (const sub of config.subscriptions || []) {
      this.sensorState[sub.topic] = { config: sub, history: [] };
    }
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  public disconnect(): void {
    this.clearReconnectTimer();
    this.socket?.end();
  }

  public getCurrentState(): SensorState {
    const result: SensorState = {};
    for (const [topic, entry] of Object.entries(this.sensorState)) {
      result[topic] = {
        config: entry.config,
        value: entry.value,
        history: entry.history,
      };
    }
    return result;
  }

  public onUpdate(handler: (update: DisplayUpdate) => void): void {
    this.on('update', handler);
  }

  public onError(handler: ErrorHandler): void {
    this.on('error', handler);
  }
}