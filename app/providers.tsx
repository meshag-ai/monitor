'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const theme = createTheme({
  primaryColor: 'blue',
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
