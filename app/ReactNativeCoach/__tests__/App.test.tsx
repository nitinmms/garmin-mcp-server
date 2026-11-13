/**
 * @format
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import App from '../App';

describe('App', () => {
  it('renders the coach screen with a Settings link after loading the saved settings', async () => {
    await render(<App />);

    expect(await screen.findByText('What should I ride today?')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});