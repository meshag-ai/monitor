'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Open Sans, sans-serif',
  fontFamilyMonospace: 'Open Sans, sans-serif',
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <MantineProvider theme={theme}>
        <Notifications />
        {children}
      </MantineProvider>
    </ClerkProvider>
  );
}
