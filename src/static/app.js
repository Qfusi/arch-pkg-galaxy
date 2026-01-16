const selectedNodes = new Set();
const selectedLinks = new Set();
const hoveredNodes = new Set();
const hoveredLinks = new Set();
let allNodes = [];
let Graph;
let searchHighlightedIndex = -1;
let primarySelectedNode = null;

const fuzzySearch = (query, nodes) => {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();

  return nodes
    .map(node => {
      const name = node.id.toLowerCase();
      let score = 0;

      if (name === lowerQuery) {
        score = 1000;
      }
      else if (name.startsWith(lowerQuery)) {
        score = 500;
      }
      else if (name.includes(lowerQuery)) {
        score = 250;
      }
      else {
        let charIdx = 0;
        for (let i = 0; i < name.length && charIdx < lowerQuery.length; i++) {
          if (name[i] === lowerQuery[charIdx]) {
            score += 10;
            charIdx++;
          }
        }
        if (charIdx < lowerQuery.length) {
          score = 0;
        }
      }

      return { node, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(item => item.node);
};

const updateSearchDropdown = (query) => {
  const dropdown = document.getElementById('search-dropdown');
  const results = fuzzySearch(query, allNodes);

  searchHighlightedIndex = -1;

  if (results.length === 0 || !query.trim()) {
    dropdown.classList.remove('active');
    dropdown.innerHTML = '';
    return;
  }

  dropdown.innerHTML = results
    .map(node => `<div class="search-result" data-node-id="${node.id}">${node.id}</div>`)
    .join('');
  dropdown.classList.add('active');

  dropdown.querySelectorAll('.search-result').forEach(elem => {
    elem.addEventListener('click', () => {
      const nodeId = elem.getAttribute('data-node-id');
      const node = allNodes.find(n => n.id === nodeId);
      if (node && Graph) {
        selectNode(node);
        document.getElementById('search-input').value = '';
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
      }
    });
  });
};

const highlightSearchResult = (index) => {
  const results = document.querySelectorAll('.search-result');

  results.forEach(r => r.classList.remove('highlighted'));

  if (index >= 0 && index < results.length) {
    results[index].classList.add('highlighted');
    results[index].scrollIntoView({ block: 'nearest' });
    searchHighlightedIndex = index;
  } else {
    searchHighlightedIndex = -1;
  }
};

const selectHighlightedSearchResult = () => {
  const results = document.querySelectorAll('.search-result');
  if (searchHighlightedIndex >= 0 && searchHighlightedIndex < results.length) {
    const nodeId = results[searchHighlightedIndex].getAttribute('data-node-id');
    const node = allNodes.find(n => n.id === nodeId);
    if (node && Graph) {
      selectNode(node);
      document.getElementById('search-input').value = '';
      document.getElementById('search-dropdown').classList.remove('active');
      document.getElementById('search-dropdown').innerHTML = '';
    }
  }
};

const selectNode = (node) => {
  const pop = document.getElementById('popover');

  document.getElementById('p-name').innerText = node.id;
  document.getElementById('p-repo').innerText = node.repo;

  const sizeText = node.repo === 'ghost'
    ? "Not Installed (Dependency only)"
    : (node.size_bytes ? formatBytes(node.size_bytes) : "N/A");

  document.getElementById('p-size').innerText = sizeText;
  document.getElementById('p-deps').innerText = node.neighbors ? node.neighbors.length : 0;
  document.getElementById('p-wiki').href = `https://wiki.archlinux.org/index.php?search=${node.id}`;

  pop.style.display = 'block';

  Graph.centerAt(node.x, node.y, 500);
  Graph.zoom(3, 500);

  primarySelectedNode = node;
  selectedNodes.clear();
  selectedLinks.clear();
  selectedNodes.add(node);
  node.neighbors?.forEach(n => selectedNodes.add(n));
  node.childLinks?.forEach(l => selectedLinks.add(l));
};

fetch('/data').then(res => res.json()).then(data => {
  const elem = document.getElementById('graph');
  allNodes = data.nodes;

  const nodesById = Object.fromEntries(data.nodes.map(node => [node.id, node]));
  data.links.forEach(link => {
    const source = nodesById[link.source];
    const target = nodesById[link.target];
    if (source && target) {
      !source.neighbors && (source.neighbors = []);
      source.neighbors.push(target);

      !source.childLinks && (source.childLinks = []);
      source.childLinks.push(link);
    }
  });

  Graph = ForceGraph()(elem)
    .graphData(data)
    .nodeId('id')
    .nodeAutoColorBy('repo')
    .backgroundColor('#0b0e14')
    .autoPauseRedraw(false)

    .nodePointerAreaPaint((node, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI, false);
      ctx.fill();
    })
    .nodeCanvasObject((node, ctx, globalScale) => {
      const isHighlighted = hoveredNodes.has(node) || selectedNodes.has(node);
      const isSelected = selectedNodes.has(node);
      const isHovered = hoveredNodes.has(node);
      const isSelectedNeighbor = !isSelected && primarySelectedNode &&
        primarySelectedNode.neighbors?.includes(node);

      if (isSelected || isHovered || isSelectedNeighbor) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + (3 / globalScale), 0, 2 * Math.PI, false);
        let color = 'orange';
        if (isSelected && isHovered) {
          color = '#ff6b6b';
        } else if (isSelected) {
          color = '#ffd700';
        } else if (isHovered) {
          color = 'orange';
        } else if (isSelectedNeighbor) {
          color = 'rgba(255,215,0,0.5)';
        }
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI, false);
        ctx.fill();
      }


      if (globalScale > 4 || isHighlighted) {
        const label = node.id;
        ctx.font = `${50 / globalScale}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(label, node.x, node.y + node.size + (5 / globalScale));
      }
    })

    .linkWidth(link => selectedLinks.has(link) ? 3 : hoveredLinks.has(link) ? 2 : 1.5)
    .linkColor(link => selectedLinks.has(link) ? 'rgba(255,215,0,0.7)' : hoveredLinks.has(link) ? 'rgba(255,165,0,0.7)' : 'rgba(255,255,255,0.1)')
    .linkDirectionalParticles(link => selectedLinks.has(link) ? 4 : hoveredLinks.has(link) ? 2 : 0)
    .linkDirectionalParticleWidth(2)

    .onNodeDrag((node) => {
      node.fx = node.x; node.fy = node.y;
      Graph.d3AlphaTarget(0.3);
    })
    .onNodeDragEnd((node) => {
      node.fx = null; node.fy = null;
      Graph.d3AlphaTarget(0.005);
    })
    .onNodeHover(node => {
      hoveredNodes.clear();
      hoveredLinks.clear();

      if (node) {
        hoveredNodes.add(node);
        node.neighbors?.forEach(neighbor => hoveredNodes.add(neighbor));
        node.childLinks?.forEach(link => hoveredLinks.add(link));
      }
      elem.style.cursor = node ? 'pointer' : null;
    })
    .onNodeClick(node => {
      selectNode(node);
    })
    .onBackgroundClick(() => {
      selectedNodes.clear();
      selectedLinks.clear();
      primarySelectedNode = null;
      const pop = document.getElementById('popover');
      pop.style.display = 'none';
    });

  Graph.d3Force('charge', d3.forceManyBody().strength(-400).distanceMax(1000));
  Graph.d3Force('link', d3.forceLink(data.links).id(d => d.id).distance(200).strength(0.02));
  Graph.d3Force('collide', d3.forceCollide().radius(d => d.size + 10).iterations(3));
  Graph.d3Force('center', d3.forceCenter().strength(0.02));

  Graph.d3AlphaDecay(0.005);
  Graph.d3AlphaTarget(0.2);
  setTimeout(() => { Graph.d3AlphaTarget(0.005); }, 10000);
});

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const closePopover = () => {
  selectedNodes.clear();
  selectedLinks.clear();
  primarySelectedNode = null;
  document.getElementById('popover').style.display = 'none';
}

document.getElementById('search-input').addEventListener('input', (e) => {
  updateSearchDropdown(e.target.value);
});

document.getElementById('search-input').addEventListener('keydown', (e) => {
  const dropdown = document.getElementById('search-dropdown');
  const results = document.querySelectorAll('.search-result');
  const resultCount = results.length;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (dropdown.classList.contains('active')) {
        highlightSearchResult(searchHighlightedIndex + 1);
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (dropdown.classList.contains('active')) {
        highlightSearchResult(searchHighlightedIndex - 1);
      }
      break;
    case 'Enter':
      e.preventDefault();
      selectHighlightedSearchResult();
      break;
    case 'Escape':
      dropdown.classList.remove('active');
      document.getElementById('search-input').value = '';
      break;
  }
});

document.addEventListener('click', (e) => {
  const searchContainer = document.getElementById('search-container');
  if (!searchContainer.contains(e.target)) {
    document.getElementById('search-dropdown').classList.remove('active');
  }
});