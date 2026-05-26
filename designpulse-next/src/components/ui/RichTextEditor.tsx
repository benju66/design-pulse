"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onSave: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton = ({ onClick, active, title, children }: ToolbarButtonProps) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()} // prevent focus steal from editor
    onClick={onClick}
    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
      active ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-500'
    }`}
    title={title}
  >
    {children}
  </button>
);

export function RichTextEditor({ content, onSave, disabled, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Type here...',
      }),
    ],
    content,
    editable: !disabled,
    immediatelyRender: false, // Suppress SSR hydration warning in Next.js
    onBlur: ({ editor }) => {
      // Always fire — parent decides whether to mutate against fresh row data.
      // This avoids the stale closure trap where `content` goes stale after typing.
      onSave(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'w-full text-sm bg-transparent border-none p-2 min-h-[6rem] outline-none text-slate-800 dark:text-slate-200 focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Escape') {
          view.dom.blur(); // triggers onBlur → onSave
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) return null;

  return (
    <div className={`relative flex flex-col w-full rounded-lg transition-all ${
      disabled
        ? 'opacity-70 cursor-not-allowed'
        : 'focus-within:ring-2 focus-within:ring-sky-500'
    }`}>
      {!disabled && (
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 px-2 py-1.5">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
            <Italic size={14} />
          </ToolbarButton>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
            <List size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
            <ListOrdered size={14} />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
