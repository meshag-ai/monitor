'use client';

import { AppShell, NavLink, Group, Text } from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  IconDatabase,
  IconChartBar,
  IconBulb,
} from '@tabler/icons-react';
import '@mantine/core/styles.css';

const navItems = [
  { icon: IconDatabase, label: 'Connections', href: '/dashboard/connections' },
  { icon: IconChartBar, label: 'Analytics', href: '/dashboard/analytics' },
  { icon: IconBulb, label: 'Suggestions', href: '/dashboard/suggestions' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <AppShell
      navbar={{
        width: 250,
        breakpoint: 'sm',
      }}
      padding="md"
    >
      <AppShell.Navbar p="md">
        <AppShell.Section>
          <Text size="xl" fw={700} mb="xl">
            PlotWeft
          </Text>
        </AppShell.Section>
        <AppShell.Section grow>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                leftSection={<Icon size="1rem" stroke={1.5} />}
                active={pathname === item.href}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                }}
                mb="xs"
              />
            );
          })}
        </AppShell.Section>
        <AppShell.Section>
          <Group justify="center">
            <UserButton />
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
