import { useState, useEffect } from 'react';
import { Card, Tabs, Button, Table, Modal, Input, Spin, Tag, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, DownloadOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { FileUpload } from '@/components/FileUpload';
import { StatusBadge } from '@/components/StatusBadge';
import { useSubmissions, useSubmissionVersions, useUploadFile } from '@/hooks/useSubmissions';
import { useRegistrations } from '@/hooks/useRegistrations';
import { useAuthStore } from '@/store/auth';
import type { SubmissionType } from '@/types';

const { TabPane } = Tabs;
const { TextArea } = Input;

const Submissions = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // State
  const [activeTab, setActiveTab] = useState<SubmissionType>('PROPOSAL');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [comments, setComments] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [viewVersionsModalVisible, setViewVersionsModalVisible] = useState(false);

  // Fetch student registration to get groupId and topicId
  const { data: registrations, isLoading: isLoadingRegistration } = useRegistrations({
    studentId: user?.role === 'STUDENT' ? user.id : undefined,
    status: 'CONFIRMED'
  });

  const registration = registrations?.[0];
  const groupId = registration?.group_id;
  const topicId = registration?.topic_id;

  // Fetch submissions
  const { data: submissions, isLoading } = useSubmissions({
    groupId: groupId,
    type: activeTab
  }, { enabled: !!groupId });

  const { data: versions } = useSubmissionVersions(selectedSubmissionId || undefined);
  const uploadMutation = useUploadFile();

  const handleUpload = () => {
    if (selectedFiles.length === 0 || !groupId || !topicId) {
      return;
    }

    const formData = new FormData();
    formData.append('topicId', topicId);
    formData.append('groupId', groupId);
    formData.append('type', activeTab);
    formData.append('file', selectedFiles[0]);
    if (comments) {
      formData.append('comments', comments);
    }

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        setSelectedFiles([]);
        setComments('');
      },
    });
  };

  const viewVersions = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setViewVersionsModalVisible(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const submissionsColumns = [
    {
      title: 'Phiên bản',
      dataIndex: 'current_version',
      key: 'version',
      render: (version: number) => <Tag color="blue">v{version}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <StatusBadge status={status} />,
    },
    {
      title: 'Khóa',
      dataIndex: 'locked',
      key: 'locked',
      render: (locked: boolean) => (
        locked ? (
          <Tag color="orange" icon={<CheckCircleOutlined />}>Đã khóa</Tag>
        ) : (
          <Tag color="default">Chưa khóa</Tag>
        )
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewVersions(record.id)}
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];

  const versionsColumns = [
    {
      title: 'Phiên bản',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: 'Tên file',
      dataIndex: 'file_name',
      key: 'fileName',
      render: (name: string) => (
        <span className="flex items-center space-x-2">
          <FileTextOutlined />
          <span>{name}</span>
        </span>
      ),
    },
    {
      title: 'Kích thước',
      dataIndex: 'file_size',
      key: 'fileSize',
      render: (size: number) => formatFileSize(size),
    },
    {
      title: 'Người upload',
      dataIndex: 'uploaded_by',
      key: 'uploadedBy',
      render: (id: string) => 'Sinh viên', // TODO: Load user name
    },
    {
      title: 'Ngày upload',
      dataIndex: 'uploaded_at',
      key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Duyệt',
      dataIndex: 'approved',
      key: 'approved',
      render: (approved: boolean) => (
        approved ? (
          <Tag color="green">Đã duyệt</Tag>
        ) : (
          <Tag color="default">Chưa duyệt</Tag>
        )
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<DownloadOutlined />}
        // onClick={() => downloadFile(record.id)}
        >
          Tải xuống
        </Button>
      ),
    },
  ];

  const getMaxFileSize = (type: SubmissionType) => {
    switch (type) {
      case 'PROPOSAL':
        return 10 * 1024 * 1024; // 10MB
      case 'REPORT':
        return 50 * 1024 * 1024; // 50MB
      case 'SOURCE_CODE':
        return 100 * 1024 * 1024; // 100MB
      case 'SLIDES':
        return 20 * 1024 * 1024; // 20MB
      default:
        return 50 * 1024 * 1024;
    }
  };

  const getAcceptedFormats = (type: SubmissionType) => {
    switch (type) {
      case 'PROPOSAL':
      case 'REPORT':
        return {
          'application/pdf': ['.pdf'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        };
      case 'SOURCE_CODE':
        return {
          'application/zip': ['.zip'],
          'application/x-rar-compressed': ['.rar']
        };
      case 'SLIDES':
        return {
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
          'application/pdf': ['.pdf']
        };
      default:
        return {};
    }
  };

  const getCurrentSubmission = () => {
    return submissions?.find(s => s.type === activeTab);
  };

  const currentSubmission = getCurrentSubmission();
  const isLocked = currentSubmission?.locked || false;

  if (isLoadingRegistration) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (user?.role === 'STUDENT' && !registration) {
    return (
      <div className="p-6">
        <Alert
          message="Chưa đăng ký đề tài"
          description="Bạn cần đăng ký đề tài và được xác nhận trước khi nộp bài."
          type="warning"
          showIcon
          action={
            <Button href="/topics" type="primary">Đăng ký đề tài</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.submissions')}</h1>
          <p className="text-muted-foreground">Nộp file và quản lý phiên bản</p>
        </div>
      </div>

      <Card className="shadow-soft">
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as SubmissionType)}>
          <TabPane tab="Đề cương" key="PROPOSAL">
            <SubmissionContent
              type="PROPOSAL"
              isLocked={isLocked}
              handleUpload={handleUpload}
              uploadMutation={uploadMutation}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              comments={comments}
              setComments={setComments}
              getAcceptedFormats={getAcceptedFormats}
              getMaxFileSize={getMaxFileSize}
              isLoading={isLoading}
              submissionsColumns={submissionsColumns}
              currentSubmission={currentSubmission}
            />
          </TabPane>

          <TabPane tab="Báo cáo" key="REPORT">
            <SubmissionContent
              type="REPORT"
              isLocked={isLocked}
              handleUpload={handleUpload}
              uploadMutation={uploadMutation}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              comments={comments}
              setComments={setComments}
              getAcceptedFormats={getAcceptedFormats}
              getMaxFileSize={getMaxFileSize}
              isLoading={isLoading}
              submissionsColumns={submissionsColumns}
              currentSubmission={currentSubmission}
            />
          </TabPane>

          <TabPane tab="Mã nguồn" key="SOURCE_CODE">
            <SubmissionContent
              type="SOURCE_CODE"
              isLocked={isLocked}
              handleUpload={handleUpload}
              uploadMutation={uploadMutation}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              comments={comments}
              setComments={setComments}
              getAcceptedFormats={getAcceptedFormats}
              getMaxFileSize={getMaxFileSize}
              isLoading={isLoading}
              submissionsColumns={submissionsColumns}
              currentSubmission={currentSubmission}
            />
          </TabPane>

          <TabPane tab="Slide thuyết trình" key="SLIDES">
            <SubmissionContent
              type="SLIDES"
              isLocked={isLocked}
              handleUpload={handleUpload}
              uploadMutation={uploadMutation}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              comments={comments}
              setComments={setComments}
              getAcceptedFormats={getAcceptedFormats}
              getMaxFileSize={getMaxFileSize}
              isLoading={isLoading}
              submissionsColumns={submissionsColumns}
              currentSubmission={currentSubmission}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Versions Modal */}
      <Modal
        title="Lịch sử phiên bản"
        open={viewVersionsModalVisible}
        onCancel={() => setViewVersionsModalVisible(false)}
        footer={null}
        width={900}
      >
        <Table
          columns={versionsColumns}
          dataSource={versions || []}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </div>
  );
};

