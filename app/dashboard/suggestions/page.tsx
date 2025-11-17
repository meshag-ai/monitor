'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Select,
  Button,
  Card,
  Text,
  Group,
  Badge,
  Stack,
  ActionIcon,
  LoadingOverlay,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBulb, IconCheck, IconX } from '@tabler/icons-react';

interface Connection {
  id: string;
  name: string;
}

interface Suggestion {
  id: string;
  suggestionText: string;
  suggestionType: string;
  priority: string;
  status: string;
  createdAt: string;
  queryExecution: {
    id: string;
    queryText: string;
  } | null;
}

export default function SuggestionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

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
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);

      fetch(`/api/suggestions/${selectedConnection}?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data);
          setLoading(false);
        })
        .catch(() => {
          notifications.show({
            title: 'Error',
            message: 'Failed to load suggestions',
            color: 'red',
          });
          setLoading(false);
        });
    }
  }, [selectedConnection, filterStatus, filterPriority]);

  const handleGenerate = async () => {
    if (!selectedConnection) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/suggestions/${selectedConnection}/generate`, {
        method: 'POST',
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Suggestion generation started',
          color: 'green',
        });
        setTimeout(() => {
          if (selectedConnection) {
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            if (filterPriority) params.append('priority', filterPriority);
            fetch(`/api/suggestions/${selectedConnection}?${params.toString()}`)
              .then((res) => res.json())
              .then((data) => setSuggestions(data));
          }
        }, 5000);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to generate suggestions',
        color: 'red',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s))
        );

        notifications.show({
          title: 'Success',
          message: 'Suggestion status updated',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to update suggestion',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update suggestion',
        color: 'red',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'red';
      case 'MEDIUM':
        return 'yellow';
      case 'LOW':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'blue';
      case 'REVIEWED':
        return 'yellow';
      case 'APPLIED':
        return 'green';
      case 'DISMISSED':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Optimization Suggestions</Title>
        <Group>
          <Select
            placeholder="Select connection"
            data={connections.map((c) => ({ value: c.id, label: c.name }))}
            value={selectedConnection}
            onChange={(value) => setSelectedConnection(value)}
            style={{ width: 300 }}
          />
          <Button
            leftSection={<IconBulb size={16} />}
            onClick={handleGenerate}
            loading={generating}
            disabled={!selectedConnection}
          >
            Generate Suggestions
          </Button>
        </Group>
      </Group>

      {selectedConnection && (
        <Group mb="md">
          <Select
            placeholder="Filter by status"
            data={[
              { value: 'NEW', label: 'New' },
              { value: 'REVIEWED', label: 'Reviewed' },
              { value: 'APPLIED', label: 'Applied' },
              { value: 'DISMISSED', label: 'Dismissed' },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
          />
          <Select
            placeholder="Filter by priority"
            data={[
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
            value={filterPriority}
            onChange={setFilterPriority}
            clearable
          />
        </Group>
      )}

      {loading && <LoadingOverlay visible />}

      <Stack gap="md">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Group>
                <Badge color={getPriorityColor(suggestion.priority)}>
                  {suggestion.priority}
                </Badge>
                <Badge color={getStatusColor(suggestion.status)}>
                  {suggestion.status}
                </Badge>
                <Badge variant="light">{suggestion.suggestionType}</Badge>
              </Group>
              <Group>
                {suggestion.status === 'NEW' && (
                  <>
                    <ActionIcon
                      color="green"
                      variant="light"
                      onClick={() => handleUpdateStatus(suggestion.id, 'APPLIED')}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="gray"
                      variant="light"
                      onClick={() => handleUpdateStatus(suggestion.id, 'DISMISSED')}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </>
                )}
              </Group>
            </Group>

            <Text size="sm" mb="md" style={{ whiteSpace: 'pre-wrap' }}>
              {suggestion.suggestionText}
            </Text>

            {suggestion.queryExecution && (
              <Card withBorder p="xs" mb="md">
                <Text size="xs" c="dimmed" mb="xs">Related Query:</Text>
                <Text size="xs" style={{ fontFamily: 'monospace' }}>
                  {suggestion.queryExecution.queryText.substring(0, 200)}
                  {suggestion.queryExecution.queryText.length > 200 ? '...' : ''}
                </Text>
              </Card>
            )}

            <Text size="xs" c="dimmed">
              Created: {new Date(suggestion.createdAt).toLocaleString()}
            </Text>
          </Card>
        ))}
      </Stack>

      {!loading && suggestions.length === 0 && (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text ta="center" c="dimmed" size="lg">
            {selectedConnection
              ? 'No suggestions found. Click "Generate Suggestions" to get started.'
              : 'Select a connection to view suggestions'}
          </Text>
        </Card>
      )}
    </Container>
  );
}
