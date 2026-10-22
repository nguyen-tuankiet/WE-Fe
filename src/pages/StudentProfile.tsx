import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Descriptions, Flex, InputNumber, Progress, Row, Statistic, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStudentProfile, updateStudentStar, type EnrollmentView } from '../api';
import { useUser } from '../auth/AuthContext';
import { canSeePrivate, isManagement } from '../auth/permissions';
import { RatingTag } from '../components/StatusTag';
import {
  ENROLLMENT_STATUS_LABEL,
  RESERVE_STATUS_COLOR,
  RESERVE_STATUS_LABEL,
  STUDENT_STATUS_COLOR,
  STUDENT_STATUS_LABEL,
  fmtDate,
  fmtMoney,
  fmtPercent,
} from '../i18n/vi';
import { weekdaysLabel } from '../domain/schedule';

export function StudentProfilePage() {
  const { id = '' } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['student', id], queryFn: () => getStudentProfile(id) });
  const [star, setStar] = useState(false);
  const [red, setRed] = useState(60);
  const [good, setGood] = useState(80);

  useEffect(() => {
    if (q.data) {
      setStar(q.data.student.star);
      setRed(q.data.student.redflagBelow ?? 60);
      setGood(q.data.student.goodAbove ?? 80);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => updateStudentStar(id, { star, redflagBelow: red, goodAbove: good }),
    onSuccess: () => {
      message.success('Đã lưu ngưỡng đánh giá. Điểm gốc được giữ nguyên.');
      qc.invalidateQueries();
    },
  });

  if (!q.data) return <Card loading />;
  const { student, enrollments, reserves, exams, attendanceCount } = q.data;
  const privateOk = canSeePrivate(user.roles);
  const canEditStar = isManagement(user.roles) || user.roles.includes('inspector');

  return (
    <div className="fade-in">
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/hoc-vien')} style={{ paddingLeft: 0 }}>
        Danh sách học viên
      </Button>
      <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {student.name}
        </Typography.Title>
        <Tag>{student.code}</Tag>
        <Tag color={STUDENT_STATUS_COLOR[student.status]}>{STUDENT_STATUS_LABEL[student.status]}</Tag>
        {student.star && <Tag color="gold">★ Ngưỡng riêng</Tag>}
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Thông tin" size="small">
            <Descriptions column={{ xs: 1, md: 2 }} size="small">
              <Descriptions.Item label="Ngày sinh">{fmtDate(student.birthday)}</Descriptions.Item>
              <Descriptions.Item label="Khóa tiếp theo dự kiến">{student.nextCourse || '—'}</Descriptions.Item>
              {privateOk ? (
                <>
                  <Descriptions.Item label="Phụ huynh">{student.guardian}</Descriptions.Item>
                  <Descriptions.Item label="Điện thoại">{student.phone}</Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ">{student.address}</Descriptions.Item>
                  <Descriptions.Item label="Hình thức đóng học phí">{student.tuitionMode}</Descriptions.Item>
                  <Descriptions.Item label="Ghi chú riêng" span={2}>
                    {student.note || '—'}
                  </Descriptions.Item>
                </>
              ) : (
                <Descriptions.Item label="Liên hệ & học phí" span={2}>
                  <Typography.Text type="secondary">Chỉ Admin/Manager được xem.</Typography.Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Điểm danh (tất cả khóa)" size="small">
            <Flex gap={24} wrap>
              <Statistic title="Có mặt" value={attendanceCount.present} styles={{ content: { color: '#2e8b57' } }} />
              <Statistic title="Đi trễ" value={attendanceCount.late} styles={{ content: { color: '#fa8c18' } }} />
              <Statistic title="Vắng" value={attendanceCount.absent} styles={{ content: { color: '#d84315' } }} />
            </Flex>
          </Card>
        </Col>
      </Row>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'courses',
            label: `Khóa đăng ký (${enrollments.length})`,
            children: (
              <Table<EnrollmentView>
                rowKey={(r) => r.enrollment.id}
                dataSource={enrollments}
                pagination={false}
                scroll={{ x: 760 }}
                columns={[
                  { title: 'Chương trình', render: (_, r) => r.program.name },
                  { title: 'Lớp', render: (_, r) => `${r.cls.name} · ${weekdaysLabel(r.enrollment.weekdays)}` },
                  { title: 'Bắt đầu', render: (_, r) => fmtDate(r.enrollment.startDate) },
                  { title: 'Kết thúc dự kiến', render: (_, r) => fmtDate(r.progress.endDate) },
                  {
                    title: 'Tiến độ',
                    width: 190,
                    render: (_, r) => (
                      <div>
                        <Progress percent={Math.round((r.progress.held / Math.max(r.progress.total, 1)) * 100)} size="small" />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {r.progress.held}/{r.progress.total} buổi · còn {r.progress.remaining}
                          {r.progress.missingDates.length > 0 && ` · thiếu điểm danh ${r.progress.missingDates.length}`}
                        </Typography.Text>
                      </div>
                    ),
                  },
                  { title: 'Bù', render: (_, r) => (r.quota ? `${r.makeupUsed}/${r.quota.maxCount} × ${r.quota.minutes}'` : 'Chưa có chính sách') },
                  ...(privateOk
                    ? [{ title: 'Học phí', render: (_: unknown, r: EnrollmentView) => `${fmtMoney(r.enrollment.tuition)}${r.enrollment.tuitionReceived ? '' : ' (chưa nhận)'}` }]
                    : []),
                  { title: 'Trạng thái', render: (_, r) => ENROLLMENT_STATUS_LABEL[r.enrollment.status] },
                ]}
              />
            ),
          },
          {
            key: 'exams',
            label: `Kiểm tra (${exams.length})`,
            children: (
              <Table
                rowKey={(r) => r.result.id}
                dataSource={exams}
                pagination={false}
                locale={{ emptyText: 'Chưa có kết quả kiểm tra' }}
                columns={[
                  { title: 'Ngày', render: (_, r) => fmtDate(r.result.date) },
                  { title: 'Chương trình', render: (_, r) => r.view.program.name },
                  { title: 'Điểm tổng', render: (_, r) => fmtPercent(r.percent) },
                  { title: 'Phân loại', render: (_, r) => <RatingTag rating={r.rating} /> },
                  { title: 'Người chấm', render: (_, r) => r.result.examiner },
                  { title: '', render: () => <Link to={`/bao-cao?hv=${id}`}>Xem báo cáo</Link> },
                ]}
              />
            ),
          },
          {
            key: 'reserve',
            label: `Bảo lưu (${reserves.length})`,
            children: (
              <Table
                rowKey="id"
                dataSource={reserves}
                pagination={false}
                locale={{ emptyText: 'Chưa có hồ sơ bảo lưu' }}
                columns={[
                  { title: 'Hoàn tất thủ tục', render: (_, r) => fmtDate(r.completedOn) },
                  { title: 'Buổi còn lại', dataIndex: 'remainingSessions' },
                  ...(privateOk ? [{ title: 'Giá trị', render: (_: unknown, r: (typeof reserves)[number]) => fmtMoney(r.amount) }] : []),
                  { title: 'Trạng thái', render: (_, r) => <Tag color={RESERVE_STATUS_COLOR[r.status]}>{RESERVE_STATUS_LABEL[r.status]}</Tag> },
                  { title: 'Ghi chú', dataIndex: 'note' },
                ]}
              />
            ),
          },
          ...(canEditStar
            ? [
                {
                  key: 'star',
                  label: 'Ngưỡng đánh giá riêng',
                  children: (
                    <Card size="small">
                      <Flex vertical gap={12} style={{ maxWidth: 460 }}>
                        <Flex align="center" gap={10}>
                          <Switch checked={star} onChange={setStar} />
                          <span>Bật dấu sao — áp dụng ngưỡng cá nhân cho học viên nhỏ hoặc yếu</span>
                        </Flex>
                        <Flex gap={12} wrap>
                          <label>
                            Redflag dưới (%) <InputNumber min={0} max={100} value={red} disabled={!star} onChange={(v) => setRed(v ?? 60)} />
                          </label>
                          <label>
                            Good trên (%) <InputNumber min={0} max={100} value={good} disabled={!star} onChange={(v) => setGood(v ?? 80)} />
                          </label>
                        </Flex>
                        <Typography.Text type="secondary">
                          Average nằm giữa hai mốc. Điểm gốc luôn được giữ, chỉ đổi cách phân loại. Tác động lên báo cáo cũ chưa chốt (docs/08 #5).
                        </Typography.Text>
                        <Button type="primary" disabled={star && red >= good} loading={save.isPending} onClick={() => save.mutate()} style={{ alignSelf: 'flex-start' }}>
                          Lưu ngưỡng
                        </Button>
                      </Flex>
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
