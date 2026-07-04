import { bridgeHealthResponseSchema } from "@expo-sanpo/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const defaultBridgeUrl = "http://localhost:8787";

export default function HomeScreen() {
  const [bridgeUrl, setBridgeUrl] = useState(defaultBridgeUrl);
  const [statusText, setStatusText] = useState("Not checked");
  const [isChecking, setIsChecking] = useState(false);

  async function checkBridgeHealth() {
    const baseUrl = bridgeUrl.trim().replace(/\/$/, "");

    if (baseUrl.length === 0) {
      setStatusText("Bridge URL is required");
      return;
    }

    setIsChecking(true);
    setStatusText("Checking...");

    try {
      const response = await fetch(`${baseUrl}/health`);

      if (!response.ok) {
        setStatusText(`HTTP ${response.status}`);
        return;
      }

      const health = bridgeHealthResponseSchema.parse(await response.json());
      setStatusText(`${health.service}: ${health.status}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>expo-sanpo</Text>
        <Text style={styles.subtitle}>Bridge health</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Bridge URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          onChangeText={setBridgeUrl}
          placeholder="http://192.168.1.10:8787"
          style={styles.input}
          value={bridgeUrl}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isChecking}
          onPress={checkBridgeHealth}
          style={({ pressed }) => [
            styles.button,
            isChecking ? styles.buttonDisabled : null,
            pressed && !isChecking ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>{isChecking ? "Checking" : "Check"}</Text>
        </Pressable>
      </View>

      <View style={styles.statusPanel}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.status}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
  buttonPressed: {
    backgroundColor: "#1d4ed8",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#f8fafc",
    flex: 1,
    gap: 24,
    justifyContent: "center",
    padding: 24,
  },
  form: {
    gap: 10,
  },
  header: {
    gap: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    color: "#0f172a",
    fontSize: 16,
  },
  statusLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  subtitle: {
    color: "#475569",
    fontSize: 16,
  },
  title: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "700",
  },
});
