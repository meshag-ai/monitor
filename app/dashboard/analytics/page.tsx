'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Select,
  Grid,
  Card,
  Text,
  Group,
  Table,
  Badge,
  LoadingOverlay,
  Stack,
} from '@mantine/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { notifications } from '@mantine/notifications';

interface Connection {
  id: string;
  name: string;
}

interface AnalyticsData {
  totalQueries: string;
  avgExecutionTime: number;
  slowQueries: number;
  mostFrequent: any[];
  slowest: any[];
  tablePatterns: any[];
  indexUsage: any[];
}

export default function AnalyticsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/connections')
      .then((res) => res.json())
      .then((data) => {
        setConnections(data);
        if (data.length > 0 && !selectedConnection) {
          setSelectedConnection(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      setLoading(true);
      fetch(`/api/analytics/${selectedConnection}`)
        .then((res) => res.json())
        .then((data) => {
          setAnalytics(data);
          setLoading(false);
        })
        .catch(() => {
          notifications.show({
            title: 'Error',
            message: 'Failed to load analytics',
            color: 'red',
          });
          setLoading(false);
        });
    }
  }, [selectedConnection]);

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Analytics</Title>
        <Select
          placeholder="Select connection"
          data={connections.map((c) => ({ value: c.id, label: c.name }))}
          value={selectedConnection}
          onChange={(value) => setSelectedConnection(value)}
          style={{ width: 300 }}
        />
      </Group>

      {loading && <LoadingOverlay visible />}

      {analytics && selectedConnection && (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="xs">Total Queries</Text>
              <Text size="xl" fw={700}>
                {Number(analytics.totalQueries).toLocaleString()}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="xs">Avg Execution Time</Text>
              <Text size="xl" fw={700}>
                {analytics.avgExecutionTime.toFixed(2)} ms
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="xs">Slow Queries</Text>
              <Text size="xl" fw={700} c="red">
                {analytics.slowQueries}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="md">Most Frequent Queries</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Query</Table.Th>
                    <Table.Th>Executions</Table.Th>
                    <Table.Th>Avg Time</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analytics.mostFrequent.slice(0, 5).map((q: any) => (
                    <Table.Tr key={q.id}>
                      <Table.Td>
                        <Text size="xs" lineClamp={1} style={{ maxWidth: 300 }}>
                          {q.queryText}
                        </Text>
                      </Table.Td>
                      <Table.Td>{Number(q.executionCount).toLocaleString()}</Table.Td>
                      <Table.Td>{q.avgExecutionTimeMs.toFixed(2)} ms</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="md">Slowest Queries</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Query</Table.Th>
                    <Table.Th>Executions</Table.Th>
                    <Table.Th>Avg Time</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analytics.slowest.slice(0, 5).map((q: any) => (
                    <Table.Tr key={q.id}>
                      <Table.Td>
                        <Text size="xs" lineClamp={1} style={{ maxWidth: 300 }}>
                          {q.queryText}
                        </Text>
                      </Table.Td>
                      <Table.Td>{Number(q.executionCount).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Badge color="red">{q.avgExecutionTimeMs.toFixed(2)} ms</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="md">Table Access Patterns</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Table</Table.Th>
                    <Table.Th>Access Count</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analytics.tablePatterns.slice(0, 10).map((t: any) => (
                    <Table.Tr key={t.id}>
                      <Table.Td>{t.tableName}</Table.Td>
                      <Table.Td>{Number(t.accessCount).toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text size="lg" fw={500} mb="md">Index Usage</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Table</Table.Th>
                    <Table.Th>Index</Table.Th>
                    <Table.Th>Scans</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analytics.indexUsage.slice(0, 10).map((idx: any) => (
                    <Table.Tr key={idx.id}>
                      <Table.Td>{idx.tableName}</Table.Td>
                      <Table.Td>{idx.indexName}</Table.Td>
                      <Table.Td>{Number(idx.scans).toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {!analytics && !loading && (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text ta="center" c="dimmed" size="lg">
            Select a connection to view analytics
          </Text>
        </Card>
      )}
    </Container>
  );
}
