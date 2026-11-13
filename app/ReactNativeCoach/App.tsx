/**
 * Garmin Coach — the React Native Android app.
 *
 * @format
 */

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { appFetch } from './src/coach/appFetch';
import { runCoach, testConnection } from './src/coach/coachService';
import type { ConnectionResult } from './src/coach/coachService';
import type { AppSettings } from './src/coach/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SettingsProvider, useSettings } from './src/settings/SettingsContext';

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navigator() {
  const { settings } = useSettings();
  const isDarkMode = useColorScheme() === 'dark';

  const run = () => runCoach({ settings, fetchImpl: appFetch });
  const test = () => testConnection({ settings, fetchImpl: appFetch });

  return (
    <NavigationContainer>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {({ navigation }) => (
            <HomeScreen
              settings={settings}
              onRun={run}
              onTestConnection={test}
              onOpenSettings={() => navigation.navigate('Settings')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Settings">
          {({ navigation }) => (
            <SettingsRoute settings={settings} onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function SettingsRoute({ settings, onBack }: { settings: AppSettings; onBack: () => void }) {
  const { save } = useSettings();
  const test = (next: AppSettings): Promise<ConnectionResult> =>
    testConnection({ settings: next, fetchImpl: appFetch });
  return <SettingsScreen settings={settings} onSave={save} onTestConnection={test} onBack={onBack} />;
}

function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Navigator />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

export default App;