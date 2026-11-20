import React from "react";

function FolderArt() {
  return (
    <div className="art" aria-hidden="true">
      <div className="sheet sheet1" />
      <div className="sheet sheet2">
        <i />
        <i />
        <i />
      </div>
      <div className="folder">
        <div className="sticker">
          M<span>•</span>
        </div>
        <div className="lines">|||| ||| | |||| ||</div>
      </div>
      <div className="clip" />
    </div>
  );
}
export function Cover() {
  return (
    <section className="cover">
      <div className="coverText">
        <small className="kicker">PERSONAL ARCHIVE</small>
        <h1>공고 아카이브</h1>
        <p>관심 있는 모집공고를 모으고, 마감일을 한눈에 확인하세요.</p>
      </div>
      <FolderArt />
    </section>
  );
}
