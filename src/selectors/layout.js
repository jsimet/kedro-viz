import { createSelector } from 'reselect';
import dagre from 'dagre';
import { graph } from '../utils/graph/';
import { getCurrentFlags } from './flags';
import { getVisibleNodes } from './nodes';
import { getVisibleEdges } from './edges';
import { getVisibleLayerIDs } from './disabled';
import { sidebarBreakpoint, sidebarWidth } from '../config';

const getHasVisibleLayers = state =>
  state.visible.layers && Boolean(state.layer.ids.length);
const getNodeType = state => state.node.type;
const getNodeLayer = state => state.node.layer;
const getVisibleSidebar = state => state.visible.sidebar;
const getFontLoaded = state => state.fontLoaded;

/**
 * Calculate chart layout. Algorithm used is dependent on flags
 */
export const getGraph = createSelector(
  [
    getVisibleNodes,
    getVisibleEdges,
    getVisibleLayerIDs,
    getHasVisibleLayers,
    getCurrentFlags,
    getFontLoaded
  ],
  (nodes, edges, layers, showLayers, flags, fontLoaded) => {
    if (!fontLoaded || !nodes.length || !edges.length) {
      return;
    }

    // Use experimental graph rendering if flag enabled
    if (flags.newgraph) {
      const result = graph(nodes, edges, showLayers && layers);

      return {
        graph: () => ({ ...result.size, marginx: 100, marginy: 100 }),
        nodes: () => result.nodes.map(node => node.id),
        edges: () => result.edges.map(edge => edge.id),
        node: id => result.nodes.find(node => node.id === id),
        edge: id => result.edges.find(edge => edge.id === id),
        newgraph: true
      };
    }

    // Otherwise use dagre to render
    return graphDagre(nodes, edges, showLayers);
  }
);

/**
 * Calculate chart layout with Dagre.js.
 * This is an extremely expensive operation so we want it to run as infrequently
 * as possible, and keep it separate from other properties (like node.active)
 * which don't affect layout.
 */
export const graphDagre = (nodes, edges, hasVisibleLayers) => {
  const ranker = hasVisibleLayers ? 'none' : null;
  const graph = new dagre.graphlib.Graph().setGraph({
    ranker: hasVisibleLayers ? ranker : null,
    ranksep: hasVisibleLayers ? 200 : 70,
    marginx: 40,
    marginy: 40
  });

  nodes.forEach(node => {
    graph.setNode(node.id, node);
  });

  edges.forEach(edge => {
    graph.setEdge(edge.source, edge.target, edge);
  });

  // Run Dagre layout to calculate X/Y positioning
  dagre.layout(graph);

  return graph;
};

/**
 * Reformat node data for use on the chart,
 * and recombine with other data that doesn't affect layout
 */
export const getLayoutNodes = createSelector(
  [getGraph, getNodeType, getNodeLayer],
  (graph, nodeType, nodeLayer) =>
    graph
      ? graph.nodes().map(nodeID => {
          const node = graph.node(nodeID);
          return Object.assign({}, node, {
            layer: nodeLayer[nodeID],
            type: nodeType[nodeID],
            order: node.x + node.y * 9999
          });
        })
      : []
);

/**
 * Reformat edge data for use on the chart
 */
export const getLayoutEdges = createSelector(
  [getGraph],
  graph =>
    graph ? graph.edges().map(edge => Object.assign({}, graph.edge(edge))) : []
);

/**
 * Get width, height and margin of graph
 */
export const getGraphSize = createSelector(
  [getGraph],
  graph => (graph ? graph.graph() : {})
);

/**
 * Return the displayed width of the sidebar
 */
export const getSidebarWidth = (visibleSidebar, outerChartWidth) => {
  if (visibleSidebar && outerChartWidth > sidebarBreakpoint) {
    return sidebarWidth.open;
  }
  return sidebarWidth.closed;
};

/**
 * Convert the DOMRect into an Object, mutate some of the properties,
 * and add some useful new ones
 */
export const getChartSize = createSelector(
  [getVisibleSidebar, state => state.chartSize],
  (visibleSidebar, chartSize) => {
    const { left, top, width, height } = chartSize;
    if (!width || !height) {
      return {};
    }
    const sidebarWidth = getSidebarWidth(visibleSidebar, width);
    return {
      left,
      top,
      outerWidth: width,
      outerHeight: height,
      width: width - sidebarWidth,
      height,
      sidebarWidth
    };
  }
);

/**
 * Gets the current chart zoom
 */
export const getChartZoom = createSelector(
  [state => state.zoom],
  zoom => ({
    ...zoom
  })
);
