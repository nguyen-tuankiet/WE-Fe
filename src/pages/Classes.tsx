import { useQuery } from '@tanstack/react-query';
import { Descriptions, Drawer, Progress, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getClassDetail, listClasses, type ClassRow } from '../api';
import { useUser } from '../auth/AuthContext';
import { isTeacherOnly } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { weekdaysLabel } from '../domain/schedule';
import { SLOTS } from '../mock/db';
import { fmtDate } from '../i18n/vi';

export function ClassesPage() {
  const user = useUser();
  const [openId, setOpenId] = useState<string | null>(null);
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const detail = useQuery({ queryKey: ['class', openId], queryFn: () => getClassDetail(openId!), enabled: !!openId });

  const rows = (classes.data ?? []).filter((c) => !isTeacherOnly(user.roles) || c.teacherId === user.id);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lớp học"
        subtitle={isTeacherOnly(user.roles) ? 'Các lớp bạn được phân công.' : 'Lịch, phòng, ca, nhân sự và sĩ số của từng lớp.'}
      />
      <Table<ClassRow>
        rowKey="id"
        loading={classes.isLoading}
        dataSource={rows}
        pagination={TABLE_PAGINATION}
        scroll={{ x: 820 }}
        onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Lớp', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
          { title: 'Môn', dataIndex: 'subject' },
          { title: 'Ngày học', render: (_, r) => weekdaysLabel(r.weekdays) },
          {
            title: 'Ca',
            render: (_, r) => {
              const s = SLOTS.find((x) => x.id === r.slotId);
              return `${s?.label} · ${s?.time}`;
            },
          },
          { title: 'Phòng', dataIndex: 'room', width: 80 },
          { title: 'Giáo viên', dataIndex: 'teacherName' },
          { title: 'Trợ giảng', dataIndex: 'assistant', render: (v) => v || '—' },
          {
            title: 'Sĩ số',
            width: 150,
            render: (_, r) => (
              <Progress percent={Math.round((r.studentCount / r.maxSize) * 100)} size="small" format={() => `${r.studentCount}/${r.maxSize}`} />
            ),
          },
          { title: 'Trạng thái', render: (_, r) => (r.active ? <Tag color="success">Hoạt động</Tag> : <Tag>Ngừng</Tag>), width: 110 },
        ]}
      />

      <Drawer
        title={detail.data?.cls.name ?? 'Lớp học'}
        size={560}
        open={!!openId}
        onClose={() => setOpenId(null)}
        loading={detail.isLoading}
      >
        {detail.data && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Giáo viên">{detail.data.teacherName}</Descriptions.Item>
              <Descriptions.Item label="Phòng">{detail.data.cls.room}</Descriptions.Item>
              <Descriptions.Item label="Ngày học">{weekdaysLabel(detail.data.cls.weekdays)}</Descriptions.Item>
              <Descriptions.Item label="Trợ giảng">{detail.data.cls.assistant || '—'}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>Học viên ({detail.data.students.length})</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Mỗi học viên có ngày bắt đầu và số buổi còn lại riêng nên ngày hết khóa khác nhau; học viên cùng lớp có thể khác trình độ.
            </Typography.Paragraph>
            <Table
              size="small"
              rowKey={(r) => r.enrollment.id}
              dataSource={detail.data.students}
              pagination={false}
              columns={[
                { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.student.id}`}>{r.student.name}</Link> },
                { title: 'Chương trình', render: (_, r) => r.program.name },
                { title: 'Còn lại', render: (_, r) => `${r.progress.remaining} buổi` },
                { title: 'Hết khóa', render: (_, r) => fmtDate(r.progress.endDate) },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
