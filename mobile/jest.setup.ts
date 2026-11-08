import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
});
