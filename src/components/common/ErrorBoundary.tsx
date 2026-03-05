import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  error?: Error;
  info?: { componentStack?: string };
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ error, info });
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{String(this.state.error.message)}</Text>
        {this.state.info?.componentStack ? (
          <ScrollView style={styles.stackContainer}>
            <Text style={styles.stackText}>{this.state.info.componentStack}</Text>
          </ScrollView>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#111",
  },
  title: { color: "#FFF", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  message: { color: "#FFF", opacity: 0.9, marginBottom: 12 },
  stackContainer: { marginTop: 8 },
  stackText: { color: "#FFF", fontSize: 12, opacity: 0.7 },
});
