"use client";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Channel } from "../types/monitoring";
import "../css/ChannelPickerModal.css";

interface ChannelPickerModalProps {
  show: boolean;
  allChannels: Channel[];
  myChannels: Channel[];
  setMyChannels: (chs: Channel[]) => void;
  onCancel: () => void;
}

export default function ChannelPickerModal({
  show,
  allChannels,
  myChannels,
  setMyChannels,
  onCancel,
}: ChannelPickerModalProps) {
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (show) {
      const map: Record<string, boolean> = {};
      allChannels.forEach((ch) => (map[ch.code] = false));
      setSelectedMap(map);
    }
  }, [show, allChannels]);

  const allSelectable = allChannels.filter(
    (ch) => !myChannels.some((mc) => mc.code === ch.code)
  );
  const allChecked = allSelectable.every((ch) => selectedMap[ch.code]);
  const someChecked = allSelectable.some((ch) => selectedMap[ch.code]);

  const handleAddChannels = () => {
    const selChannels = allChannels.filter(
      (ch) => !myChannels.some((mc) => mc.code === ch.code) && selectedMap[ch.code]
    );
    setMyChannels([...myChannels, ...selChannels]);
    onCancel();
  };

  const isAddButtonDisabled = Object.keys(selectedMap).filter((k) => selectedMap[k]).length === 0;

  if (!show) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">채널 관리</h2>
        <div className="modal-description">
          조직 내 Slack 채널을 선택·추가하세요.
        </div>

        {/* 전체 선택 */}
        <label className="channel-list-item">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              const next = { ...selectedMap };
              allSelectable.forEach((ch) => (next[ch.code] = e.target.checked));
              setSelectedMap(next);
            }}
            ref={(el) => {
              if (el) el.indeterminate = someChecked && !allChecked;
            }}
            className="channel-checkbox"
          />
          전체 선택
        </label>

        {/* 채널 목록 */}
        <div>
          {allChannels.map((ch) => {
            const already = myChannels.some((mc) => mc.code === ch.code);
            return (
              <div key={ch.code} className="channel-list-item">
                <input
                  type="checkbox"
                  checked={!!selectedMap[ch.code]}
                  disabled={already}
                  onChange={(e) =>
                    setSelectedMap({ ...selectedMap, [ch.code]: e.target.checked })
                  }
                  className="channel-checkbox"
                />
                <span>
                  {ch.name} ({ch.code})
                  {already && (
                    <span className="already-added-text">[추가됨]</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 버튼 */}
        <div className="button-container">
          <button
            onClick={onCancel}
            className="cancel-button"
          >
            취소
          </button>
          <button
            onClick={handleAddChannels}
            disabled={isAddButtonDisabled}
            className={`add-button ${isAddButtonDisabled ? 'disabled' : ''}`}
          >
            채널 추가
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}