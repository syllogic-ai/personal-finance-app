'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';

interface SankeyNode {
  name: string;
  value: number;
  color: string;
  y?: number;
  height?: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyChartProps {
  incomes: { name: string; value: number }[];
  expenses: { name: string; value: number }[];
  totalIncome: number;
  totalExpenses: number;
  savings: number;
}

const COLORS = {
  income: ['#22C55E', '#16A34A', '#15803D', '#166534', '#14532D'],
  expense: ['#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#F97316', '#EA580C', '#C2410C', '#9A3412', '#7C2D12'],
  savings: '#3B82F6',
  central: '#6366F1',
};

export function SankeyChart({ incomes, expenses, totalIncome, totalExpenses, savings }: SankeyChartProps) {
  const width = 900;
  const height = 500;
  const nodeWidth = 20;
  const nodePadding = 15;
  const layerGap = 250;

  const chartData = useMemo(() => {
    // Left layer: Income sources
    const leftNodes: SankeyNode[] = incomes
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((income, idx) => ({
        name: income.name,
        value: income.value,
        color: COLORS.income[idx % COLORS.income.length],
      }));

    // Middle layer: Central cash flow node
    const centerNode: SankeyNode = {
      name: 'Cash Flow',
      value: totalIncome,
      color: COLORS.central,
    };

    // Right layer: Expense categories + Savings
    const rightNodes: SankeyNode[] = expenses
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((expense, idx) => ({
        name: expense.name,
        value: expense.value,
        color: COLORS.expense[idx % COLORS.expense.length],
      }));

    // Add savings/surplus if positive
    if (savings > 0) {
      rightNodes.push({
        name: 'Surplus',
        value: savings,
        color: COLORS.savings,
      });
    }

    // Calculate vertical positions for left nodes
    const leftTotalHeight = height - (leftNodes.length - 1) * nodePadding;
    let leftY = 0;
    leftNodes.forEach(node => {
      const nodeHeight = (node.value / totalIncome) * leftTotalHeight;
      node.y = leftY;
      node.height = Math.max(nodeHeight, 5);
      leftY += node.height + nodePadding;
    });

    // Center the left nodes vertically
    const leftActualHeight = leftY - nodePadding;
    const leftOffset = (height - leftActualHeight) / 2;
    leftNodes.forEach(node => {
      node.y = (node.y || 0) + leftOffset;
    });

    // Calculate center node position
    centerNode.y = height * 0.1;
    centerNode.height = height * 0.8;

    // Calculate vertical positions for right nodes
    const rightTotalValue = totalExpenses + Math.max(savings, 0);
    const rightTotalHeight = height - (rightNodes.length - 1) * nodePadding;
    let rightY = 0;
    rightNodes.forEach(node => {
      const nodeHeight = (node.value / rightTotalValue) * rightTotalHeight;
      node.y = rightY;
      node.height = Math.max(nodeHeight, 5);
      rightY += node.height + nodePadding;
    });

    // Center the right nodes vertically
    const rightActualHeight = rightY - nodePadding;
    const rightOffset = (height - rightActualHeight) / 2;
    rightNodes.forEach(node => {
      node.y = (node.y || 0) + rightOffset;
    });

    return { leftNodes, centerNode, rightNodes };
  }, [incomes, expenses, totalIncome, totalExpenses, savings, height]);

  const { leftNodes, centerNode, rightNodes } = chartData;

  // X positions for the three layers
  const leftX = 150;
  const centerX = leftX + layerGap;
  const rightX = centerX + layerGap;

  // Generate curved path between two points
  const generatePath = (
    x1: number, y1: number, h1: number,
    x2: number, y2: number, h2: number,
    value: number, totalSource: number, totalTarget: number,
    sourceOffset: number, targetOffset: number
  ) => {
    const sourceHeight = (value / totalSource) * h1;
    const targetHeight = (value / totalTarget) * h2;

    const sy1 = y1 + sourceOffset;
    const sy2 = sy1 + sourceHeight;
    const ty1 = y2 + targetOffset;
    const ty2 = ty1 + targetHeight;

    const midX = (x1 + x2) / 2;

    return `
      M ${x1 + nodeWidth} ${sy1}
      C ${midX} ${sy1}, ${midX} ${ty1}, ${x2} ${ty1}
      L ${x2} ${ty2}
      C ${midX} ${ty2}, ${midX} ${sy2}, ${x1 + nodeWidth} ${sy2}
      Z
    `;
  };

  // Calculate link paths from left to center
  const leftToCenterLinks: { path: string; color: string; value: number; name: string }[] = [];
  let centerTopOffset = 0;

  leftNodes.forEach(node => {
    if (node.y !== undefined && node.height !== undefined && centerNode.y !== undefined && centerNode.height !== undefined) {
      const targetHeight = (node.value / totalIncome) * centerNode.height;
      const path = generatePath(
        leftX, node.y, node.height,
        centerX, centerNode.y, centerNode.height,
        node.value, node.value, totalIncome,
        0, centerTopOffset
      );
      leftToCenterLinks.push({
        path,
        color: node.color,
        value: node.value,
        name: node.name,
      });
      centerTopOffset += targetHeight;
    }
  });

  // Calculate link paths from center to right
  const centerToRightLinks: { path: string; color: string; value: number; name: string }[] = [];
  let centerBottomOffset = 0;
  const rightTotalValue = totalExpenses + Math.max(savings, 0);

  rightNodes.forEach(node => {
    if (node.y !== undefined && node.height !== undefined && centerNode.y !== undefined && centerNode.height !== undefined) {
      const sourceHeight = (node.value / rightTotalValue) * centerNode.height;
      const path = generatePath(
        centerX, centerNode.y, centerNode.height,
        rightX, node.y, node.height,
        node.value, rightTotalValue, node.value,
        centerBottomOffset, 0
      );
      centerToRightLinks.push({
        path,
        color: node.color,
        value: node.value,
        name: node.name,
      });
      centerBottomOffset += sourceHeight;
    }
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height + 60} className="mx-auto">
        {/* Layer labels */}
        <text x={leftX + nodeWidth / 2} y={20} textAnchor="middle" className="fill-gray-500 text-sm font-medium">
          Inflow
        </text>
        <text x={centerX + nodeWidth / 2} y={20} textAnchor="middle" className="fill-gray-500 text-sm font-medium">
          Cash Flow
        </text>
        <text x={rightX + nodeWidth / 2} y={20} textAnchor="middle" className="fill-gray-500 text-sm font-medium">
          Outflow
        </text>

        <g transform="translate(0, 40)">
          {/* Links from left to center */}
          {leftToCenterLinks.map((link, idx) => (
            <g key={`left-link-${idx}`}>
              <path
                d={link.path}
                fill={link.color}
                fillOpacity={0.4}
                stroke={link.color}
                strokeWidth={1}
                strokeOpacity={0.6}
              >
                <title>{link.name}: {formatCurrency(link.value)}</title>
              </path>
            </g>
          ))}

          {/* Links from center to right */}
          {centerToRightLinks.map((link, idx) => (
            <g key={`right-link-${idx}`}>
              <path
                d={link.path}
                fill={link.color}
                fillOpacity={0.4}
                stroke={link.color}
                strokeWidth={1}
                strokeOpacity={0.6}
              >
                <title>{link.name}: {formatCurrency(link.value)}</title>
              </path>
            </g>
          ))}

          {/* Left nodes (Income sources) */}
          {leftNodes.map((node, idx) => (
            <g key={`left-node-${idx}`}>
              <rect
                x={leftX}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={4}
              >
                <title>{node.name}: {formatCurrency(node.value)}</title>
              </rect>
              <text
                x={leftX - 8}
                y={(node.y || 0) + (node.height || 0) / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-700 dark:fill-gray-300 text-xs"
              >
                {node.name}
              </text>
              <text
                x={leftX - 8}
                y={(node.y || 0) + (node.height || 0) / 2 + 12}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500 text-xs"
              >
                {formatCurrency(node.value)}
              </text>
            </g>
          ))}

          {/* Center node (Cash Flow) */}
          <g>
            <rect
              x={centerX}
              y={centerNode.y}
              width={nodeWidth}
              height={centerNode.height}
              fill={centerNode.color}
              rx={4}
            >
              <title>{centerNode.name}: {formatCurrency(centerNode.value)}</title>
            </rect>
            <text
              x={centerX + nodeWidth / 2}
              y={(centerNode.y || 0) - 10}
              textAnchor="middle"
              className="fill-gray-700 dark:fill-gray-300 text-sm font-medium"
            >
              {formatCurrency(totalIncome)}
            </text>
          </g>

          {/* Right nodes (Expenses + Savings) */}
          {rightNodes.map((node, idx) => (
            <g key={`right-node-${idx}`}>
              <rect
                x={rightX}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={4}
              >
                <title>{node.name}: {formatCurrency(node.value)}</title>
              </rect>
              <text
                x={rightX + nodeWidth + 8}
                y={(node.y || 0) + (node.height || 0) / 2}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-gray-700 dark:fill-gray-300 text-xs"
              >
                {node.name}
              </text>
              <text
                x={rightX + nodeWidth + 8}
                y={(node.y || 0) + (node.height || 0) / 2 + 12}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-gray-500 text-xs"
              >
                {formatCurrency(node.value)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
