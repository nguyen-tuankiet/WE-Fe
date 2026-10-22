import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  MinusCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Tag } from 'antd';
import type { AttendanceStatus, Rating } from '../domain/types';
import { ATTENDANCE_COLOR, ATTENDANCE_LABEL, RATING_COLOR, RATING_LABEL } from '../i18n/vi';

/** Trạng thái luôn có nhãn chữ + màu + biểu tượng, không phụ thuộc riêng vào màu. */
export function AttendanceTag({ status }: { status: AttendanceStatus | 'none' }) {
  const icon = {
    present: <CheckCircleFilled />,
    late: <ClockCircleFilled />,
    absent: <CloseCircleFilled />,
    none: <MinusCircleFilled />,
  }[status];
  return (
    <Tag color={ATTENDANCE_COLOR[status]} icon={icon}>
      {ATTENDANCE_LABEL[status]}
    </Tag>
  );
}

export function RatingTag({ rating }: { rating: Rating }) {
  const icon = rating === 'good' ? <CheckCircleFilled /> : rating === 'average' ? <ExclamationCircleFilled /> : <CloseCircleFilled />;
  return (
    <Tag color={RATING_COLOR[rating]} icon={icon}>
      {RATING_LABEL[rating]}
    </Tag>
  );
}

export function LabelTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <Tag color={color}>{children}</Tag>;
}
