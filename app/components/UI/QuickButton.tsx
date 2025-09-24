import React, { useState } from "react";
import '../../css/QuickButton.css'

interface QuickButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

const QuickButton: React.FC<QuickButtonProps> = ({ children, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button className="quick-button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
};

export default QuickButton;
