import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    minHeight?: string;
}

const modules = {
    toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['link'],
        [{ color: [] }, { background: [] }],
        ['clean'],
    ],
};

const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
    'align',
    'link',
    'color',
    'background',
];

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Nhập nội dung...',
    disabled = false,
    className,
    minHeight = '200px',
}: RichTextEditorProps) {
    return (
        <div className={cn('rich-text-editor', className)}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={disabled}
                className={cn(
                    'bg-white rounded-md border border-gray-300',
                    disabled && 'opacity-60 cursor-not-allowed'
                )}
                style={{
                    minHeight,
                }}
            />
            <style>{`
        .rich-text-editor .ql-container {
          min-height: ${minHeight};
          font-size: 14px;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor {
          min-height: ${minHeight};
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
        }
        .rich-text-editor .ql-container {
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
        }
      `}</style>
        </div>
    );
}
