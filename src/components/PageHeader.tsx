import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { BRAND } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, extra, icon }: Props) {
  return (
    <Flex justify="space-between" align="flex-start" wrap gap={12} style={{ marginBottom: 16 }}>
      <Flex gap={14} align="center">
        {icon && (
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              flex: 'none',
              borderRadius: 14,
              background: BRAND.redSoft,
              color: BRAND.red,
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </div>
      </Flex>
      {extra && (
        <Flex gap={8} wrap className="no-print">
          {extra}
        </Flex>
      )}
    </Flex>
  );
}
