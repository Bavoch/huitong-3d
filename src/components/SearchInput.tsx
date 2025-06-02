import React from 'react';
import { SearchIcon } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = "搜索" }) => {
  return (
    <div className="relative w-full" style={{
      alignSelf: 'stretch',
      paddingLeft: '8px',
      paddingRight: '8px',
      paddingTop: '6px',
      paddingBottom: '6px',
      height: '32px',
      background: 'rgba(0, 0, 0, 0.15)',
      overflow: 'hidden',
      borderRadius: '8px',
      outline: '1px rgba(255, 255, 255, 0.12) solid',
      outlineOffset: '-1px',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '4px',
      display: 'inline-flex'
    }}>
      <SearchIcon className="absolute left-sm top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-primary" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-10 pr-lg bg-[rgba(0,0,0,0.00)] border-[rgba(255,255,255,0.12)] rounded-[8px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-border-emphasis transition-colors"
      />
    </div>
  );
};

export default SearchInput;
