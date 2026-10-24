import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import { createUnit, updateUnit } from '../api';
import type { UnitContent, UnitTemplate } from '../domain/types';

interface Values {
  name: string;
  topic: string;
  words: string;
  patterns: string;
}

const toList = (text: string) => text.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

/**
 * Thêm/sửa nội dung một Unit trong khung kiểm tra. Sửa không làm đổi báo cáo cũ:
 * mỗi kết quả đã chấm giữ bản chụp nội dung Unit tại thời điểm chấm.
 */
export function UnitModal({ template, editing, open, onClose }: { template: UnitTemplate; editing?: UnitContent | null; open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) form.setFieldsValue({ name: editing.name, topic: editing.topic, words: editing.words.join('\n'), patterns: editing.patterns.join('\n') });
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { name: v.name, topic: v.topic ?? '', words: toList(v.words ?? ''), patterns: toList(v.patterns ?? '') };
      return editing ? updateUnit(editing.id, body) : createUnit({ template, ...body });
    },
    onSuccess: (u) => {
      message.success(editing ? `Đã cập nhật ${u.name}. Báo cáo cũ vẫn giữ nội dung đã dùng.` : `Đã thêm ${u.name}.`);
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal title={editing ? `Sửa ${editing.name}` : 'Thêm Unit'} open={open} onCancel={onClose} onOk={() => form.submit()} okText="Lưu" cancelText="Hủy" confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
        <Form.Item name="name" label="Tên Unit" rules={[{ required: true, message: 'Nhập tên Unit' }]}>
          <Input placeholder="Unit 1" />
        </Form.Item>
        <Form.Item name="topic" label="Chủ đề">
          <Input />
        </Form.Item>
        <Form.Item name="words" label="Từ vựng" extra="Mỗi từ một dòng (hoặc cách nhau bằng dấu phẩy).">
          <Input.TextArea rows={5} />
        </Form.Item>
        <Form.Item name="patterns" label="Mẫu câu" extra="Mỗi mẫu một dòng.">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
