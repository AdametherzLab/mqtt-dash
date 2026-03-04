import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MqttSubscriber, Display } from "../src/index";
import type { DashboardConfig, DisplayUpdate, TerminalUiConfig } from "../src/index";

describe("MqttSubscriber", () => {
  it("should initialize sensor state for configured subscriptions", () => {
    const config: DashboardConfig = {
      mqtt: { url: "mqtt://localhost" },
      subscriptions: [{ topic: "sensors/temp" }, { topic: "sensors/humidity" }]
    };
    const subscriber = new MqttSubscriber(config);
    const state = subscriber.getCurrentState();
    expect(state["sensors/temp"]).toBeDefined();
    expect(state["sensors/humidity"]).toBeDefined();
  });

  it("should emit error events on connection failures", () => {
    const config: DashboardConfig = {
      mqtt: { url: "mqtt://invalid" },
      subscriptions: [{ topic: "test" }]
    };
    const subscriber = new MqttSubscriber(config);
    let errorReceived = false;
    subscriber.onError(() => errorReceived = true);
    subscriber.emit("error", new Error("Connection failed"));
    expect(errorReceived).toBeTrue();
  });
});

describe("Display", () => {
  let originalWrite: any;
  let output: string;

  beforeEach(() => {
    output = "";
    originalWrite = process.stdout.write;
    process.stdout.write = (chunk: string) => {
      output += chunk;
      return true;
    };
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it("should format sensor values with color and units", () => {
    const display = new Display();
    const update: DisplayUpdate = {
      topic: "sensors/temp",
      config: { topic: "sensors/temp", color: "green", unit: "°C", decimalPlaces: 1 },
      value: {
        rawPayload: "23.5",
        parsedValue: 23.5,
        timestamp: new Date()
      }
    };
    display.update(update);
    display.redraw();
    expect(output).toInclude("23.5 °C");
    expect(output).toInclude("\x1b[32m");
  });

  it("should display N/A for missing values", () => {
    const display = new Display();
    const update: DisplayUpdate = {
      topic: "sensors/pressure",
      config: { topic: "sensors/pressure" }
    };
    display.update(update);
    display.redraw();
    expect(output).toInclude("N/A");
  });

  it("should hide timestamp column when showTimestamp is false", () => {
    const display = new Display({ showTimestamp: false });
    display.redraw();
    expect(output).not.toInclude("Last Updated");
  });
});