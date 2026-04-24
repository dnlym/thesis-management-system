import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionsApi } from '@/api/permissions';
import { useToast } from './use-toast';

export const usePermissions = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const matrixQuery = useQuery({
        queryKey: ['permission-matrix'],
        queryFn: () => PermissionsApi.getMatrix(),
    });

    const updateMutation = useMutation({
        mutationFn: ({ role, permissionIds }: { role: string; permissionIds: string[] }) =>
            PermissionsApi.updateRolePermissions(role, permissionIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
            toast({
                title: 'Thành công',
                description: 'Cập nhật phân quyền thành công',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Lỗi',
                description: error.message || 'Không thể cập nhật phân quyền',
                variant: 'destructive',
            });
        },
    });

    const seedMutation = useMutation({
        mutationFn: () => PermissionsApi.seed(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
            toast({
                title: 'Thành công',
                description: 'Đã khởi tạo dữ liệu mẫu phân quyền',
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Lỗi',
                description: error.message || 'Không thể khởi tạo dữ liệu',
                variant: 'destructive',
            });
        },
    });

    return {
        matrix: matrixQuery.data,
        isLoading: matrixQuery.isLoading,
        updatePermissions: updateMutation.mutate,
        isUpdating: updateMutation.isPending,
        seedPermissions: seedMutation.mutate,
        isSeeding: seedMutation.isPending,
    };
};
