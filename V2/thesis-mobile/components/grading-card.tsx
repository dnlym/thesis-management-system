import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, Users, Clock } from 'lucide-react-native';
import { RoleBadge, RoleType } from './role-badge';
import { StatusBadge, StatusType } from './status-badge';

interface GradingCardProps {
    topicTitle: string;
    groupName: string;
    role: RoleType;
    status: StatusType;
    timeSlot?: string;
    studentCount: number;
    onPress: () => void;
    committeeProgress?: { total: number; completed: number };
}

export const GradingCard = ({
    topicTitle,
    groupName,
    role,
    status,
    timeSlot,
    studentCount,
    onPress,
    committeeProgress,
}: GradingCardProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="bg-white rounded-xl mb-3 border border-gray-100 overflow-hidden"
            style={{ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }}
        >
            {/* Top: group name + role + status */}
            <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
                <Text className="font-bold text-gray-900 text-sm">{groupName}</Text>
                <View className="flex-row items-center gap-2">
                    <RoleBadge role={role} />
                    <ChevronRight size={16} color="#d1d5db" />
                </View>
            </View>

            {/* Topic title */}
            <Text className="text-gray-500 text-xs px-4 mb-2 leading-4" numberOfLines={2}>
                {topicTitle}
            </Text>

            {/* Bottom: Meta + Status */}
            <View className="flex-row items-center justify-between bg-gray-50 px-4 py-2 border-t border-gray-100">
                <View className="flex-row items-center gap-3">
                    {timeSlot && (
                        <View className="flex-row items-center">
                            <Clock size={12} color="#9ca3af" />
                            <Text className="text-gray-400 text-[10px] ml-1">{timeSlot}</Text>
                        </View>
                    )}
                    {committeeProgress && (
                        <View className="flex-row items-center">
                            <Users size={12} color="#9ca3af" />
                            <Text className="text-gray-400 text-[10px] ml-1">{committeeProgress.completed}/{committeeProgress.total}</Text>
                        </View>
                    )}
                </View>
                <StatusBadge status={status} />
            </View>
        </TouchableOpacity>
    );
};
