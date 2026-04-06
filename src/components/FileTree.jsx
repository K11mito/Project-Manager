import React, { useState } from 'react';

function TreeNode({ item, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (item.type === 'dir') {
    return (
      <div>
        <div
          className="tree-item dir"
          style={{ paddingLeft: depth * 16 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span style={{ fontSize: 10, width: 14, textAlign: 'center' }}>
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
          {item.name}/
        </div>
        {expanded && item.children && (
          <div className="tree-children">
            {item.children.map((child, i) => (
              <TreeNode key={i} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tree-item" style={{ paddingLeft: depth * 16 + 18 }}>
      {item.name}
    </div>
  );
}

export default function FileTree({ tree }) {
  if (!tree || tree.length === 0) return null;

  return (
    <div className="file-tree-panel">
      <h3>File Tree</h3>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {tree.map((item, i) => (
          <TreeNode key={i} item={item} depth={0} />
        ))}
      </div>
    </div>
  );
}
