import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { TODAY, createEnrollment, listClasses, listPrograms, listStudents, transferEnrollment, type EnrollmentView } from '../api';
import { GROUP_LABEL } from '../mock/catalog';
import type { ProgramGroup } from '../domain/types';
import { fmtMoney } from '../i18n/vi';

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: d === 0 ? 'CN' : `Thứ ${d + 1}` }));
const DATE_FMT = 'YYYY-MM-DD';

interface NewValues {
  studentId: string;
  programId: string;
  classId: string;
  startDate: dayjs.Dayjs;
  weekdays?: number[];
  totalSessions?: number;
  tuition?: number;
  tuitionReceived: boolean;
  note?: string;
}

/** Đăng ký khóa mới cho một học viên đã có hồ sơ. Lịch buổi chính được máy chủ sinh sẵn theo ngày học + ngày nghỉ. */
export function NewEnrollmentModal({ open, onClose, presetProgramId }: { open: boolean; onClose: () => void; presetProgramId?: string }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<NewValues>();
  const students = useQuery({ queryKey: ['students'], queryFn: listStudents, enabled: open });
  const programs = useQuery({ queryKey: ['programs'], queryFn: listPrograms, enabled: open });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses, enabled: open });
  const programId = Form.useWatch('programId', form);
  const classId = Form.useWatch('classId', form);
  const program = programs.data?.find((p) => p.id === programId);
  const cls = classes.data?.find((c) => c.id === classId);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ tuitionReceived: true, startDate: dayjs(TODAY), programId: presetProgramId });
    }
  }, [open, presetProgramId, form]);
  useEffect(() => {
    if (program) form.setFieldsValue({ tuition: program.tuition, totalSessions: program.sessions ?? undefined });
  }, [program, form]);
  useEffect(() => {
    if (cls) form.setFieldsValue({ weekdays: cls.weekdays });
  }, [cls, form]);

  const save = useMutation({
    mutationFn: (v: NewValues) =>
      createEnrollment({
        studentId: v.studentId,
        programId: v.programId,
        classId: v.classId,
        startDate: dayjs(v.startDate).format(DATE_FMT),
        weekdays: v.weekdays,
        totalSessions: v.totalSessions,
        tuition: v.tuition,
        tuitionReceived: v.tuitionReceived,
        note: v.note?.trim() || undefined,
      }),
    onSuccess: () => {
      message.success('Đã đăng ký khóa và sinh lịch buổi học.');
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const groups = (Object.keys(GROUP_LABEL) as ProgramGroup[])
    .map((g) => ({
      label: GROUP_LABEL[g],
      options: (programs.data ?? []).filter((p) => p.group === g).map((p) => ({ value: p.id, label: `${p.name} — ${fmtMoney(p.tuition)}` })),
    }))
    .filter((g) => g.options.length > 0);

  return (
    <Modal title="Đăng ký khóa học" open={open} onCancel={onClose} onOk={() => form.submit()} okText="Đăng ký" cancelText="Hủy" confirmLoading={save.isPending} destroyOnHidden width={560}>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
        <Form.Item name="studentId" label="Học viên" rules={[{ required: true, message: 'Chọn học viên' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            loading={students.isLoading}
            placeholder="Chọn học viên (đã có hồ sơ)"
            options={(students.data ?? []).filter((s) => s.status !== 'left').map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
          />
        </Form.Item>
        <Form.Item name="programId" label="Chương trình" rules={[{ required: true, message: 'Chọn chương trình' }]}>
          <Select showSearch optionFilterProp="label" loading={programs.isLoading} placeholder="Chọn chương trình" options={groups} />
        </Form.Item>
        <Form.Item name="classId" label="Lớp" rules={[{ required: true, message: 'Chọn lớp' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            loading={classes.isLoading}
            placeholder="Chọn lớp"
            options={(classes.data ?? []).filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.name} (${c.studentCount}/${c.maxSize})`, disabled: c.studentCount >= c.maxSize }))}
          />
        </Form.Item>
        <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true, message: 'Chọn ngày' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="weekdays" label="Ngày học của học viên" extra="Mặc định theo lớp; đổi nếu học viên học khác lịch chung của lớp.">
          <Checkbox.Group options={WEEKDAY_OPTIONS} />
        </Form.Item>
        {program && !program.sessions && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Gói tính theo tháng: nhập số buổi thực tế đã xác nhận." />}
        <Form.Item name="totalSessions" label="Số buổi" rules={[{ required: !program?.sessions, message: 'Nhập số buổi' }]}>
          <InputNumber min={1} max={200} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="tuition" label="Học phí (₫)" extra="Chụp tại thời điểm đăng ký; đổi danh mục sau này không ảnh hưởng khóa này.">
          <InputNumber min={0} step={100000} style={{ width: '100%' }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(String(v ?? '').replace(/\./g, '')) as 0} />
        </Form.Item>
        <Form.Item name="tuitionReceived" label="Đã nhận học phí" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Chuyển lớp giữa khóa: giữ lịch sử lớp cũ, chỉ áp dụng cho buổi từ ngày hiệu lực trở đi. */
export function TransferModal({ target, onClose }: { target: EnrollmentView | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<{ toClassId: string; effectiveDate: dayjs.Dayjs; note?: string }>();
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses, enabled: !!target });

  useEffect(() => {
    if (target) {
      form.resetFields();
      form.setFieldsValue({ effectiveDate: dayjs(TODAY) });
    }
  }, [target, form]);

  const save = useMutation({
    mutationFn: (v: { toClassId: string; effectiveDate: dayjs.Dayjs; note?: string }) =>
      transferEnrollment(target!.enrollment.id, { toClassId: v.toClassId, effectiveDate: dayjs(v.effectiveDate).format(DATE_FMT), note: v.note?.trim() || undefined }),
    onSuccess: () => {
      message.success('Đã chuyển lớp. Lịch sử lớp cũ và các buổi đã học được giữ nguyên.');
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal title="Chuyển lớp" open={!!target} onCancel={onClose} onOk={() => form.submit()} okText="Chuyển lớp" cancelText="Hủy" confirmLoading={save.isPending} destroyOnHidden>
      {target && (
        <Typography.Paragraph>
          <b>{target.student.name}</b> · {target.program.name}
          <br />
          Lớp hiện tại: {target.cls.name}
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
        <Form.Item name="toClassId" label="Lớp mới" rules={[{ required: true, message: 'Chọn lớp mới' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            loading={classes.isLoading}
            options={(classes.data ?? [])
              .filter((c) => c.active && c.id !== target?.enrollment.classId)
              .map((c) => ({ value: c.id, label: `${c.name} (${c.studentCount}/${c.maxSize})`, disabled: c.studentCount >= c.maxSize }))}
          />
        </Form.Item>
        <Form.Item name="effectiveDate" label="Ngày hiệu lực" extra="Từ ngày này học viên học theo lịch lớp mới. Không chọn ngày trong quá khứ." rules={[{ required: true, message: 'Chọn ngày' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(TODAY), 'day')} />
        </Form.Item>
        <Form.Item name="note" label="Lý do / ghi chú">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
