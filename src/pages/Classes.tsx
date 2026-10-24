import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Progress, Table, Tag } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClasses, type ClassRow } from '../api';
import { useUser } from '../auth/AuthContext';
import { isManagement, isTeacherOnly } from '../auth/permissions';
import { ClassFormModal } from '../components/ClassFormModal';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { weekdaysLabel } from '../domain/schedule';
import { SLOTS } from '../mock/db';

export function ClassesPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [form, setForm] = useState<{ open: boolean; editing: ClassRow | null }>({ open: false, editing: null });
  const manage = isManagement(user.roles);
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  const rows = (classes.data ?? []).filter((c) => !isTeacherOnly(user.roles) || c.teacherId === user.id);

  return (
    <div className="fade-in">
      <PageHeader
        title="Lớp học"
        subtitle={isTeacherOnly(user.roles) ? 'Các lớp bạn được phân công.' : 'Lịch, phòng, ca, nhân sự và sĩ số của từng lớp.'}
        extra={
          manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ open: true, editing: null })}>
              Thêm lớp
            </Button>
          )
        }
      />
      <ClassFormModal open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
      <Table<ClassRow>
        rowKey="id"
        loading={classes.isLoading}
        dataSource={rows}
        pagination={TABLE_PAGINATION}
        scroll={{ x: 820 }}
        onRow={(r) => ({ onClick: () => navigate(`/lop-hoc/${r.id}`), style: { cursor: 'pointer' } })}
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
          ...(manage
            ? [
                {
                  title: '',
                  width: 70,
                  render: (_: unknown, r: ClassRow) => (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ open: true, editing: r });
                      }}
                    >
                      Sửa
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

    </div>
  );
}
