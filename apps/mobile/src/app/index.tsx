import {
  bridgeHealthResponseSchema,
  createSessionResponseSchema,
  listSessionsResponseSchema,
  sendPromptResponseSchema,
  sessionMessagesResponseSchema,
  updateSessionResponseSchema,
  type Message,
  type Session,
} from "@expo-sanpo/contracts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
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
const remoteTtsUrlStorageKey = "expo-sanpo.remoteTtsUrl";
const sessionIdStorageKey = "expo-sanpo.sessionId";

type TtsMode = "off" | "device" | "remote";

const defaultTtsMode: TtsMode = "off";
const selectableTtsModes: TtsMode[] = ["off", "device", "remote"];

function normalizeBridgeUrl(bridgeUrl: string) {
  return bridgeUrl.trim().replace(/\/$/, "");
}

function getDefaultRemoteTtsUrl(bridgeUrl: string) {
  const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);

  if (normalizedBridgeUrl.length === 0) {
    return "http://localhost:8788";
  }

  return normalizedBridgeUrl.replace(/:\d+$/u, ":8788");
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

function summarizeMessageContent(content: string) {
  const summary = content.replace(/\s+/g, " ").trim();

  if (summary.length <= 80) {
    return summary;
  }

  return `${summary.slice(0, 79)}...`;
}

