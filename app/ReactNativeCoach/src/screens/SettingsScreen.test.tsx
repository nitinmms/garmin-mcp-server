import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SettingsScreen } from './SettingsScreen';
import { MISSING_GARMIN_KEY } from '../coach/errors';
import type { AppSettings } from '../coach/types';

const settings: AppSettings = {
  garminApiKey: 'garmin-secret',
  aiProvider: 'openai',
  aiApiKey: 'sk-secret',
  aiModel: 'gpt-4o-mini',
  serverUrl: 'http://10.0.2.2:8000',
};

async function setup(overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) {
  const onSave = jest.fn(async (_next: AppSettings) => {});
  const onTestConnection = jest.fn(async (_next: AppSettings) => ({
    ok: true,
    message: 'Connected to the Garmin MCP server at http://10.0.2.2:8000 — 6 read-only tools available.',
  }));
  const onBack = jest.fn();
  await render(
    <SettingsScreen
      settings={settings}
      onSave={onSave}
      onTestConnection={onTestConnection}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { onSave, onTestConnection, onBack };
}

describe('SettingsScreen', () => {
  it('accepts the Garmin key, AI provider, AI key, AI model and server address', async () => {
    const { onSave } = await setup();

    await fireEvent.changeText(await screen.findByLabelText('Garmin personal API key'), 'new-garmin-key');
    await fireEvent.press(screen.getByLabelText('AI provider: anthropic'));
    await fireEvent.changeText(screen.getByLabelText('AI API key'), 'new-ai-key');
    await fireEvent.changeText(screen.getByLabelText('AI model'), 'claude-3-5-sonnet-latest');
    await fireEvent.changeText(screen.getByLabelText('Garmin MCP server address'), 'http://192.168.1.20:8000');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        garminApiKey: 'new-garmin-key',
        aiProvider: 'anthropic',
        aiApiKey: 'new-ai-key',
        aiModel: 'claude-3-5-sonnet-latest',
        serverUrl: 'http://192.168.1.20:8000',
      }),
    );
  });

  it('shows the stored values, including the default server address', async () => {
    await setup({ settings: { ...settings, serverUrl: 'http://10.0.2.2:8000' } });

    expect(await screen.findByDisplayValue('http://10.0.2.2:8000')).toBeTruthy();
    expect(screen.getByDisplayValue('garmin-secret')).toBeTruthy();
    expect(screen.getByDisplayValue('gpt-4o-mini')).toBeTruthy();
  });

  it('says the Garmin key is needed when Test connection runs without one', async () => {
    const { onTestConnection } = await setup({ settings: { ...settings, garminApiKey: '' } });

    await fireEvent.press(await screen.findByText('Test connection'));

    expect(await screen.findByText(MISSING_GARMIN_KEY)).toBeTruthy();
    expect(onTestConnection).not.toHaveBeenCalled();
  });

  it('reports the server address and read-only tool count when the server is reachable', async () => {
    await setup();

    await fireEvent.press(await screen.findByText('Test connection'));

    expect(
      await screen.findByText('Connected to the Garmin MCP server at http://10.0.2.2:8000 — 6 read-only tools available.'),
    ).toBeTruthy();
  });

  it('reports a plain-language error when the server cannot be reached', async () => {
    await setup({
      onTestConnection: jest.fn(async () => ({
        ok: false,
        message: 'Could not reach the Garmin MCP server at http://192.168.1.9:8000. Check that it is running and try again.',
      })),
    });

    await fireEvent.changeText(await screen.findByLabelText('Garmin MCP server address'), 'http://192.168.1.9:8000');
    await fireEvent.press(screen.getByText('Test connection'));

    expect(
      await screen.findByText(
        'Could not reach the Garmin MCP server at http://192.168.1.9:8000. Check that it is running and try again.',
      ),
    ).toBeTruthy();
  });

  it('goes back to the coach screen', async () => {
    const { onBack } = await setup();

    await fireEvent.press(await screen.findByLabelText('Back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});