// Helper component to reduce duplication
const SubmissionContent = ({
  type, isLocked, handleUpload, uploadMutation, selectedFiles, setSelectedFiles,
  comments, setComments, getAcceptedFormats, getMaxFileSize, isLoading, submissionsColumns, currentSubmission
}: any) => (
  <div className="space-y-6">
    {!isLocked ? (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upload file mới</h3>
        <FileUpload
          onFilesSelected={setSelectedFiles}
          value={selectedFiles}
          accept={getAcceptedFormats(type)}
          maxSize={getMaxFileSize(type)}
          maxFiles={1}
        />

        <div>
          <label className="block mb-2 font-medium">Ghi chú (không bắt buộc)</label>
          <TextArea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Nhập ghi chú về phiên bản này..."
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="primary"
            size="large"
            onClick={handleUpload}
            loading={uploadMutation.isPending}
            disabled={selectedFiles.length === 0}
          >
            Xác nhận upload
          </Button>
        </div>
      </div>
    ) : (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-orange-800">
          <strong>File đã bị khóa.</strong> Không thể upload thêm.
        </p>
      </div>
    )}

    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Lịch sử nộp file</h3>
      <Spin spinning={isLoading}>
        <Table
          columns={submissionsColumns}
          dataSource={[currentSubmission].filter(Boolean)}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'Chưa có file nào được nộp' }}
        />
      </Spin>
    </div>
  </div>
);

export default Submissions;