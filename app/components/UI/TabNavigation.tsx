import React from "react";
import '../../css/TabNavigation.css'

type TabType = "overview" | "channels";

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="tab-navigation">
      <div className="nav-brand">
        <img 
          src="./img/logo/weblight.png"
          className="brand-icon"
          style={{ width: "30px", height: "30px", objectFit: "contain" }}
        />
        <span>Weblight</span>
      </div>

      <ul className="tab-list">
        <li className="tab-item">
          <button
            className={`tab-button ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => onTabChange("overview")}
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            aria-controls="overview-panel"
          >
            <span className={`tab-icon overview-icon`}>📊</span>
            <span>Dashboard</span>
          </button>
        </li>
        <li className="tab-item">
          <button
            className={`tab-button ${activeTab === "channels" ? "active" : ""}`}
            onClick={() => onTabChange("channels")}
            type="button"
            role="tab"
            aria-selected={activeTab === "channels"}
            aria-controls="channels-panel"
          >
            <span className={`tab-icon channels-icon`}>📡</span>
            <span>Channels</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}