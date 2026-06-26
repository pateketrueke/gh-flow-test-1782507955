import { describe, it, expect } from 'vitest';
import { createAppearanceConfig } from './appearance-config.js';

describe('createAppearanceConfig', () => {
  it('returns light theme tokens by default', () => {
    const config = createAppearanceConfig('light');
    expect(config.colors.background).toBe('#ffffff');
    expect(config.colors.text).toBe('#1a1a1a');
  });

  it('returns dark theme tokens', () => {
    const config = createAppearanceConfig('dark');
    expect(config.colors.background).toBe('#1a1a1a');
    expect(config.colors.text).toBe('#ffffff');
  });

  it('both themes share the same font family', () => {
    const light = createAppearanceConfig('light');
    const dark = createAppearanceConfig('dark');
    expect(light.fonts.family).toBe(dark.fonts.family);
  });
});
