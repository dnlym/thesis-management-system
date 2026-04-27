import React from 'react';
import { normalizeVietnamese } from '@/utils/search';

interface HighlightTextProps {
  text: string | null | undefined;
  keyword: string;
  className?: string;
}

/**
 * Component hỗ trợ highlight từ khóa trong văn bản.
 * Hỗ trợ highlight không dấu (Ví dụ: gõ "he thong" vẫn highlight được "Hệ thống").
 * Hỗ trợ highlight theo từng token (Ví dụ: "nguyen a" highlight "Nguyen" và "A").
 */
const HighlightText: React.FC<HighlightTextProps> = ({ text, keyword, className = "bg-yellow-100 text-yellow-900 rounded-sm px-0.5 font-semibold" }) => {
  if (!text) return null;
  if (!keyword || keyword.trim() === "") return <>{text}</>;

  const normalizedText = normalizeVietnamese(text);
  const normalizedKeyword = normalizeVietnamese(keyword);
  const tokens = normalizedKeyword.split(" ").filter(t => t.length > 0);

  if (tokens.length === 0) return <>{text}</>;

  // Tìm tất cả các khoảng (start, end) cần highlight trong chuỗi gốc
  const highlightIndices: { start: number; end: number }[] = [];

  tokens.forEach(token => {
    let pos = normalizedText.indexOf(token);
    while (pos !== -1) {
      highlightIndices.push({ start: pos, end: pos + token.length });
      pos = normalizedText.indexOf(token, pos + 1);
    }
  });

  if (highlightIndices.length === 0) return <>{text}</>;

  // Hợp nhất các khoảng overlap
  const sortedIndices = highlightIndices.sort((a, b) => a.start - b.start);
  const mergedIndices: { start: number; end: number }[] = [];
  
  if (sortedIndices.length > 0) {
    let current = sortedIndices[0];
    for (let i = 1; i < sortedIndices.length; i++) {
      if (sortedIndices[i].start < current.end) {
        current.end = Math.max(current.end, sortedIndices[i].end);
      } else {
        mergedIndices.push(current);
        current = sortedIndices[i];
      }
    }
    mergedIndices.push(current);
  }

  // Render text với các thẻ highlight
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  mergedIndices.forEach((range, idx) => {
    // Phần text không highlight trước đó
    if (range.start > lastIndex) {
      result.push(text.substring(lastIndex, range.start));
    }
    // Phần text được highlight
    result.push(
      <mark key={idx} className={className}>
        {text.substring(range.start, range.end)}
      </mark>
    );
    lastIndex = range.end;
  });

  // Phần text còn lại sau cùng
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return <>{result}</>;
};

export default HighlightText;
