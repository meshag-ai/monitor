'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Button,
  Grid,
  Card,
  Text,
  Badge,
  Group,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  NumberInput,
  Stack,
  Tabs,
  List,
  ThemeIcon,
  Accordion,
  Code,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';

interface Connection {
  id: string;
  name: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  pollingIntervalMinutes: number;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      dbType: 'POSTGRES',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      pollingIntervalMinutes: 5,
    },
    validate: {
      name: (value) => (value.length < 1 ? 'Name is required' : null),
      host: (value) => (value.length < 1 ? 'Host is required' : null),
      database: (value) => (value.length < 1 ? 'Database is required' : null),
      username: (value) => (value.length < 1 ? 'Username is required' : null),
      password: (value) => (value.length < 1 ? 'Password is required' : null),
    },
  });

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch connections',
        color: 'red',
      });
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleTest = async () => {
    if (!form.validate().hasErrors) {
      setTesting(true);
      try {
        const response = await fetch('/api/connections/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form.values),
        });

        if (response.ok) {
          notifications.show({
            title: 'Success',
            message: 'Connection test successful',
            color: 'green',
          });
        } else {
          notifications.show({
            title: 'Error',
            message: 'Connection test failed',
            color: 'red',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Connection test failed',
          color: 'red',
        });
      } finally {
        setTesting(false);
      }
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Connection created successfully',
          color: 'green',
        });
        setOpened(false);
        form.reset();
        fetchConnections();
      } else {
        const error = await response.json();
        notifications.show({
          title: 'Error',
          message: error.error || 'Failed to create connection',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to create connection',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    try {
      const response = await fetch(`/api/connections/${id}/sync`, {
        method: 'POST',
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Sync started',
          color: 'green',
        });
        fetchConnections();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to sync',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Connection deleted',
          color: 'green',
        });
        fetchConnections();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete connection',
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'ERROR':
        return 'red';
      case 'TESTING':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Connections</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setOpened(true)}
        >
          Add Connection
        </Button>
      </Group>

      <Grid>
        {connections.map((conn) => (
          <Grid.Col key={conn.id} span={{ base: 12, sm: 6, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text fw={500}>{conn.name}</Text>
                <Badge color={getStatusColor(conn.status)}>{conn.status}</Badge>
              </Group>

              <Text size="sm" c="dimmed" mb="xs">
                {conn.dbType} - {conn.host}:{conn.port}
              </Text>
              <Text size="sm" c="dimmed" mb="md">
                Database: {conn.database}
              </Text>

              {conn.lastSyncedAt && (
                <Text size="xs" c="dimmed" mb="md">
                  Last synced: {new Date(conn.lastSyncedAt).toLocaleString()}
                </Text>
              )}

              <Group justify="flex-end">
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={() => handleSync(conn.id)}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(conn.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {connections.length === 0 && (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text ta="center" c="dimmed" size="lg">
            No connections yet. Click "Add Connection" to get started.
          </Text>
        </Card>
      )}

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          form.reset();
        }}
        title="Add Connection"
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Tabs defaultValue="form">
            <Tabs.List>
              <Tabs.Tab value="form">Connection Details</Tabs.Tab>
              <Tabs.Tab value="instructions">Setup Instructions</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="form" pt="md">
              <Stack>
                <TextInput
                  label="Name"
                  placeholder="My Database"
                  required
                  {...form.getInputProps('name')}
                />

                <Select
                  label="Database Type"
                  data={[
                    { value: 'POSTGRES', label: 'PostgreSQL' },
                    { value: 'MYSQL', label: 'MySQL' },
                  ]}
                  required
                  {...form.getInputProps('dbType')}
                />

                <TextInput
                  label="Host"
                  placeholder="localhost"
                  required
                  {...form.getInputProps('host')}
                />

                <NumberInput
                  label="Port"
                  placeholder="5432"
                  required
                  {...form.getInputProps('port')}
                />

                <TextInput
                  label="Database"
                  placeholder="mydb"
                  required
                  {...form.getInputProps('database')}
                />

                <TextInput
                  label="Username"
                  placeholder="postgres"
                  required
                  {...form.getInputProps('username')}
                />

                <TextInput
                  label="Password"
                  type="password"
                  required
                  {...form.getInputProps('password')}
                />

                <NumberInput
                  label="Polling Interval (minutes)"
                  min={1}
                  required
                  {...form.getInputProps('pollingIntervalMinutes')}
                />

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="light"
                    onClick={handleTest}
                    loading={testing}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" loading={loading}>
                    Create Connection
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="instructions" pt="md">
              <Accordion defaultValue="postgres">
                <Accordion.Item value="postgres">
                  <Accordion.Control>PostgreSQL Setup</Accordion.Control>
                  <Accordion.Panel>
                    <Stack>
                      <Text size="sm">Follow these steps to configure your PostgreSQL database for monitoring:</Text>
                      <List spacing="xs" size="sm" type="ordered">
                        <List.Item>
                          <strong>Enable pg_stat_statements extension</strong>
                          <Text size="sm" c="dimmed">This extension tracks execution statistics of all SQL statements.</Text>
                          <Code block>CREATE EXTENSION IF NOT EXISTS pg_stat_statements;</Code>
                        </List.Item>
                        <List.Item>
                          <strong>Create a read-only user</strong>
                          <Text size="sm" c="dimmed">This user needs specific grants to read performance data.</Text>
                          <Code block>{`CREATE USER monitoring_user WITH PASSWORD 'your_secure_password';
GRANT CONNECT ON DATABASE your_db TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON pg_stat_statements TO monitoring_user;`}</Code>
                        </List.Item>
                        <List.Item>
                          <strong>Whitelist our IP addresses</strong>
                          <Text size="sm" c="dimmed">Ensure your firewall and `pg_hba.conf` file allow connections from our servers.</Text>
                        </List.Item>
                      </List>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="mysql">
                  <Accordion.Control>MySQL Setup</Accordion.Control>
                  <Accordion.Panel>
                    <Stack>
                      <Text size="sm">Follow these steps to configure your MySQL database for monitoring:</Text>
                      <List spacing="xs" size="sm" type="ordered">
                        <List.Item>
                          <strong>Enable Performance Schema</strong>
                          <Text size="sm" c="dimmed">This feature collects performance data.</Text>
                          <Code block>SET GLOBAL performance_schema = ON;</Code>
                        </List.Item>
                        <List.Item>
                          <strong>Create a read-only user</strong>
                          <Text size="sm" c="dimmed">This user needs SELECT privileges to read performance data.</Text>
                          <Code block>{`CREATE USER 'monitoring_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT SELECT ON *.* TO 'monitoring_user'@'%';
FLUSH PRIVILEGES;`}</Code>
                        </List.Item>
                        <List.Item>
                          <strong>Whitelist our IP addresses</strong>
                          <Text size="sm" c="dimmed">Ensure your firewall allows connections from our servers.</Text>
                        </List.Item>
                      </List>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Tabs.Panel>
          </Tabs>
        </form>
      </Modal>
    </Container>
  );
}
