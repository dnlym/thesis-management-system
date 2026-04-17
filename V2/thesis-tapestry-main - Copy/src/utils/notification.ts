import { App } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { MessageInstance } from 'antd/es/message/interface';

let notification: NotificationInstance;
let message: MessageInstance;

/**
 * Component này dùng để 'bắt' lấy instance của Ant Design App 
 * và gán vào biến static để sử dụng ở bất cứ đâu (kể cả ngoài React).
 */
export const StaticNotificationHandler = () => {
    const staticFunction = App.useApp();
    notification = staticFunction.notification;
    message = staticFunction.message;
    return null;
};

interface NotificationArgs {
    message: string;
    description?: React.ReactNode;
    duration?: number;
    placement?: any;
    className?: string;
    onClick?: () => void;
    onClose?: () => void;
    icon?: React.ReactNode;
}

export const notify = {
    success: (arg: string | NotificationArgs, desc?: string) => {
        if (typeof arg === 'string') {
            notification?.success({
                message: arg,
                description: desc,
                placement: 'topRight',
                className: 'modern-notification success',
                duration: 4,
            });
        } else {
            notification?.success({
                ...arg,
                placement: arg.placement || 'topRight',
                className: arg.className || 'modern-notification success',
                duration: arg.duration || 4,
            });
        }
    },
    error: (arg: string | NotificationArgs, desc?: string) => {
        if (typeof arg === 'string') {
            notification?.error({
                message: arg,
                description: desc,
                placement: 'topRight',
                className: 'modern-notification error',
                duration: 5,
            });
        } else {
            notification?.error({
                ...arg,
                placement: arg.placement || 'topRight',
                className: arg.className || 'modern-notification error',
                duration: arg.duration || 5,
            });
        }
    },
    warning: (arg: string | NotificationArgs, desc?: string) => {
        if (typeof arg === 'string') {
            notification?.warning({
                message: arg,
                description: desc,
                placement: 'topRight',
                className: 'modern-notification warning',
            });
        } else {
            notification?.warning({
                ...arg,
                placement: arg.placement || 'topRight',
                className: arg.className || 'modern-notification warning',
            });
        }
    },
    info: (arg: string | NotificationArgs, desc?: string) => {
        if (typeof arg === 'string') {
            notification?.info({
                message: arg,
                description: desc,
                placement: 'topRight',
                className: 'modern-notification info',
            });
        } else {
            notification?.info({
                ...arg,
                placement: arg.placement || 'topRight',
                className: arg.className || 'modern-notification info',
            });
        }
    },
    // Dùng cho các thông báo dạng nhẹ (message)
    msg: {
        success: (content: string) => message?.success(content),
        error: (content: string) => message?.error(content),
        loading: (content: string) => message?.loading(content),
    }
};
