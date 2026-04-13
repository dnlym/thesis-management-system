import { Card, Empty } from 'antd';
import { useTranslation } from 'react-i18next';

const Messages = () => {
    const { t } = useTranslation();

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-foreground mb-6">{t('navigation.messages')}</h1>
            <Card className="shadow-soft">
                <Empty description="Tính năng tin nhắn đang được phát triển" />
            </Card>
        </div>
    );
};

export default Messages;
