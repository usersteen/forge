import { useState, useRef, useEffect, useCallback } from "react";

export default function useInlineRename(onCommit) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = useCallback((id, currentName, initialValue = currentName) => {
    setEditingId(id);
    setEditValue(initialValue);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onCommit(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onCommit]);

  const cancelEditing = useCallback(() => setEditingId(null), []);

  const inputProps = {
    ref: inputRef,
    value: editValue,
    onChange: (e) => setEditValue(e.target.value),
    onBlur: commitRename,
    onKeyDown: (e) => {
      if (e.key === "Enter") commitRename();
      if (e.key === "Escape") cancelEditing();
    },
  };

  return { editingId, startEditing, inputProps };
}
