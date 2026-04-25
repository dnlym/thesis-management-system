import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutDashboard, ListChecks, UserCircle } from 'lucide-react-native';
import { SyncOverlay } from '@/components/sync-overlay';
import { useSync } from '@/hooks/use-sync';

const BLUE = '#2563eb';

export default function TabLayout() {
  const { status, pendingCount, sync } = useSync();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: BLUE,
          tabBarInactiveTintColor: '#9ca3af',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#f1f5f9',
            borderTopWidth: 1,
            height: 62,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="assigned"
          options={{
            title: 'Đề tài',
            tabBarIcon: ({ color }) => <ListChecks size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Cá nhân',
            tabBarIcon: ({ color }) => <UserCircle size={24} color={color} />,
          }}
        />
      </Tabs>
      <SyncOverlay status={status} pendingCount={pendingCount} onRetry={sync} />
    </>
  );
}
