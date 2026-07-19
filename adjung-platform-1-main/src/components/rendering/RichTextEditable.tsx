import React, { useState, useEffect, useRef } from 'react';

interface RichTextEditableProps {
  html: string;
  onChange: (html: string) => void;
  className?: string;
  tagName?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  dir?: string;
  id?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const RichTextEditable: React.FC<RichTextEditableProps> = ({
  html,
  onChange,
  className,
  tagName = 'div',
  placeholder,
  onKeyDown,
  dir,
  id,
  onContextMenu,
}) => {
  const editorRef = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && !isFocused && html !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = html;
    }
  }, [html, isFocused]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const Tag = tagName as any;
  return (
    <Tag
      ref={editorRef}
      id={id}
      contentEditable
      suppressContentEditableWarning
      className={className}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        handleInput();
      }}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      placeholder={placeholder}
      dir={dir}
    />
  );
};
