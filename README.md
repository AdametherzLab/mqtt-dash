# mqtt-dash 📡 - Terminal MQTT Dashboard

**Watch your sensors dance in real-time!** A slick terminal dashboard for live MQTT data visualization. Your IoT playground just found its perfect command-line companion.

![Demo GIF Placeholder](https://via.placeholder.com/800x400.png?text=Live+Sensor+Data+Demo+Here)

## 🚀 Features

- Real-time MQTT data in a pretty terminal table
- Customizable columns and value transformations
- TLS encryption support for secure connections
- Automatic reconnection and error handling
- Blazing fast updates (we're terminal-native, baby!)

## 📦 Installation

```bash
# Bun users (recommended)
bun add mqtt-dash

# npm loyalists
npm install mqtt-dash
```

## 🚨 Quick Start

1. Create `config.json`:
```json
{
  "mqtt": {
    "brokerUrl": "mqtt://sensors.local",
    "username": "iot-admin",
    "password": "s3ns0r-p@ss"
  },
  "subscriptions": [
    {
      "topic": "home/+/sensors/temperature",
      "transform": "number",
      "label": "🌡️ Temp"
    },
    {
      "topic": "factory/pressure/#",
      "transform": "round:1",
      "label": "💨 Pressure"
    }
  ],
  "ui": {
    "refreshInterval": 250,
    "columns": ["Label", "Value", "Last Updated"]
  }
}
```

2. Create `start.ts`:
```typescript
// REMOVED external import: import { MqttSubscriber, Display } from 'mqtt-dash';
import config from './config.json';

const dashboard = new Display(config.ui);
const mqtt = new MqttSubscriber(config.mqtt);

mqtt.on('message', (update) => dashboard.update(update));
mqtt.on('error', (err) => dashboard.showError(err.message));

mqtt.connect().then(() => {
  mqtt.subscribe(config.subscriptions);
  dashboard.start();
});
```

3. Fire it up!
```bash
bun run start
```

## 📖 API Cheat Sheet

### Core Classes

**`MqttSubscriber`** - MQTT connection maestro
```typescript
.connect(): Promise<void>          // Establish connection
.subscribe(config: SubscriptionConfig[]): void  // Add topics
.on('message', handler: MessageHandler)  // New data event
.on('error', handler: ErrorHandler)      // Error reporting
```

**`Display`** - Terminal UI Wizard
```typescript
.start(): void                      // Initialize display
.update(state: DisplayUpdate): void // Push new values
.showError(message: string): void   // Display error overlay
```

### Configuration Types
```typescript
interface DashboardConfig {
  mqtt: MqttConnectionConfig & {
    tls?: TlsOptions;  // For secure connections
  };
  subscriptions: SubscriptionConfig[];
  ui: TerminalUiConfig;
}

interface SubscriptionConfig {
  topic: string;
  transform?: TransformType;  // "number", "round:N", "string"
  label: string;
}
```

## 🛠️ Troubleshooting Common Issues

**🔌 Connection Problems**
- Double-check broker URL format: `mqtt://` vs `mqtts://`
- Test with public test broker `mqtt://test.mosquitto.org` first
- Verify TLS cert paths when using encrypted connections

**📶 Message Not Showing Up?**
- Check topic patterns (use `#` and `+` wildcards)
- Ensure QoS level matches broker configuration
- Verify your transform type matches payload content

**💻 Display Weirdness?**
- Try resizing your terminal window
- Check for ANSI escape code support in your terminal
- Reduce refresh interval if seeing flickering

## 🤝 Contributing

Found a bug? Have a spicy feature idea? We love contributors!

1. Fork it (`gh repo fork mqtt-dash`)
2. Branch it (`git checkout -b feature/cool-stuff`)
3. Test it (add specs!)
4. PR it (we'll high-five through the internet)

## 📄 License

MIT Licensed - Go build something awesome! 🚀

---

Made with 🔥 by IoT enthusiasts and terminal tinkerers. Your sensors will thank you!