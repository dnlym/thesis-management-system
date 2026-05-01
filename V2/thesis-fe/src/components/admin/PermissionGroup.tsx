import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface PermissionGroupProps {
  title: string;
  permissions: Permission[];
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onToggleAll: (codes: string[], checked: boolean) => void;
}

const PermissionGroup: React.FC<PermissionGroupProps> = ({
  title,
  permissions,
  selectedCodes,
  onToggle,
  onToggleAll,
}) => {
  const allCodes = permissions.map((p) => p.code);
  const isAllSelected = allCodes.every((code) => selectedCodes.includes(code));
  const isSomeSelected = allCodes.some((code) => selectedCodes.includes(code)) && !isAllSelected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between bg-muted/30 px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`toggle-all-${title}`}
            checked={isAllSelected}
            onCheckedChange={(checked) => onToggleAll(allCodes, !!checked)}
            className="h-4 w-4"
          />
          <Label
            htmlFor={`toggle-all-${title}`}
            className="text-[11px] font-bold uppercase cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            Chọn tất cả
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {permissions.map((permission) => (
          <div
            key={permission.code}
            className="flex items-start space-x-3 rounded-lg border border-transparent p-2 hover:border-border/50 hover:bg-muted/20 transition-all group"
          >
            <Checkbox
              id={permission.code}
              checked={selectedCodes.includes(permission.code)}
              onCheckedChange={() => onToggle(permission.code)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor={permission.code}
                className="text-[13px] font-bold leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-primary transition-colors"
              >
                {permission.name}
              </Label>
              {permission.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                  {permission.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PermissionGroup;
