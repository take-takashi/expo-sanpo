import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
  type Message,
} from "@expo-sanpo/contracts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const defaultBridgeUrl = "http://localhost:8787";
const bridgeUrlStorageKey = "expo-sanpo.bridgeUrl";
const ttsModeStorageKey = "expo-sanpo.ttsMode";

type TtsMode = "off" | "device" | "remote";

const defaultTtsMode: TtsMode = "off";
const selectableTtsModes: TtsMode[] = ["off", "device"];

function normalizeBridgeUrl(bridgeUrl: string) {
  return bridgeUrl.trim().replace(/\/$/, "");
}

function parseTtsMode(value: string | null): TtsMode {
  if (value === "device" || value === "remote" || value === "off") {
    return value;
  }

  return defaultTtsMode;
}

function getSpeakableAssistantText(message: Message) {
  return message.content
    .replace(/^\s*[•>_-]+\s*/u, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getLatestAssistantMessage(nextMessages: Message[]) {
  return nextMessages.findLast((message) => message.role === "assistant") ?? null;
}

export default function HomeScreen() {
  const [bridgeUrl, setBridgeUrl] = useState(defaultBridgeUrl);
  const [healthStatusText, setHealthStatusText] = useState("Not checked");
  const [sessionStatusText, setSessionStatusText] = useState("No session");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [ttsMode, setTtsMode] = useState<TtsMode>(defaultTtsMode);
  const [ttsStatusText, setTtsStatusText] = useState("TTS off");

  const ttsHintText =
    Platform.OS === "ios"
      ? "iPhone silent mode must be off for expo-speech in Expo Go."
      : "Device TTS uses expo-speech on this device.";

  useEffect(() => {
    let isMounted = true;

    async function loadSavedSettings() {
      try {
        const [savedBridgeUrl, savedTtsMode] = await Promise.all([
          AsyncStorage.getItem(bridgeUrlStorageKey),
          AsyncStorage.getItem(ttsModeStorageKey),
        ]);

        if (!isMounted) {
          return;
        }

        if (savedBridgeUrl) {
          setBridgeUrl(savedBridgeUrl);
        }

        const nextTtsMode = parseTtsMode(savedTtsMode);
        setTtsMode(nextTtsMode);
        setTtsStatusText(nextTtsMode === "device" ? "TTS device" : "TTS off");
      } catch (error) {
        if (isMounted) {
          setHealthStatusText(error instanceof Error ? error.message : "Failed to load settings");
        }
      }
    }

    void loadSavedSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  async function updateTtsMode(nextTtsMode: TtsMode) {
    setTtsMode(nextTtsMode);
    Speech.stop();

    try {
      await AsyncStorage.setItem(ttsModeStorageKey, nextTtsMode);
      setTtsStatusText(nextTtsMode === "device" ? "TTS device" : "TTS off");
    } catch (error) {
      setTtsStatusText(error instanceof Error ? error.message : "Failed to save TTS mode");
    }
  }

  function speakText(text: string) {
    if (ttsMode === "off") {
      return;
    }

    if (ttsMode === "remote") {
      setTtsStatusText("Remote TTS is not implemented yet");
      return;
    }

    const speakableText = text.trim();

    if (speakableText.length === 0) {
      setTtsStatusText("No text to speak");
      return;
    }

    Speech.stop();
    Speech.speak(speakableText, {
      language: "ja-JP",
      onDone: () => {
        setTtsStatusText("TTS device");
      },
      onError: () => {
        setTtsStatusText("TTS failed");
      },
      onStart: () => {
        setTtsStatusText("Speaking");
      },
    });
  }

  function speakAssistantMessage(message: Message) {
    speakText(getSpeakableAssistantText(message));
  }

  function speakLatestAssistantMessage(nextMessages: Message[]) {
    const latestAssistantMessage = getLatestAssistantMessage(nextMessages);

    if (latestAssistantMessage) {
      speakAssistantMessage(latestAssistantMessage);
    }
  }

  function stopSpeaking() {
    Speech.stop();
    setTtsStatusText(ttsMode === "device" ? "TTS device" : "TTS off");
  }

  async function updateBridgeUrl(nextBridgeUrl: string) {
    setBridgeUrl(nextBridgeUrl);

    const normalizedBridgeUrl = normalizeBridgeUrl(nextBridgeUrl);

    try {
      if (normalizedBridgeUrl.length === 0) {
        await AsyncStorage.removeItem(bridgeUrlStorageKey);
        return;
      }

      await AsyncStorage.setItem(bridgeUrlStorageKey, normalizedBridgeUrl);
    } catch (error) {
      setHealthStatusText(error instanceof Error ? error.message : "Failed to save Bridge URL");
    }
  }

  function getBaseUrl() {
    const baseUrl = normalizeBridgeUrl(bridgeUrl);

    if (baseUrl.length === 0) {
      throw new Error("Bridge URL is required");
    }

    return baseUrl;
  }

  async function checkBridgeHealth() {
    setIsChecking(true);
    setHealthStatusText("Checking...");

    try {
      const response = await fetch(`${getBaseUrl()}/health`);

      if (!response.ok) {
        setHealthStatusText(`HTTP ${response.status}`);
        return;
      }

      const health = bridgeHealthResponseSchema.parse(await response.json());
      setHealthStatusText(`${health.service}: ${health.status}`);
    } catch (error) {
      setHealthStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsChecking(false);
    }
  }

  async function createSession() {
    setIsCreatingSession(true);
    setSessionStatusText("Creating...");

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/sessions`, {
        method: "POST",
      });

      if (!response.ok) {
        setSessionStatusText(`HTTP ${response.status}`);
        return;
      }

      const created = createSessionResponseSchema.parse(await response.json());
      setSessionId(created.session.id);
      setSessionStatusText(`Session: ${created.session.id}`);
      await loadMessages(baseUrl, created.session.id);
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function refreshMessages() {
    if (!sessionId) {
      setSessionStatusText("No session");
      return;
    }

    try {
      await loadMessages(getBaseUrl(), sessionId);
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function sendPrompt() {
    if (!sessionId) {
      setSessionStatusText("No session");
      return;
    }

    const prompt = promptText.trim();

    if (prompt.length === 0) {
      setSessionStatusText("Prompt is required");
      return;
    }

    setIsSendingPrompt(true);
    Speech.stop();

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/sessions/${sessionId}/prompts`, {
        body: JSON.stringify({ prompt }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        setSessionStatusText(`HTTP ${response.status}`);
        return;
      }

      const result = sendPromptResponseSchema.parse(await response.json());
      setMessages(result.messages);
      speakLatestAssistantMessage(result.messages);
      setPromptText("");
      setSessionStatusText(`Session: ${result.sessionId}`);
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSendingPrompt(false);
    }
  }

  async function loadMessages(baseUrl: string, targetSessionId: string) {
    setIsLoadingMessages(true);

    try {
      const response = await fetch(`${baseUrl}/sessions/${targetSessionId}/messages`);

      if (!response.ok) {
        setSessionStatusText(`HTTP ${response.status}`);
        return;
      }

      const sessionMessages = sessionMessagesResponseSchema.parse(await response.json());
      setMessages(sessionMessages.messages);
      setSessionStatusText(`Session: ${sessionMessages.sessionId}`);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={24}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>expo-sanpo</Text>
          <Text style={styles.subtitle}>Bridge session</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Bridge URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            onChangeText={(nextBridgeUrl) => {
              void updateBridgeUrl(nextBridgeUrl);
            }}
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
            <Text style={styles.buttonText}>{isChecking ? "Checking" : "Check Health"}</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.statusLabel}>Health</Text>
          <Text style={styles.status}>{healthStatusText}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isCreatingSession}
            onPress={createSession}
            style={({ pressed }) => [
              styles.button,
              isCreatingSession ? styles.buttonDisabled : null,
              pressed && !isCreatingSession ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>
              {isCreatingSession ? "Creating" : "Create Session"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!sessionId || isLoadingMessages}
            onPress={refreshMessages}
            style={({ pressed }) => [
              styles.secondaryButton,
              !sessionId || isLoadingMessages ? styles.secondaryButtonDisabled : null,
              pressed && sessionId && !isLoadingMessages ? styles.secondaryButtonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingMessages ? "Loading" : "Refresh Messages"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.statusLabel}>Session</Text>
          <Text style={styles.status}>{sessionStatusText}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.statusLabel}>TTS</Text>
          <View style={styles.segmentedControl}>
            {selectableTtsModes.map((mode) => {
              const isSelected = ttsMode === mode;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={mode}
                  onPress={() => {
                    void updateTtsMode(mode);
                  }}
                  style={[styles.segmentButton, isSelected ? styles.segmentButtonSelected : null]}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      isSelected ? styles.segmentButtonTextSelected : null,
                    ]}
                  >
                    {mode === "device" ? "Device" : "Off"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={ttsMode !== "device"}
              onPress={() => {
                speakText("音声テストです。");
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                ttsMode !== "device" ? styles.secondaryButtonDisabled : null,
                pressed && ttsMode === "device" ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Test Voice</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={ttsMode !== "device"}
              onPress={() => {
                const latestAssistantMessage = getLatestAssistantMessage(messages);

                if (latestAssistantMessage) {
                  speakAssistantMessage(latestAssistantMessage);
                }
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                ttsMode !== "device" ? styles.secondaryButtonDisabled : null,
                pressed && ttsMode === "device" ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Read Latest</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={stopSpeaking}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Stop</Text>
            </Pressable>
          </View>
          <Text style={styles.status}>{ttsStatusText}</Text>
          <Text style={styles.hint}>{ttsHintText}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.statusLabel}>Prompt</Text>
          <TextInput
            multiline={true}
            onChangeText={setPromptText}
            placeholder="Send a prompt to the bridge"
            style={[styles.input, styles.promptInput]}
            value={promptText}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!sessionId || isSendingPrompt}
            onPress={sendPrompt}
            style={({ pressed }) => [
              styles.button,
              !sessionId || isSendingPrompt ? styles.buttonDisabled : null,
              pressed && sessionId && !isSendingPrompt ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>{isSendingPrompt ? "Sending" : "Send Prompt"}</Text>
          </Pressable>
        </View>

        <View style={styles.messages}>
          {messages.map((message) => (
            <View key={message.id} style={styles.message}>
              <Text style={styles.messageRole}>{message.role}</Text>
              <Text style={styles.messageContent}>{message.content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  buttonPressed: { backgroundColor: "#1d4ed8" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  container: {
    backgroundColor: "#f8fafc",
    flexGrow: 1,
    gap: 18,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 64,
  },
  form: { gap: 10 },
  header: { gap: 6 },
  hint: { color: "#64748b", fontSize: 13, lineHeight: 18 },
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
  label: { color: "#334155", fontSize: 14, fontWeight: "600" },
  message: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  messageContent: { color: "#0f172a", fontSize: 15, lineHeight: 21 },
  messageRole: { color: "#64748b", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  messages: { gap: 10 },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  promptInput: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  screen: { backgroundColor: "#f8fafc", flex: 1 },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  segmentButtonSelected: { backgroundColor: "#2563eb" },
  segmentButtonText: { color: "#334155", fontSize: 14, fontWeight: "700" },
  segmentButtonTextSelected: { color: "#ffffff" },
  segmentedControl: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#2563eb",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonDisabled: { borderColor: "#cbd5e1" },
  secondaryButtonPressed: { backgroundColor: "#eff6ff" },
  secondaryButtonText: { color: "#1d4ed8", fontSize: 16, fontWeight: "700" },
  status: { color: "#0f172a", fontSize: 16 },
  statusLabel: { color: "#64748b", fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  subtitle: { color: "#475569", fontSize: 16 },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "700" },
});
