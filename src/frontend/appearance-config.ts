export type Theme = 'light' | 'dark';

export type AppearanceTokens = {
  colors: {
    primary: string;
    background: string;
    text: string;
  };
  fonts: {
    family: string;
    size: string;
  };
  spacing: string;
};

export function createAppearanceConfig(theme: Theme): AppearanceTokens {
  const light: AppearanceTokens = {
    colors: { primary: '#0066cc', background: '#ffffff', text: '#1a1a1a' },
    fonts: { family: 'Inter, sans-serif', size: '14px' },
    spacing: '12px',
  };

  const dark: AppearanceTokens = {
    colors: { primary: '#3399ff', background: '#1a1a1a', text: '#ffffff' },
    fonts: { family: 'Inter, sans-serif', size: '14px' },
    spacing: '12px',
  };

  return theme === 'dark' ? dark : light;
}
