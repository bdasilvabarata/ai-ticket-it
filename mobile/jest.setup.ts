import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Selector nativo de fecha y hora (feature 004, R11): sin módulo nativo en jest. El componente
// (iOS) es una vista con `testID` que conserva sus props, así un test llama a `onValueChange`;
// en Android, `DateTimePickerAndroid.open` es un `jest.fn` y el test lee sus argumentos.
jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const DateTimePicker = (props: Record<string, unknown>) =>
    React.createElement(View, { ...props, testID: "selector-nativo-de-fecha" });
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
});
