import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, File } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';

interface FileUploadProps {
    onFilesSelected: (files: File[]) => void;
    accept?: Record<string, string[]>;
    maxSize?: number; // in bytes
    maxFiles?: number;
    disabled?: boolean;
    value?: File[];
    className?: string;
}

export function FileUpload({
    onFilesSelected,
    accept,
    maxSize = 50 * 1024 * 1024, // 50MB default
    maxFiles = 1,
    disabled = false,
    value = [],
    className,
}: FileUploadProps) {
    const [uploadProgress, setUploadProgress] = React.useState<number>(0);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            onFilesSelected(acceptedFiles);
            setUploadProgress(0);
        },
        [onFilesSelected]
    );

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        onDrop,
        accept,
        maxSize,
        maxFiles,
        disabled,
    });

    const removeFile = (index: number) => {
        const newFiles = value.filter((_, i) => i !== index);
        onFilesSelected(newFiles);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
        if (file.type === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
        return <File className="h-8 w-8 text-gray-500" />;
    };

    return (
        <div className={cn('w-full', className)}>
            <div
                {...getRootProps()}
                className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    isDragActive && 'border-blue-500 bg-blue-50',
                    !isDragActive && 'border-gray-300 hover:border-gray-400',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                    <p className="text-blue-600 font-medium">Thả file vào đây...</p>
                ) : (
                    <div>
                        <p className="text-gray-700 font-medium mb-2">
                            Kéo và thả file vào đây, hoặc click để chọn file
                        </p>
                        <p className="text-sm text-gray-500">
                            Kích thước tối đa: {formatFileSize(maxSize)}
                            {maxFiles > 1 && ` • Tối đa ${maxFiles} files`}
                        </p>
                    </div>
                )}
            </div>

            {/* File rejections */}
            {fileRejections.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    {fileRejections.map(({ file, errors }) => (
                        <div key={file.name} className="text-sm text-red-600">
                            {file.name}:
                            {errors.map((e) => (
                                <div key={e.code} className="ml-2">
                                    • {e.code === 'file-too-large' && `File quá lớn (tối đa ${formatFileSize(maxSize)})`}
                                    {e.code === 'file-invalid-type' && 'Loại file không được hỗ trợ'}
                                    {e.code === 'too-many-files' && `Chỉ được chọn tối đa ${maxFiles} files`}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Selected files */}
            {value.length > 0 && (
                <div className="mt-4 space-y-2">
                    {value.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
                        >
                            <div className="flex items-center space-x-3">
                                {getFileIcon(file)}
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                disabled={disabled}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-gray-500 mt-1 text-center">{uploadProgress}% đã tải lên</p>
                </div>
            )}
        </div>
    );
}