function formatSessionTimestamp(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

export default function HomeScreen() {
  const [bridgeUrl, setBridgeUrl] = useState(defaultBridgeUrl);
  const [healthStatusText, setHealthStatusText] = useState("Not checked");
  const [sessionStatusText, setSessionStatusText] = useState("No session");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionNameDraft, setSessionNameDraft] = useState("");
  const [promptText, setPromptText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUpdatingSessionName, setIsUpdatingSessionName] = useState(false);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [ttsMode, setTtsMode] = useState<TtsMode>(defaultTtsMode);
  const [ttsStatusText, setTtsStatusText] = useState("TTS off");
  const [remoteTtsUrl, setRemoteTtsUrl] = useState(getDefaultRemoteTtsUrl(defaultBridgeUrl));
  const remoteAudioPlayerRef = useRef<AudioPlayer | null>(null);
  const remoteAudioFileRef = useRef<File | null>(null);

  const selectedSession = sessions.find((session) => session.id === sessionId) ?? null;
  const currentSessionLabel = selectedSession ? selectedSession.name : sessionStatusText;
  const ttsHintText =
    ttsMode === "remote"
      ? "Remote TTS uses the Mac Irodori-TTS server and plays generated WAV audio."
      : Platform.OS === "ios"
        ? "iPhone silent mode must be off for expo-speech in Expo Go."
        : "Device TTS uses expo-speech on this device.";

  useEffect(() => {
    if (selectedSession) {
      setSessionNameDraft(selectedSession.name);
    }
  }, [selectedSession]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedSettings() {
      try {
        const [savedBridgeUrl, savedTtsMode, savedRemoteTtsUrl, savedSessionId] = await Promise.all(
          [
            AsyncStorage.getItem(bridgeUrlStorageKey),
            AsyncStorage.getItem(ttsModeStorageKey),
            AsyncStorage.getItem(remoteTtsUrlStorageKey),
            AsyncStorage.getItem(sessionIdStorageKey),
          ],
        );

        if (!isMounted) {
          return;
        }

        const restoredBridgeUrl = savedBridgeUrl || defaultBridgeUrl;

        if (savedBridgeUrl) {
          setBridgeUrl(savedBridgeUrl);
        }

        setRemoteTtsUrl(savedRemoteTtsUrl || getDefaultRemoteTtsUrl(restoredBridgeUrl));

        const nextTtsMode = parseTtsMode(savedTtsMode);
        setTtsMode(nextTtsMode);
        setTtsStatusText(
          nextTtsMode === "device"
            ? "TTS device"
            : nextTtsMode === "remote"
              ? "TTS remote"
              : "TTS off",
        );

        const baseUrl = normalizeBridgeUrl(restoredBridgeUrl);

        if (baseUrl.length > 0) {
          try {
            const sessionsResponse = await fetch(`${baseUrl}/sessions`);

            if (sessionsResponse.ok) {
              const sessionList = listSessionsResponseSchema.parse(await sessionsResponse.json());
              setSessions(sessionList.sessions);
            }
          } catch {
            // 起動時の自動更新に失敗しても、手動の接続確認と再読み込みを残す。
          }
        }

        if (savedSessionId) {
          setSessionId(savedSessionId);
          setSessionStatusText(`Session: ${savedSessionId}`);

          if (baseUrl.length > 0) {
            setIsLoadingMessages(true);
            const response = await fetch(`${baseUrl}/sessions/${savedSessionId}/messages`);

            if (response.status === 404) {
              await AsyncStorage.removeItem(sessionIdStorageKey);
              setSessionId(null);
              setMessages([]);
              setSessionStatusText("Saved session was not found on bridge");
              setIsLoadingMessages(false);
              return;
            }

            if (!response.ok) {
              setSessionStatusText(`HTTP ${response.status}`);
              setIsLoadingMessages(false);
              return;
            }

            const sessionMessages = sessionMessagesResponseSchema.parse(await response.json());
            setMessages(sessionMessages.messages);
            setSessionStatusText(`Session: ${sessionMessages.sessionId}`);
            setIsLoadingMessages(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          setHealthStatusText(error instanceof Error ? error.message : "Failed to load settings");
          setIsLoadingMessages(false);
        }
      }
    }

    void loadSavedSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  function upsertSession(nextSession: Session) {
    setSessions((currentSessions) => [
      ...currentSessions.filter((session) => session.id !== nextSession.id),
      nextSession,
    ]);
  }

  async function fetchSessions(baseUrl: string) {
    const response = await fetch(`${baseUrl}/sessions`);

    if (!response.ok) {
      throw new Error(`Sessions HTTP ${response.status}`);
    }

    return listSessionsResponseSchema.parse(await response.json()).sessions;
  }

  async function updateTtsMode(nextTtsMode: TtsMode) {
    setTtsMode(nextTtsMode);
    stopAudioPlayback();

    try {
      await AsyncStorage.setItem(ttsModeStorageKey, nextTtsMode);
      setTtsStatusText(
        nextTtsMode === "device"
          ? "TTS device"
          : nextTtsMode === "remote"
            ? "TTS remote"
            : "TTS off",
      );
    } catch (error) {
      setTtsStatusText(error instanceof Error ? error.message : "Failed to save TTS mode");
    }
  }

  async function updateRemoteTtsUrl(nextRemoteTtsUrl: string) {
    setRemoteTtsUrl(nextRemoteTtsUrl);

    const normalizedRemoteTtsUrl = normalizeBridgeUrl(nextRemoteTtsUrl);

    try {
      if (normalizedRemoteTtsUrl.length === 0) {
        await AsyncStorage.removeItem(remoteTtsUrlStorageKey);
        return;
      }

      await AsyncStorage.setItem(remoteTtsUrlStorageKey, normalizedRemoteTtsUrl);
    } catch (error) {
      setTtsStatusText(error instanceof Error ? error.message : "Failed to save remote TTS URL");
    }
  }

  function getRemoteTtsBaseUrl() {
    const baseUrl = normalizeBridgeUrl(remoteTtsUrl);

    if (baseUrl.length === 0) {
      throw new Error("Remote TTS URL is required");
    }

    return baseUrl;
  }

  function stopAudioPlayback() {
    Speech.stop();

    if (remoteAudioPlayerRef.current) {
      remoteAudioPlayerRef.current.pause();
      remoteAudioPlayerRef.current.remove();
      remoteAudioPlayerRef.current = null;
    }
  }

  async function playRemoteSpeech(text: string) {
    const speakableText = text.trim();

    if (speakableText.length === 0) {
      setTtsStatusText("No text to speak");
      return;
    }

    stopAudioPlayback();
    setTtsStatusText("Generating remote voice");

    const response = await expoFetch(`${getRemoteTtsBaseUrl()}/v1/audio/speech`, {
      body: JSON.stringify({
        input: speakableText,
        model: "irodori-tts",
        response_format: "wav",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setTtsStatusText(`Remote TTS HTTP ${response.status}`);
      return;
    }

    const audioBytes = await response.bytes();
    const audioFile = new File(Paths.cache, `expo-sanpo-remote-tts-${Date.now()}.wav`);
    audioFile.create({ overwrite: true });
    audioFile.write(audioBytes);

    if (remoteAudioFileRef.current?.exists) {
      remoteAudioFileRef.current.delete();
    }

    remoteAudioFileRef.current = audioFile;
    await setAudioModeAsync({ playsInSilentMode: true });

    const player = createAudioPlayer({ uri: audioFile.uri });
    remoteAudioPlayerRef.current = player;
    player.play();
    setTtsStatusText("Speaking remote");
  }

  function speakText(text: string) {
    if (ttsMode === "off") {
      return;
    }

    if (ttsMode === "remote") {
      void playRemoteSpeech(text).catch((error) => {
        setTtsStatusText(error instanceof Error ? error.message : "Remote TTS failed");
      });
      return;
    }

    const speakableText = text.trim();

    if (speakableText.length === 0) {
      setTtsStatusText("No text to speak");
      return;
    }

    stopAudioPlayback();
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
    stopAudioPlayback();
    setTtsStatusText(
      ttsMode === "device" ? "TTS device" : ttsMode === "remote" ? "TTS remote" : "TTS off",
    );
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

      if (remoteTtsUrl === getDefaultRemoteTtsUrl(bridgeUrl)) {
        const nextRemoteTtsUrl = getDefaultRemoteTtsUrl(normalizedBridgeUrl);
        setRemoteTtsUrl(nextRemoteTtsUrl);
        await AsyncStorage.setItem(remoteTtsUrlStorageKey, nextRemoteTtsUrl);
      }
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
      await loadSessions({ silent: true });
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
      upsertSession(created.session);
      await selectSession(baseUrl, created.session.id);
      await loadSessions({ silent: true });
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function loadSessions(options: { silent?: boolean } = {}) {
    setIsLoadingSessions(true);

    if (!options.silent) {
      setSessionStatusText("Loading sessions...");
    }

    try {
      const sessionList = await fetchSessions(getBaseUrl());
      setSessions(sessionList);

      if (!options.silent) {
        setSessionStatusText(
          sessionList.length === 0
            ? "No sessions on bridge"
            : `${sessionList.length} session(s) on bridge`,
        );
      }
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function selectSession(baseUrl: string, targetSessionId: string) {
    setSessionId(targetSessionId);

    try {
      await AsyncStorage.setItem(sessionIdStorageKey, targetSessionId);
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Failed to save session");
      return;
    }

    await loadMessages(baseUrl, targetSessionId);
  }

  async function reconnectSession(targetSessionId: string) {
    try {
      await selectSession(getBaseUrl(), targetSessionId);
      await loadSessions({ silent: true });
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function updateSessionName() {
    if (!sessionId) {
      setSessionStatusText("No session");
      return;
    }

    const nextName = sessionNameDraft.trim();

    if (nextName.length === 0) {
      setSessionStatusText("Session name is required");
      return;
    }

    setIsUpdatingSessionName(true);

    try {
      const response = await fetch(`${getBaseUrl()}/sessions/${sessionId}`, {
        body: JSON.stringify({ name: nextName }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });

      if (response.status === 404) {
        await AsyncStorage.removeItem(sessionIdStorageKey);
        setSessionId(null);
        setMessages([]);
        setSessionStatusText("Session was not found on bridge");
        await loadSessions({ silent: true });
        return;
      }

      if (!response.ok) {
        setSessionStatusText(`HTTP ${response.status}`);
        return;
      }

      const updated = updateSessionResponseSchema.parse(await response.json());
      upsertSession(updated.session);
      setSessionNameDraft(updated.session.name);
      setSessionStatusText(`Session renamed: ${updated.session.name}`);
      await loadSessions({ silent: true });
    } catch (error) {
      setSessionStatusText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsUpdatingSessionName(false);
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
    stopAudioPlayback();

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/sessions/${sessionId}/prompts`, {
        body: JSON.stringify({ prompt }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (response.status === 404) {
        await AsyncStorage.removeItem(sessionIdStorageKey);
        setSessionId(null);
        setMessages([]);
        setSessionStatusText("Session was not found on bridge");
        await loadSessions({ silent: true });
        return;
      }

      if (!response.ok) {
        setSessionStatusText(`HTTP ${response.status}`);
        return;
      }

      const result = sendPromptResponseSchema.parse(await response.json());
      const latestAssistantMessage = getLatestAssistantMessage(result.messages);
      setMessages(result.messages);

      if (latestAssistantMessage) {
        setSessions((currentSessions) =>
          currentSessions.map((session) =>
            session.id === result.sessionId
              ? {
                  ...session,
                  updatedAt: latestAssistantMessage.createdAt,
                  latestMessageSummary: summarizeMessageContent(latestAssistantMessage.content),
                }
              : session,
          ),
        );
      }

      await loadSessions({ silent: true });
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

      if (response.status === 404) {
        await AsyncStorage.removeItem(sessionIdStorageKey);
        setSessionId(null);
        setMessages([]);
        setSessionStatusText("Session was not found on bridge");
        await loadSessions({ silent: true });
        return;
      }

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

        <Text style={styles.sectionHeading}>Connection</Text>

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

        <Text style={styles.sectionHeading}>Bridge Sessions</Text>

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
            disabled={isLoadingSessions}
            onPress={() => {
              void loadSessions();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              isLoadingSessions ? styles.secondaryButtonDisabled : null,
              pressed && !isLoadingSessions ? styles.secondaryButtonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingSessions ? "Loading" : "Reload Sessions"}
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
          <Text style={styles.statusLabel}>Current Session</Text>
          <Text style={styles.status}>{currentSessionLabel}</Text>
          {selectedSession ? (
            <>
              <Text style={styles.sessionItemMeta}>
                Updated {formatSessionTimestamp(selectedSession.updatedAt)}
              </Text>
              <TextInput
                autoCorrect={false}
                onChangeText={setSessionNameDraft}
                placeholder="Session name"
                style={styles.input}
                value={sessionNameDraft}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isUpdatingSessionName}
                onPress={updateSessionName}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  isUpdatingSessionName ? styles.secondaryButtonDisabled : null,
                  pressed && !isUpdatingSessionName ? styles.secondaryButtonPressed : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {isUpdatingSessionName ? "Saving" : "Save Name"}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {sessions.length === 0 && !isLoadingSessions ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No bridge sessions</Text>
            <Text style={styles.emptyText}>Create a session or check the bridge connection.</Text>
          </View>
        ) : null}

        {sessions.length > 0 ? (
          <View style={styles.sessionList}>
            {sessions.map((session) => {
              const isSelected = session.id === sessionId;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={session.id}
                  onPress={() => {
                    void reconnectSession(session.id);
                  }}
                  style={({ pressed }) => [
                    styles.sessionItem,
                    isSelected ? styles.sessionItemSelected : null,
                    pressed ? styles.sessionItemPressed : null,
                  ]}
                >
                  <Text style={styles.sessionItemTitle} numberOfLines={1}>
                    {session.name}
                  </Text>
                  <Text style={styles.sessionItemSummary} numberOfLines={2}>
                    {session.latestMessageSummary}
                  </Text>
                  <Text style={styles.sessionItemMeta}>
                    Updated {formatSessionTimestamp(session.updatedAt)}
                  </Text>
                  <Text style={styles.sessionItemId} numberOfLines={1}>
                    {session.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

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
                    {mode === "device" ? "Device" : mode === "remote" ? "Remote" : "Off"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {ttsMode === "remote" ? (
            <View style={styles.form}>
              <Text style={styles.label}>Remote TTS URL</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                onChangeText={(nextRemoteTtsUrl) => {
                  void updateRemoteTtsUrl(nextRemoteTtsUrl);
                }}
                placeholder="http://192.168.1.10:8788"
                style={styles.input}
                value={remoteTtsUrl}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={ttsMode === "off"}
              onPress={() => {
                speakText("音声テストです。");
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                ttsMode === "off" ? styles.secondaryButtonDisabled : null,
                pressed && ttsMode !== "off" ? styles.secondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Test Voice</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={ttsMode === "off"}
              onPress={() => {
                const latestAssistantMessage = getLatestAssistantMessage(messages);

                if (latestAssistantMessage) {
                  speakAssistantMessage(latestAssistantMessage);
                }
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                ttsMode === "off" ? styles.secondaryButtonDisabled : null,
                pressed && ttsMode !== "off" ? styles.secondaryButtonPressed : null,
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

        <Text style={styles.sectionHeading}>Conversation</Text>

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

        {messages.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No messages</Text>
            <Text style={styles.emptyText}>
              Select or create a session to start a conversation.
            </Text>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isAssistant = message.role === "assistant";

              return (
                <View
                  key={message.id}
                  style={[
                    styles.message,
                    isUser ? styles.messageUser : null,
                    isAssistant ? styles.messageAssistant : null,
                  ]}
                >
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageRole}>{message.role}</Text>
                    <Text style={styles.messageTime}>
                      {formatSessionTimestamp(message.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.messageContent}>{message.content}</Text>
                </View>
              );
            })}
          </View>
        )}
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
  emptyPanel: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  emptyText: { color: "#64748b", fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: "#334155", fontSize: 15, fontWeight: "700" },
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
  messageAssistant: { borderLeftColor: "#2563eb", borderLeftWidth: 4 },
  messageContent: { color: "#0f172a", fontSize: 15, lineHeight: 21 },
  messageHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  messageRole: { color: "#64748b", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  messageTime: { color: "#94a3b8", fontSize: 11 },
  messageUser: { backgroundColor: "#f8fafc", borderLeftColor: "#16a34a", borderLeftWidth: 4 },
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
  sessionItem: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  sessionItemId: { color: "#94a3b8", fontSize: 11 },
  sessionItemMeta: { color: "#64748b", fontSize: 12 },
  sessionItemPressed: { backgroundColor: "#eff6ff" },
  sessionItemSelected: { borderColor: "#2563eb" },
  sessionItemSummary: { color: "#334155", fontSize: 13, lineHeight: 18 },
  sessionItemTitle: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  sessionList: { gap: 10 },
  screen: { backgroundColor: "#f8fafc", flex: 1 },
  sectionHeading: { color: "#0f172a", fontSize: 20, fontWeight: "700", marginTop: 4 },
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
