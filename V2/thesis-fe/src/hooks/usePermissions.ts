import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionsApi } from '@/api/permissions';
import { notify } from '@/utils/notification';
import { PermissionMatrix } from '@/types';

export const usePermissions = () => {
    const queryClient = useQueryClient();

    const matrixQuery = useQuery<PermissionMatrix>({
        queryKey: ['permission-matrix'],
        queryFn: () => PermissionsApi.getMatrix(),
    });

    const updateMutation = useMutation({
        mutationFn: ({ role, permissionIds }: { role: string; permissionIds: string[] }) =>
            PermissionsApi.updateRolePermissions(role, permissionIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
            notify.success('Cập nhật phân quyền thành công');
        },
        onError: (error: any) => {
            notify.error(error.message || 'Không thể cập nhật phân quyền');
        },
    });

    const seedMutation = useMutation({
        mutationFn: () => PermissionsApi.seed(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
            notify.success('Đã khởi tạo dữ liệu mẫu phân quyền');
        },
        onError: (error: any) => {
            notify.error(error.message || 'Không thể khởi tạo dữ liệu');
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
