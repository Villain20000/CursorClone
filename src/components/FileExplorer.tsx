import React, { useState } from "react";
import { useStore } from "../store";
import { FileNode } from "@shared/types";

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icon =
    ext === "ts" || ext === "tsx"
      ? "TS"
      : ext === "js" || ext === "jsx"
      ? "JS"
      : ext === "json"
      ? "{}"
      : ext === "md"
      ? "M"
      : ext === "css" || ext === "scss"
      ? "#"
      : ext === "py"
      ? "PY"
      : ext === "html"
      ? "H"
      : "F";
  return <span className="icon">{icon}</span>;
}

function TreeItem({ node, depth }: { node: FileNode; depth: number }) {
  const expandedDirs = useStore((s) => s.expandedDirs);
  const toggleDir = useStore((s) => s.toggleDir);
  const openFile = useStore((s) => s.openFile);
  const activeTabPath = useStore((s) => s.activeTabPath);
  const addContextFile = useStore((s) => s.addContextFile);
  const [hovered, setHovered] = useState(false);

  const isDir = node.type === "directory";
  const expanded = expandedDirs.has(node.path);
  const isActive = activeTabPath === node.path;

  const onClick = async () => {
    if (isDir) {
      toggleDir(node.path);
    } else {
      try {
        const content = await window.cursor.readFile(node.path);
        const lang = node.path
          .split(".")
          .pop()
          ?.toLowerCase();
        openFile(node.path, content, lang || "plaintext");
      } catch (e) {
        console.error("Failed to read file", e);
      }
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDir) {
      addContextFile(node.path);
    }
  };

  return (
    <>
      <div
        className={`tree-item ${isActive ? "active" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={node.path}
      >
        {isDir ? (
          <span className="chevron">{expanded ? "▼" : "▶"}</span>
        ) : (
          <span className="chevron" />
        )}
        {isDir ? (
          <span className="icon">{expanded ? "📂" : "📁"}</span>
        ) : (
          <FileIcon name={node.name} />
        )}
        <span>{node.name}</span>
        {!isDir && hovered && (
          <span
            style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}
            title="Right-click to add to chat context"
          >
            @
          </span>
        )}
      </div>
      {isDir && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
}

export function FileExplorer() {
  const tree = useStore((s) => s.tree);
  const openFolder = async () => {
    const t = await window.cursor.openFolder();
    if (t) useStore.getState().setTree(t);
  };

  if (!tree) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Explorer</span>
        </div>
        <div className="empty-state" style={{ padding: 16 }}>
          <p>No folder opened</p>
          <button onClick={openFolder}>Open Folder</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{tree.name}</span>
        <div className="sidebar-actions">
          <button
            className="icon"
            title="Open another folder"
            onClick={openFolder}
          >
            📂
          </button>
        </div>
      </div>
      <div className="tree">
        {tree.children?.map((child) => (
          <TreeItem key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  );
}
