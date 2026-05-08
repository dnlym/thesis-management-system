import React, { useState } from 'react';
import { Modal, Radio, Space, Typography, Alert, Divider, Form, Select, Button, Tag, Row, Col } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

interface DefensePivotModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (data: { isEligible: boolean }) => void;
  topic: any;
  loading: boolean;
}

const DefensePivotModal: React.FC<DefensePivotModalProps> = ({ visible, onCancel, onConfirm, topic, loading }) => {
  const [form] = Form.useForm();
  const [isEligible, setIsEligible] = useState<boolean>(true);

  if (!topic) return null;

  // Calculate scores from topic.students
  const student = topic.students?.[0]; // Usually groups have same scores
  const scoreData = student?.finalScore;

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onConfirm({
        isEligible: values.isEligible,
      });
    });
  };

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined className="text-blue-500" />
          <span>Xét duyệt điều kiện bảo vệ</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={650}
      okText="Xác nhận & Chốt"
      cancelText="Hủy"
      okButtonProps={{ danger: !isEligible }}
    >
      <div className="py-2">
        <Alert
          message="Lưu ý quan trọng"
          description="Sau khi chốt quyết định, GVHD và Phản biện sẽ không thể chỉnh sửa điểm. Hội đồng sẽ được cấp quyền chấm điểm nếu đề tài Đạt."
          type="warning"
          showIcon
          className="mb-6"
        />

        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <Row gutter={16}>
            <Col span={24}>
              <Text type="secondary" className="text-xs uppercase font-bold">Đề tài</Text>
              <Paragraph strong className="text-base mb-2">{topic.code} - {topic.title}</Paragraph>
            </Col>
            <Divider className="my-2" />
            <Col span={8}>
              <Text type="secondary" className="text-xs uppercase block font-bold">Điểm GVHD</Text>
              <Text strong className="text-lg">{scoreData?.supervisor_score?.toFixed(2) || 'N/A'}</Text>
            </Col>
            <Col span={8} className="border-l border-gray-200">
              <Text type="secondary" className="text-xs uppercase block font-bold">TB Phản biện</Text>
              <Text strong className="text-lg">{scoreData?.reviewer_avg_score?.toFixed(2) || 'N/A'}</Text>
            </Col>
            <Col span={8} className="border-l border-gray-200">
              <Text type="secondary" className="text-xs uppercase block font-bold text-blue-600">Điểm Xét Duyệt</Text>
              <Text strong className="text-lg text-blue-600">
                {scoreData?.pre_defense_score?.toFixed(2) || 'N/A'}
              </Text>
            </Col>
          </Row>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ isEligible: true }}
          onValuesChange={(changed) => {
            if (changed.isEligible !== undefined) setIsEligible(changed.isEligible);
          }}
        >
          <Form.Item 
            name="isEligible" 
            label={<Text strong>Kết quả rà soát</Text>}
            rules={[{ required: true }]}
          >
            <Radio.Group className="w-full">
              <Space direction="vertical" className="w-full">
                <Radio value={true} className="p-3 border rounded-lg w-full hover:bg-green-50">
                  <Space>
                    <CheckCircleOutlined className="text-green-500" />
                    <div>
                      <Text strong>Đạt điều kiện bảo vệ</Text>
                      <br />
                      <Text type="secondary" className="text-xs">Sinh viên đủ điều kiện ra Hội đồng bảo vệ khóa luận.</Text>
                    </div>
                  </Space>
                </Radio>
                <Radio value={false} className="p-3 border rounded-lg w-full hover:bg-red-50">
                  <Space>
                    <CloseCircleOutlined className="text-red-500" />
                    <div>
                      <Text strong className="text-red-500">Không đạt / Không đủ điều kiện</Text>
                      <br />
                      <Text type="secondary" className="text-xs">Dừng quá trình thực hiện khóa luận. Sinh viên không được ra Hội đồng.</Text>
                    </div>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {!isEligible && (
            <Alert
              type="error"
              message="Xác nhận dừng đề tài"
              description="Hành động này sẽ kết thúc đề tài với kết quả Không đạt. Hãy chắc chắn về quyết định này."
              className="mt-2"
            />
          )}
        </Form>
      </div>
    </Modal>
  );
};

export default DefensePivotModal;

