/**
 * Connectivity-based clustering using Label Propagation and Greedy Merging.
 */

const MAX_VISIBLE = 200;

export function buildHierarchy(nodes, edgesSrc, edgesDst) {
  if (!nodes || nodes.length === 0) return null;

  // Create a lookup for quick access by ID
  const nodeLookup = new Map();
  nodes.forEach(n => nodeLookup.set(n.id, n));

  // 1. Build Adjacency List
  const adj = new Map();
  for (let i = 0; i < edgesSrc.length; i++) {
    const u = edgesSrc[i], v = edgesDst[i];
    if (u === v) continue;
    
    // Only include edges between nodes we actually have in our subset
    if (!nodeLookup.has(u) || !nodeLookup.has(v)) continue;

    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v);
    adj.get(v).push(u);
  }

  // 2. Compute Communities
  const nodeIds = nodes.map(n => n.id);
  const communityMap = computeCommunities(nodeIds, adj, 12); // More iterations

  // 3. Convert to array of objects
  const communityNodes = {};
  for (const [nid, cid] of Object.entries(communityMap)) {
    if (!communityNodes[cid]) communityNodes[cid] = [];
    communityNodes[cid].push(parseInt(nid));
  }

  return buildLevel(communityNodes, nodes, adj, 'root', nodeLookup);
}

function buildLevel(communityNodes, allNodes, fullAdj, parentId, nodeLookup) {
  let communities = Object.entries(communityNodes).map(([cid, nodeIds]) => ({
    id: cid,
    nodeIds,
    count: nodeIds.length,
  }));

  // Greedy Merge: while > 200, merge the smallest community into its most connected neighbor
  if (communities.length > MAX_VISIBLE) {
    const nodeToComm = {};
    communities.forEach(c => c.nodeIds.forEach(nid => { nodeToComm[nid] = c.id; }));

    while (communities.length > MAX_VISIBLE) {
      communities.sort((a, b) => a.count - b.count);
      const smallest = communities.shift();
      
      // Find neighbor community with most edges
      const edgeCounts = {};
      for (const nid of smallest.nodeIds) {
        const neighbors = fullAdj.get(nid) || [];
        for (const v of neighbors) {
          const targetCid = nodeToComm[v];
          if (targetCid && targetCid !== smallest.id) {
            edgeCounts[targetCid] = (edgeCounts[targetCid] || 0) + 1;
          }
        }
      }

      // Find best neighbor
      let bestCid = null, maxEdges = -1;
      for (const [cid, count] of Object.entries(edgeCounts)) {
        if (count > maxEdges) { maxEdges = count; bestCid = cid; }
      }

      // If no neighbors found (isolated community), merge with the next smallest
      if (!bestCid) {
        bestCid = communities[0].id;
      }

      // Merge
      const target = communities.find(c => c.id === bestCid);
      target.nodeIds.push(...smallest.nodeIds);
      target.count = target.nodeIds.length;
      smallest.nodeIds.forEach(nid => { nodeToComm[nid] = bestCid; });
    }
  }

  const children = communities.map(c => {
    if (c.count === 1) {
      const node = nodeLookup.get(c.nodeIds[0]);
      return { id: node.id, type: 'node', count: 1, lat: node.lat, lng: node.lng, nodeIds: [node.id], children: null };
    }

    const clusterNodes = c.nodeIds.map(id => nodeLookup.get(id));
    const cluster = {
      id: `${parentId}_${c.id}`,
      type: 'cluster',
      count: c.count,
      lat: avg(clusterNodes, 'lat'),
      lng: avg(clusterNodes, 'lng'),
      nodeIds: c.nodeIds,
      children: null,
    };

    // Recursive subdivision for children
    const subAdj = new Map();
    const nodeSet = new Set(c.nodeIds);
    c.nodeIds.forEach(u => {
      const neighbors = fullAdj.get(u) || [];
      subAdj.set(u, neighbors.filter(v => nodeSet.has(v)));
    });
    
    const subCommMap = computeCommunities(c.nodeIds, subAdj, 8);
    const subCommNodes = {};
    for (const [nid, scid] of Object.entries(subCommMap)) {
      if (!subCommNodes[scid]) subCommNodes[scid] = [];
      subCommNodes[scid].push(parseInt(nid));
    }
    
    // We only subdivide if we have more than 1 community or if the cluster is very large
    if (Object.keys(subCommNodes).length > 1) {
      cluster.children = buildLevel(subCommNodes, allNodes, fullAdj, cluster.id, nodeLookup).children;
    } else {
      // If LPA found 1 big community, but it's > 200 nodes, we must split it some other way
      // Fallback to spatial split if connectivity is too dense/uniform to split
      cluster.children = c.nodeIds.map(id => {
        const node = nodeLookup.get(id);
        return { id: node.id, type: 'node', count: 1, lat: node.lat, lng: node.lng, nodeIds: [node.id], children: null };
      }).slice(0, MAX_VISIBLE);
    }

    return cluster;
  });

  return {
    id: parentId,
    type: 'cluster',
    children,
    count: children.reduce((s, c) => s + c.count, 0),
    lat: avg(children, 'lat'),
    lng: avg(children, 'lng'),
    nodeIds: children.flatMap(c => c.nodeIds),
  };
}

