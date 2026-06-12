import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';

export default function EmailTagsInput({ value = [], onChange }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const addEmail = (email) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;
    if (value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputVal('');
  };

  const removeEmail = (email) => {
    onChange(value.filter(e => e !== email));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      removeEmail(value[value.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputVal) addEmail(inputVal);
  };

  return (
    <div
      className="tags-input-container"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map(email => (
        <div key={email} className="tag-item">
          {email}
          <button
            type="button"
            className="tag-remove"
            onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="email"
        className="tag-input"
        placeholder={value.length === 0 ? 'Nhập email và nhấn Enter...' : 'Thêm email...'}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
