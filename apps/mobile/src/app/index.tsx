import { bridgeHealthResponseSchema } from "@expo-sanpo/contracts";
import { StyleSheet, Text, View } from "react-native";

const bridgeStatus = bridgeHealthResponseSchema.parse({
  status: "ok",
  service: "expo-sanpo-bridge",
});

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>expo-sanpo</Text>
      <Text style={styles.status}>Bridge contract: {bridgeStatus.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  status: {
    color: "#334155",
    fontSize: 16,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "700",
  },
});
