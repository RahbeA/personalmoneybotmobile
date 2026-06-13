import { useState } from 'react';
import { Modal, Form, Input, Typography, App as AntApp } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

/**
 * Change-password dialog. When `forced` is true it cannot be dismissed — used to
 * make an admin replace the temporary password an owner set for them.
 */
export default function ChangePasswordModal({ open, forced = false, onClose }) {
  const { changePassword } = useAuth();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await changePassword(values.current_password, values.new_password);
      message.success('Password updated.');
      form.resetFields();
      onClose?.(true);
    } catch (err) {
      message.error(err.message || 'Could not change password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Change password"
      okText="Update password"
      onOk={handleSubmit}
      confirmLoading={submitting}
      closable={!forced}
      maskClosable={!forced}
      keyboard={!forced}
      cancelButtonProps={forced ? { style: { display: 'none' } } : undefined}
      onCancel={() => onClose?.(false)}
      destroyOnClose
    >
      {forced && (
        <Typography.Paragraph type="warning" style={{ marginBottom: 16 }}>
          Your password was set by an administrator. Choose a new password to
          continue.
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="current_password"
          label="Current password"
          rules={[{ required: true, message: 'Enter your current password.' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="New password"
          rules={[
            { required: true, message: 'Enter a new password.' },
            { min: 8, message: 'Use at least 8 characters.' },
          ]}
          hasFeedback
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="Confirm new password"
          dependencies={['new_password']}
          hasFeedback
          rules={[
            { required: true, message: 'Re-enter the new password.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Passwords do not match.'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