function computeCommunities(nodeIds, adj, iterations = 10) {
  const labels = {};
  nodeIds.forEach(id => { labels[id] = id; });

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = [...nodeIds]; // Deterministic iteration order
    let changed = false;
    for (const u of shuffled) {
      const neighbors = adj.get(u) || [];
      if (neighbors.length === 0) continue;

      const counts = {};
      let maxLabel = labels[u], maxCount = 0;
      for (const v of neighbors) {
        const l = labels[v];
        if (l === undefined) continue; // Skip neighbors not in our subset
        counts[l] = (counts[l] || 0) + 1;
        if (counts[l] > maxCount) {
          maxCount = counts[l];
          maxLabel = l;
        }
      }
      if (labels[u] !== maxLabel) {
        labels[u] = maxLabel;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return labels;
}

function avg(arr, key) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, i) => s + (i ? (i[key] || 0) : 0), 0) / arr.length;
}


/**
 * Get the visible items for a given cluster path.
 * @param {object} hierarchy - root cluster
 * @param {string|null} clusterId - null for root, or cluster id to drill into
 * @returns {object[]} array of items to display (max MAX_VISIBLE)
 */
export function getVisibleItems(hierarchy, clusterId) {
  if (!hierarchy) return [];
  if (!clusterId || clusterId === 'root') {
    return hierarchy.children || [];
  }
  const target = findCluster(hierarchy, clusterId);
  return target?.children || [];
}

function findCluster(node, targetId) {
  if (node.id === targetId) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findCluster(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Aggregate SEIRD state for a cluster on a given day.
 * @param {number[]} nodeIds - node IDs in the cluster
 * @param {Map} nodeLookup - Map of id -> node
 * @param {number} day - 0-indexed day
 * @returns {{ S, E, I, R, D, count }}
 */
export function aggregateClusterState(nodeIds, nodeLookup, day) {
  if (!nodeIds || nodeIds.length === 0) return { S: 0, E: 0, I: 0, R: 0, D: 0, count: 0 };

  let totals = { S: 0, E: 0, I: 0, R: 0, D: 0 };
  let count = 0;

  for (const id of nodeIds) {
    const node = nodeLookup.get(id);
    if (!node || !node.days || !node.days[day]) continue;
    const d = node.days[day];
    totals.S += d.S;
    totals.E += d.E;
    totals.I += d.I;
    totals.R += d.R;
    totals.D += d.D;
    count++;
  }

  if (count === 0) return { S: 0, E: 0, I: 0, R: 0, D: 0, count: 0 };

  return {
    S: totals.S / count,
    E: totals.E / count,
    I: totals.I / count,
    R: totals.R / count,
    D: totals.D / count,
    count,
  };
}

