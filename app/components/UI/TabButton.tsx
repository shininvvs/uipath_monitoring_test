import React from "react";
import '../../css/TabButton'

interface TabButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ children, active, onClick }) => {
  return (
    <button className="tab-button"
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default TabButton;
