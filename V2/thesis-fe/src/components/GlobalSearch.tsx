import React from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface GlobalSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
  size?: 'small' | 'middle' | 'large';
  loading?: boolean;
}

/**
 * Component Search dùng chung cho toàn hệ thống.
 * Đảm bảo tính đồng nhất về UI/UX và placeholders.
 */
const GlobalSearch: React.FC<GlobalSearchProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
  allowClear = true,
  size = "middle",
  loading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Input
      prefix={<SearchOutlined className="text-slate-400" />}
      placeholder={placeholder || t('common.searchPlaceholder') || "Tìm theo tên, mã, sinh viên..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      allowClear={allowClear}
      size={size}
      className={`rounded-lg border-slate-200 shadow-sm focus:border-blue-400 transition-all ${className}`}
      disabled={loading}
    />
  );
};

export default GlobalSearch;
